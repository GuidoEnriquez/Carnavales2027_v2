import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import { auditEvent } from "../../audit/audit-service.js";
import { grantRole } from "../../auth/role-service.js";
import { closePool, getPool } from "../pool.js";
import { migrate } from "../migrate.js";

const originalDatabaseUrl = process.env.DATABASE_URL;

function restoreDatabaseUrl() {
  if (originalDatabaseUrl === undefined) {
    delete process.env.DATABASE_URL;
    return;
  }

  process.env.DATABASE_URL = originalDatabaseUrl;
}

test("audit_event permite inserciones, rechaza mutaciones y no registra secretos", {
  skip: !process.env.TEST_DATABASE_URL,
}, async (context) => {
  context.after(async () => {
    await closePool();
    restoreDatabaseUrl();
  });

  process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;
  await migrate();

  const client = await getPool().connect();
  const entityId = randomUUID();

  try {
    const event = await auditEvent(client, {
      actorUserId: randomUUID(),
      action: "USER_ROLE_GRANTED",
      entityType: "user_role",
      entityId,
      after: { roleCode: "ADMIN" },
    });

    assert.equal(event.action, "USER_ROLE_GRANTED");
    assert.equal(event.entityType, "user_role");
    assert.equal(event.entityId, entityId);
    assert.deepEqual(event.before, {});
    assert.deepEqual(event.after, { roleCode: "ADMIN" });

    await assert.rejects(
      () => client.query("UPDATE audit_event SET action = 'ALTERED' WHERE id = $1", [event.id]),
      /AUDIT_EVENT_IMMUTABLE/,
    );
    await assert.rejects(
      () => client.query("DELETE FROM audit_event WHERE id = $1", [event.id]),
      /AUDIT_EVENT_IMMUTABLE/,
    );
    await assert.rejects(
      () => auditEvent(client, {
        actorUserId: randomUUID(),
        action: "USER_ROLE_GRANTED",
        entityType: "user_role",
        entityId,
        after: { token: "never-store-this" },
      }),
      /AUDIT_FORBIDDEN_FIELD: token/,
    );
  } finally {
    client.release();
  }
});

test("asignar un rol registra un evento de auditoría", {
  skip: !process.env.TEST_DATABASE_URL,
}, async (context) => {
  context.after(async () => {
    await closePool();
    restoreDatabaseUrl();
  });

  process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;
  await migrate();

  const actorUserId = randomUUID();
  const subjectUserId = randomUUID();
  const pool = getPool();
  await pool.query(
    `INSERT INTO "user" (id, name, email, "emailVerified")
     VALUES ($1, $2, $3, $4), ($5, $6, $7, $8)`,
    [
      actorUserId,
      "Role actor",
      `${actorUserId}@example.test`,
      true,
      subjectUserId,
      "Role subject",
      `${subjectUserId}@example.test`,
      true,
    ],
  );

  const result = await grantRole({
    actorUserId,
    userId: subjectUserId,
    roleCode: "ADMIN",
  });

  assert.equal(result.created, true);
  const { rows } = await pool.query(
    `SELECT actor_user_id, action, entity_type, entity_id, after_data
     FROM audit_event
     WHERE entity_type = 'user_role' AND entity_id = $1
     ORDER BY created_at DESC
     LIMIT 1`,
    [subjectUserId],
  );
  assert.deepEqual(rows, [{
    actor_user_id: actorUserId,
    action: "USER_ROLE_GRANTED",
    entity_type: "user_role",
    entity_id: subjectUserId,
    after_data: { roleCode: "ADMIN" },
  }]);
});
