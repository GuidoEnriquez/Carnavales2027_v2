import crypto from "node:crypto";
import { auditEvent } from "../../audit/audit-service.js";
import { getPool } from "../../db/pool.js";

const isOperationalRole = (roleCode) => {
  return ["ADMIN", "VEEDOR", "COMISARIO", "SCRUTINEER"].includes(roleCode);
};

export const listOperationalUsers = async () => {
  const pool = getPool();
  // Fetch users that have at least one operational role
  const { rows } = await pool.query(`
    SELECT u.id, u.name, u.email, array_agg(ur.role_code) as roles
    FROM "user" u
    JOIN user_role ur ON u.id = ur.user_id
    WHERE ur.role_code IN ('ADMIN', 'VEEDOR', 'COMISARIO', 'SCRUTINEER')
    GROUP BY u.id, u.name, u.email
    ORDER BY u.name ASC
  `);
  return rows;
};

export const inviteOperationalUser = async (email, roleCode, adminUserId) => {
  if (!isOperationalRole(roleCode)) {
    const error = new Error("Rol inválido para este circuito");
    error.code = "INVALID_OPERATIONAL_ROLE";
    throw error;
  }

  const pool = getPool();
  const token = crypto.randomBytes(32).toString("hex");
  const expiresAt = new Date();
  expiresAt.setHours(expiresAt.getHours() + 72);

  const { rows } = await pool.query(
    `INSERT INTO role_invitation (email, role_code, token, expires_at, created_by)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING id, email, role_code as "roleCode", token, expires_at as "expiresAt"`,
    [email, roleCode, token, expiresAt, adminUserId]
  );
  return rows[0];
};

export const getInvitationByToken = async (token) => {
  const pool = getPool();
  const { rows } = await pool.query(
    `SELECT id, email, role_code as "roleCode", expires_at as "expiresAt"
     FROM role_invitation
     WHERE token = $1`,
    [token]
  );
  if (rows.length === 0) return null;
  return rows[0];
};

import { createOrVerifyCredentialUser } from "../../auth/account-service.js";

export const acceptRoleInvitation = async ({ token, password, createUser = createOrVerifyCredentialUser }) => {
  const pool = getPool();
  const invitation = await getInvitationByToken(token);
  if (!invitation || new Date() > new Date(invitation.expiresAt)) {
    throw new Error("INVITATION_INVALID");
  }

  // Create or get user in Better Auth
  const identity = await createUser({
    email: invitation.email,
    name: invitation.email.split('@')[0], // default name
    password,
  });
  const userId = identity.user?.id ?? identity.id;

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // Delete invitation so it can't be reused
    const { rowCount } = await client.query(
      "DELETE FROM role_invitation WHERE id = $1 RETURNING id",
      [invitation.id]
    );
    if (rowCount === 0) throw new Error("INVITATION_INVALID");

    // Grant role
    await client.query(
      `INSERT INTO user_role (user_id, role_code) VALUES ($1, $2) ON CONFLICT (user_id, role_code) DO NOTHING`,
      [userId, invitation.roleCode]
    );

    await auditEvent(client, {
      actorUserId: userId,
      action: "USER_ROLE_GRANTED",
      entityType: "user_role",
      entityId: userId,
      after: { roleCode: invitation.roleCode, fromInvitation: invitation.id },
    });

    await client.query("COMMIT");
    return { userId, roleCode: invitation.roleCode };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
};
