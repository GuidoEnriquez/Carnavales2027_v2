import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import { deleteUser, grantRole, revokeRole } from "../auth/role-service.js";
import { closePool, getPool } from "../db/pool.js";
import { migrate } from "../db/migrate.js";

const originalDatabaseUrl = process.env.DATABASE_URL;

function restoreDatabaseUrl() {
  if (originalDatabaseUrl === undefined) {
    delete process.env.DATABASE_URL;
    return;
  }

  process.env.DATABASE_URL = originalDatabaseUrl;
}

test("el último ADMIN no puede perder su rol ni eliminarse, pero sí puede hacerlo si existe otro", {
  skip: !process.env.TEST_DATABASE_URL,
}, async (context) => {
  context.after(async () => {
    await closePool();
    restoreDatabaseUrl();
  });

  process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;
  await migrate();

  const client = await getPool().connect();
  const firstAdminId = randomUUID();
  const secondAdminId = randomUUID();

  try {
    await client.query("BEGIN");
    await client.query("SET LOCAL session_replication_role = 'replica'");
    await client.query("DELETE FROM user_role WHERE role_code = 'ADMIN'");
    await client.query("SET LOCAL session_replication_role = 'origin'");
    await client.query(
      `INSERT INTO "user" (id, name, email, "emailVerified")
       VALUES ($1, $2, $3, $4), ($5, $6, $7, $8)`,
      [
        firstAdminId,
        "First admin",
        `${firstAdminId}@example.test`,
        true,
        secondAdminId,
        "Second admin",
        `${secondAdminId}@example.test`,
        true,
      ],
    );
    await grantRole({ client, userId: firstAdminId, roleCode: "ADMIN" });

    await client.query("SAVEPOINT direct_role_removal");
    await assert.rejects(
      () => client.query(
        "DELETE FROM user_role WHERE user_id = $1 AND role_code = 'ADMIN'",
        [firstAdminId],
      ),
      /LAST_ADMIN_REQUIRED/,
    );
    await client.query("ROLLBACK TO SAVEPOINT direct_role_removal");

    await client.query(
      "INSERT INTO app_role (code, description) VALUES ('OPERATOR', 'Test-only role')",
    );
    await client.query("SAVEPOINT direct_role_update");
    await assert.rejects(
      () => client.query(
        "UPDATE user_role SET role_code = 'OPERATOR' WHERE user_id = $1 AND role_code = 'ADMIN'",
        [firstAdminId],
      ),
      /LAST_ADMIN_REQUIRED/,
    );
    await client.query("ROLLBACK TO SAVEPOINT direct_role_update");

    await client.query("SAVEPOINT direct_user_deletion");
    await assert.rejects(
      () => client.query('DELETE FROM "user" WHERE id = $1', [firstAdminId]),
      /LAST_ADMIN_REQUIRED/,
    );
    await client.query("ROLLBACK TO SAVEPOINT direct_user_deletion");

    await assert.rejects(
      () => revokeRole({ client, userId: firstAdminId, roleCode: "ADMIN" }),
      /LAST_ADMIN_REQUIRED/,
    );
    const { rows: rejectedAuditRows } = await client.query(
      `SELECT action, after_data
       FROM audit_event
       WHERE entity_type = 'user_role'
         AND entity_id = $1
         AND action = 'USER_ROLE_REVOKE_REJECTED'
       LIMIT 1`,
      [firstAdminId],
    );
    assert.deepEqual(rejectedAuditRows, [{
      action: "USER_ROLE_REVOKE_REJECTED",
      after_data: { roleCode: "ADMIN", reason: "LAST_ADMIN_REQUIRED" },
    }]);

    await assert.rejects(
      () => deleteUser({ client, userId: firstAdminId }),
      /LAST_ADMIN_REQUIRED/,
    );
    const { rows: rejectedUserDeletionAudits } = await client.query(
      `SELECT action, after_data
       FROM audit_event
       WHERE entity_type = 'user'
         AND entity_id = $1
         AND action = 'USER_DELETE_REJECTED'
       LIMIT 1`,
      [firstAdminId],
    );
    assert.deepEqual(rejectedUserDeletionAudits, [{
      action: "USER_DELETE_REJECTED",
      after_data: { reason: "LAST_ADMIN_REQUIRED" },
    }]);

    await grantRole({ client, userId: secondAdminId, roleCode: "ADMIN" });
    const revocation = await revokeRole({ client, userId: firstAdminId, roleCode: "ADMIN" });
    assert.deepEqual(revocation, { removed: true });

    const { rows: remainingRoles } = await client.query(
      "SELECT user_id FROM user_role WHERE role_code = 'ADMIN' ORDER BY user_id",
    );
    assert.deepEqual(remainingRoles, [{ user_id: secondAdminId }]);
  } finally {
    await client.query("ROLLBACK");
    client.release();
  }
});
