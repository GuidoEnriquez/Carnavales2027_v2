import { auditEvent } from "../audit/audit-service.js";
import { getPool } from "../db/pool.js";

function requireText(value, name) {
  if (typeof value !== "string" || value.length === 0) {
    throw new TypeError(`${name} debe ser texto no vacío.`);
  }

  return value;
}

export async function grantRole({ actorUserId = null, userId, roleCode }) {
  const client = await getPool().connect();

  try {
    await client.query("BEGIN");
    const { rows } = await client.query(
      `INSERT INTO user_role (user_id, role_code)
       VALUES ($1, $2)
       ON CONFLICT (user_id, role_code) DO NOTHING
       RETURNING user_id, role_code`,
      [requireText(userId, "userId"), requireText(roleCode, "roleCode")],
    );

    if (rows.length === 0) {
      await client.query("COMMIT");
      return { created: false };
    }

    await auditEvent(client, {
      actorUserId,
      action: "USER_ROLE_GRANTED",
      entityType: "user_role",
      entityId: userId,
      after: { roleCode },
    });
    await client.query("COMMIT");

    return { created: true };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}
