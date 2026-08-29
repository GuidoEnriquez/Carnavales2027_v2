import { auditEvent } from "../audit/audit-service.js";
import { getPool } from "../db/pool.js";

function requireText(value, name) {
  if (typeof value !== "string" || value.length === 0) {
    throw new TypeError(`${name} debe ser texto no vacío.`);
  }

  return value;
}

async function grantRoleWithClient(client, { actorUserId, userId, roleCode }) {
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

export async function grantRole({ actorUserId = null, userId, roleCode, client = null }) {
  if (client) {
    return grantRoleWithClient(client, { actorUserId, userId, roleCode });
  }

  const ownedClient = await getPool().connect();

  try {
    await ownedClient.query("BEGIN");
    const result = await grantRoleWithClient(ownedClient, { actorUserId, userId, roleCode });
    await ownedClient.query("COMMIT");
    return result;
  } catch (error) {
    await ownedClient.query("ROLLBACK");
    throw error;
  } finally {
    ownedClient.release();
  }
}
