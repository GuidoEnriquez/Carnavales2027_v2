import { createHash, randomBytes, randomUUID } from "node:crypto";
import { auditEvent } from "../../audit/audit-service.js";
import { getPool } from "../../db/pool.js";

const operationalRoles = new Set(["VEEDOR", "COMISARIO", "SCRUTINEER"]);
const invitationLockKey = "carnavales2027_v2_operational_invitation";

function normalizeEmail(value) {
  if (typeof value !== "string") throw new TypeError("email debe ser texto no vacío.");
  const email = value.trim().toLowerCase();
  if (!/^[^\s@,<>]+@[^\s@,<>]+\.[^\s@,<>]+$/.test(email)) {
    throw new TypeError("email debe ser una única dirección válida.");
  }
  return email;
}

function hashToken(token) {
  if (typeof token !== "string" || token.trim().length === 0) {
    throw new Error("INVITATION_INVALID");
  }
  return createHash("sha256").update(token.trim()).digest("hex");
}

function maskEmail(email) {
  const [local, domain] = email.split("@");
  return `${local.slice(0, 1)}${"*".repeat(Math.max(2, local.length - 1))}@${domain}`;
}

async function inTransaction(operation) {
  const client = await getPool().connect();
  try {
    await client.query("BEGIN");
    const result = await operation(client);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export const listOperationalUsers = async () => {
  const pool = getPool();
  // Fetch users that have at least one operational role
  const { rows } = await pool.query(`
    SELECT u.id, u.name, u.email, array_agg(ur.role_code) as roles
    FROM "user" u
    JOIN user_role ur ON u.id = ur.user_id
     WHERE ur.role_code IN ('VEEDOR', 'COMISARIO', 'SCRUTINEER')
    GROUP BY u.id, u.name, u.email
    ORDER BY u.name ASC
  `);
  return rows;
};

export const inviteOperationalUser = async (email, roleCode, adminUserId) => {
  if (!operationalRoles.has(roleCode)) {
    const error = new Error("Rol inválido para este circuito");
    error.code = "INVALID_OPERATIONAL_ROLE";
    throw error;
  }

  const pool = getPool();
  const normalizedEmail = normalizeEmail(email);
  const token = randomBytes(32).toString("base64url");
  const tokenHash = hashToken(token);
  const expiresAt = new Date();
  expiresAt.setHours(expiresAt.getHours() + 72);

  const { rows } = await pool.query(
    `INSERT INTO role_invitation (email, role_code, token_hash, expires_at, created_by)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING id, email, role_code as "roleCode", expires_at as "expiresAt"`,
    [normalizedEmail, roleCode, tokenHash, expiresAt, adminUserId]
  );
  await auditEvent(pool, {
    actorUserId: adminUserId,
    action: "OPERATIONAL_INVITATION_CREATED",
    entityType: "role_invitation",
    entityId: rows[0].id,
    after: { email: normalizedEmail, roleCode, expiresAt: rows[0].expiresAt },
  });
  return { ...rows[0], token };
};

export const getInvitationByToken = async (token) => {
  const pool = getPool();
  const { rows } = await pool.query(
    `SELECT email, role_code as "roleCode", expires_at as "expiresAt"
     FROM role_invitation
     WHERE token_hash = $1
       AND status = 'PENDING'
       AND expires_at > clock_timestamp()`,
    [hashToken(token)]
  );
  if (rows.length === 0) return null;
  return { ...rows[0], maskedEmail: maskEmail(rows[0].email) };
};

import { createOrVerifyCredentialUser } from "../../auth/account-service.js";

export const acceptRoleInvitation = async ({ token, password, createUser = createOrVerifyCredentialUser }) => {
  const tokenHash = hashToken(token);
  const claimId = randomUUID();
  let userId = null;
  const invitation = await inTransaction(async (client) => {
    await client.query("SELECT pg_advisory_xact_lock(hashtext($1), hashtext($2))", [invitationLockKey, tokenHash]);
    const { rows } = await client.query(
      `UPDATE role_invitation
          SET acceptance_claim_id = $2, acceptance_claimed_at = clock_timestamp()
        WHERE token_hash = $1
          AND status = 'PENDING'
          AND expires_at > clock_timestamp()
          AND (
            acceptance_claim_id IS NULL
            OR acceptance_claimed_at < clock_timestamp() - INTERVAL '5 minutes'
          )
        RETURNING id, email, role_code AS "roleCode"`,
      [tokenHash, claimId],
    );
    if (rows.length === 0) throw new Error("INVITATION_INVALID");
    return rows[0];
  });

  try {
    const identity = await createUser({
      email: invitation.email,
      name: invitation.email.split("@", 1)[0],
      password,
    });
    userId = identity.user?.id ?? identity.id;
    return await inTransaction(async (client) => {
      const { rows } = await client.query(
        `SELECT id
           FROM role_invitation
          WHERE id = $1
            AND acceptance_claim_id = $2
            AND status = 'PENDING'
            AND expires_at > clock_timestamp()
          FOR UPDATE`,
        [invitation.id, claimId],
      );
      if (rows.length === 0) throw new Error("INVITATION_INVALID");
      await client.query(
        `UPDATE role_invitation
            SET status = 'USED', used_at = clock_timestamp()
          WHERE id = $1`,
        [invitation.id],
      );
      await client.query(
        `INSERT INTO user_role (user_id, role_code)
         VALUES ($1, $2)
         ON CONFLICT (user_id, role_code) DO NOTHING`,
        [userId, invitation.roleCode],
      );
      await auditEvent(client, {
        actorUserId: userId,
        action: "USER_ROLE_GRANTED",
        entityType: "user_role",
        entityId: userId,
        after: { roleCode: invitation.roleCode, fromInvitation: invitation.id },
      });
      return { userId, roleCode: invitation.roleCode };
    });
  } catch (error) {
    try {
      await getPool().query(
        `UPDATE role_invitation
            SET acceptance_claim_id = NULL, acceptance_claimed_at = NULL
          WHERE id = $1 AND status = 'PENDING' AND acceptance_claim_id = $2`,
        [invitation.id, claimId],
      );
    } catch {
      // The claim has a short timeout if a transient database failure prevents release.
    }
    if (error.message === "ACCOUNT_ALREADY_EXISTS") throw new Error("INVITATION_INVALID");
    throw error;
  }
};
