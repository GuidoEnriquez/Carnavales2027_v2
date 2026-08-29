import { auditEvent } from "../audit/audit-service.js";
import { getPool } from "../db/pool.js";

const lastAdminLockKey = "carnavales2027_v2_last_admin";

function requireText(value, name) {
  if (typeof value !== "string" || value.length === 0) {
    throw new TypeError(`${name} debe ser texto no vacío.`);
  }

  return value;
}

async function runTransaction(client, operation) {
  if (client) {
    return operation(client);
  }

  const ownedClient = await getPool().connect();
  try {
    await ownedClient.query("BEGIN");
    const result = await operation(ownedClient);
    await ownedClient.query("COMMIT");
    return result;
  } catch (error) {
    await ownedClient.query("ROLLBACK");
    throw error;
  } finally {
    ownedClient.release();
  }
}

async function grantRoleWithClient(client, { actorUserId, userId, roleCode }) {
  if (roleCode === "ADMIN") {
    await client.query("SELECT pg_advisory_xact_lock(hashtext($1))", [lastAdminLockKey]);
  }

  const { rows } = await client.query(
    `INSERT INTO user_role (user_id, role_code)
     VALUES ($1, $2)
     ON CONFLICT (user_id, role_code) DO NOTHING
     RETURNING user_id, role_code`,
    [requireText(userId, "userId"), requireText(roleCode, "roleCode")],
  );

  if (rows.length === 0) {
    return { created: false };
  }

  await auditEvent(client, {
    actorUserId,
    action: "USER_ROLE_GRANTED",
    entityType: "user_role",
    entityId: userId,
    after: { roleCode },
  });
  return { created: true };
}

async function canRemoveAdminRole(client, userId) {
  await client.query("SELECT pg_advisory_xact_lock(hashtext($1))", [lastAdminLockKey]);
  const { rows } = await client.query(
    "SELECT COUNT(*)::integer AS count FROM user_role WHERE role_code = 'ADMIN'",
  );
  return rows[0].count > 1;
}

async function revokeRoleWithClient(client, { actorUserId, userId, roleCode }) {
  const { rows: roleRows } = await client.query(
    "SELECT role_code FROM user_role WHERE user_id = $1 AND role_code = $2",
    [requireText(userId, "userId"), requireText(roleCode, "roleCode")],
  );
  if (roleRows.length === 0) {
    return { removed: false };
  }

  if (roleCode === "ADMIN" && !await canRemoveAdminRole(client, userId)) {
    await auditEvent(client, {
      actorUserId,
      action: "USER_ROLE_REVOKE_REJECTED",
      entityType: "user_role",
      entityId: userId,
      after: { roleCode, reason: "LAST_ADMIN_REQUIRED" },
    });
    return { blocked: true };
  }

  await client.query(
    "DELETE FROM user_role WHERE user_id = $1 AND role_code = $2",
    [userId, roleCode],
  );
  await auditEvent(client, {
    actorUserId,
    action: "USER_ROLE_REVOKED",
    entityType: "user_role",
    entityId: userId,
    before: { roleCode },
  });
  return { removed: true };
}

export async function grantRole({ actorUserId = null, userId, roleCode, client = null }) {
  return runTransaction(client, (transactionClient) => grantRoleWithClient(transactionClient, {
    actorUserId,
    userId,
    roleCode,
  }));
}

export async function revokeRole({ actorUserId = null, userId, roleCode, client = null }) {
  const result = await runTransaction(client, (transactionClient) => revokeRoleWithClient(transactionClient, {
    actorUserId,
    userId,
    roleCode,
  }));

  if (result.blocked) {
    throw new Error("LAST_ADMIN_REQUIRED");
  }

  return result;
}

export async function deleteUser({ actorUserId = null, userId, client = null }) {
  const result = await runTransaction(client, async (transactionClient) => {
    const { rows: adminRoleRows } = await transactionClient.query(
      "SELECT 1 FROM user_role WHERE user_id = $1 AND role_code = 'ADMIN'",
      [requireText(userId, "userId")],
    );
    if (adminRoleRows.length > 0 && !await canRemoveAdminRole(transactionClient, userId)) {
      await auditEvent(transactionClient, {
        actorUserId,
        action: "USER_DELETE_REJECTED",
        entityType: "user",
        entityId: userId,
        after: { reason: "LAST_ADMIN_REQUIRED" },
      });
      return { blocked: true };
    }

    const { rows } = await transactionClient.query(
      'DELETE FROM "user" WHERE id = $1 RETURNING id',
      [userId],
    );
    if (rows.length === 0) {
      return { deleted: false };
    }
    await auditEvent(transactionClient, {
      actorUserId,
      action: "USER_DELETED",
      entityType: "user",
      entityId: userId,
    });
    return { deleted: true };
  });

  if (result.blocked) {
    throw new Error("LAST_ADMIN_REQUIRED");
  }

  return result;
}
