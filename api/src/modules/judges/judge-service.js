import { createHash, randomBytes, randomUUID } from "node:crypto";
import { auditEvent } from "../../audit/audit-service.js";
import { createOrVerifyCredentialUser, revokeUserSessions } from "../../auth/account-service.js";
import { grantRole } from "../../auth/role-service.js";
import { getPool } from "../../db/pool.js";
import { createInvitationDelivery } from "./invitation-delivery.js";

const invitationLockKey = "carnavales2027_v2_judge_invitation";

function requireText(value, name) {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new TypeError(`${name} debe ser texto no vacío.`);
  }
  return value.trim();
}

function normalizeEmail(value) {
  const email = requireText(value, "email").toLowerCase();
  if (!/^[^\s@,<>]+@[^\s@,<>]+\.[^\s@,<>]+$/.test(email)) {
    throw new TypeError("email debe ser una única dirección válida.");
  }
  return email;
}

function invitationHours(environment = process.env) {
  const hours = Number(environment.JUDGE_INVITATION_TTL_HOURS ?? 72);
  if (!Number.isInteger(hours) || hours <= 0) {
    throw new Error("JUDGE_INVITATION_TTL_HOURS debe ser un entero positivo.");
  }
  return hours;
}

function hashSecret(secret) {
  return createHash("sha256").update(requireText(secret, "secret")).digest("hex");
}

function maskEmail(email) {
  const [local, domain] = email.split("@");
  return `${local.slice(0, 1)}${"*".repeat(Math.max(2, local.length - 1))}@${domain}`;
}

async function inTransaction(operation) {
  const client = await getPool().connect();
  let phase = "operation";
  try {
    await client.query("BEGIN");
    const result = await operation(client);
    phase = "commit";
    await client.query("COMMIT");
    return result;
  } catch (error) {
    error.transactionPhase = phase;
    if (phase !== "commit") {
      try { await client.query("ROLLBACK"); } catch { /* Preserve the original failure. */ }
    }
    throw error;
  } finally {
    client.release();
  }
}

function mapProfile(row) {
  return {
    id: row.id,
    userId: row.userId,
    name: row.name,
    email: row.email,
    documentNumber: row.documentNumber,
    registrationStatus: row.registrationStatus,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    invitation: row.invitationId ? {
      id: row.invitationId,
      status: row.invitationStatus,
      expiresAt: row.invitationExpiresAt,
      deliveryStatus: row.invitationDeliveryStatus,
      sentAt: row.invitationSentAt,
    } : null,
  };
}

async function issueInvitation(client, { actorUserId, judgeProfileId }) {
  const secret = randomBytes(32).toString("base64url");
  const secretHash = hashSecret(secret);
  const hours = invitationHours();
  const { rows } = await client.query(
    `INSERT INTO judge_invitation (
       judge_profile_id, secret_hash, expires_at, created_by
     ) VALUES ($1, $2, CURRENT_TIMESTAMP + ($3 * INTERVAL '1 hour'), $4)
     RETURNING id, expires_at AS "expiresAt", delivery_status AS "deliveryStatus"`,
    [judgeProfileId, secretHash, hours, actorUserId],
  );
  await auditEvent(client, {
    actorUserId,
    action: "JUDGE_INVITATION_CREATED",
    entityType: "judge_invitation",
    entityId: rows[0].id,
    after: { judgeProfileId, expiresAt: rows[0].expiresAt },
  });
  return { ...rows[0], secret };
}

async function recordDelivery(invitationId, delivered, actorUserId) {
  return inTransaction(async (client) => {
    const { rows } = await client.query(
      `UPDATE judge_invitation
          SET delivery_status = $2,
              sent_at = CASE WHEN $2 = 'SENT' THEN CURRENT_TIMESTAMP ELSE NULL END
        WHERE id = $1
        RETURNING id, judge_profile_id AS "judgeProfileId", status,
                  delivery_status AS "deliveryStatus", sent_at AS "sentAt"`,
      [invitationId, delivered ? "SENT" : "FAILED"],
    );
    if (rows.length === 0) throw new Error("INVITATION_INVALID");
    await auditEvent(client, {
      actorUserId,
      action: delivered ? "JUDGE_INVITED" : "JUDGE_INVITATION_DELIVERY_FAILED",
      entityType: "judge_invitation",
      entityId: invitationId,
      after: { judgeProfileId: rows[0].judgeProfileId, deliveryStatus: rows[0].deliveryStatus },
    });
    return rows[0];
  });
}

async function deliverInvitation({ profile, invitation, actorUserId, sendInvitation }) {
  try {
    await sendInvitation({
      email: profile.email,
      name: profile.name,
      secret: invitation.secret,
      expiresAt: invitation.expiresAt,
    });
    const delivery = await recordDelivery(invitation.id, true, actorUserId);
    return { ...invitation, ...delivery };
  } catch (error) {
    await recordDelivery(invitation.id, false, actorUserId);
    const deliveryError = new Error("INVITATION_DELIVERY_FAILED");
    deliveryError.cause = error;
    throw deliveryError;
  }
}

export async function listJudges({ client = getPool() } = {}) {
  const { rows } = await client.query(
    `SELECT jp.id, jp.user_id AS "userId", jp.name, jp.email,
            jp.document_number AS "documentNumber",
            jp.registration_status AS "registrationStatus",
            jp.created_at AS "createdAt", jp.updated_at AS "updatedAt",
            ji.id AS "invitationId",
            CASE WHEN ji.status = 'PENDING' AND ji.expires_at <= CURRENT_TIMESTAMP
                 THEN 'EXPIRED' ELSE ji.status END AS "invitationStatus",
            ji.expires_at AS "invitationExpiresAt",
            ji.delivery_status AS "invitationDeliveryStatus",
            ji.sent_at AS "invitationSentAt"
       FROM judge_profile jp
       LEFT JOIN LATERAL (
         SELECT * FROM judge_invitation
          WHERE judge_profile_id = jp.id
          ORDER BY created_at DESC
          LIMIT 1
       ) ji ON true
      ORDER BY jp.name, jp.email`,
  );
  return rows.map(mapProfile);
}

export async function getJudgeProfileByUserId({ userId, client = getPool() }) {
  const { rows } = await client.query(
    `SELECT id, user_id AS "userId", name, email,
            document_number AS "documentNumber",
            registration_status AS "registrationStatus",
            created_at AS "createdAt", updated_at AS "updatedAt"
       FROM judge_profile WHERE user_id = $1`,
    [requireText(userId, "userId")],
  );
  return rows[0] ? mapProfile(rows[0]) : null;
}

export async function createJudge({
  actorUserId,
  name,
  email,
  documentNumber,
  sendInvitation = createInvitationDelivery(),
}) {
  const profileData = {
    name: requireText(name, "name"),
    email: normalizeEmail(email),
    documentNumber: requireText(documentNumber, "documentNumber"),
  };
  const created = await inTransaction(async (client) => {
    const { rows: userRows } = await client.query(
      'SELECT 1 FROM "user" WHERE lower(email) = $1',
      [profileData.email],
    );
    if (userRows.length > 0) throw new Error("ACCOUNT_ALREADY_EXISTS");

    const { rows } = await client.query(
      `INSERT INTO judge_profile (name, email, document_number, created_by)
       VALUES ($1, $2, $3, $4)
       RETURNING id, user_id AS "userId", name, email,
                 document_number AS "documentNumber",
                 registration_status AS "registrationStatus",
                 created_at AS "createdAt", updated_at AS "updatedAt"`,
      [profileData.name, profileData.email, profileData.documentNumber, actorUserId],
    );
    const profile = mapProfile(rows[0]);
    await auditEvent(client, {
      actorUserId,
      action: "JUDGE_REGISTERED",
      entityType: "judge_profile",
      entityId: profile.id,
      after: { registrationStatus: profile.registrationStatus },
    });
    return { profile, invitation: await issueInvitation(client, { actorUserId, judgeProfileId: profile.id }) };
  });

  const invitation = await deliverInvitation({
    profile: created.profile,
    invitation: created.invitation,
    actorUserId,
    sendInvitation,
  });
  return {
    judge: created.profile,
    invitation: {
      id: invitation.id,
      status: invitation.status,
      expiresAt: invitation.expiresAt,
      deliveryStatus: invitation.deliveryStatus,
      sentAt: invitation.sentAt,
    },
  };
}

export async function reissueInvitation({
  actorUserId,
  judgeProfileId,
  sendInvitation = createInvitationDelivery(),
}) {
  const created = await inTransaction(async (client) => {
    const { rows } = await client.query(
      `SELECT id, user_id AS "userId", name, email,
              document_number AS "documentNumber",
              registration_status AS "registrationStatus",
              created_at AS "createdAt", updated_at AS "updatedAt"
         FROM judge_profile WHERE id = $1 FOR UPDATE`,
      [judgeProfileId],
    );
    if (rows.length === 0) throw new Error("JUDGE_NOT_FOUND");
    const profile = mapProfile(rows[0]);
    if (profile.registrationStatus !== "INVITED") throw new Error("INVALID_JUDGE_STATUS");

    const { rows: revoked } = await client.query(
      `UPDATE judge_invitation
          SET status = 'REVOKED', revoked_at = CURRENT_TIMESTAMP, revoked_by = $2
        WHERE judge_profile_id = $1 AND status = 'PENDING'
        RETURNING id`,
      [judgeProfileId, actorUserId],
    );
    for (const invitation of revoked) {
      await auditEvent(client, {
        actorUserId,
        action: "JUDGE_INVITATION_REVOKED",
        entityType: "judge_invitation",
        entityId: invitation.id,
        after: { reason: "REISSUED" },
      });
    }
    return { profile, invitation: await issueInvitation(client, { actorUserId, judgeProfileId }) };
  });

  const invitation = await deliverInvitation({
    profile: created.profile,
    invitation: created.invitation,
    actorUserId,
    sendInvitation,
  });
  return {
    id: invitation.id,
    status: invitation.status,
    expiresAt: invitation.expiresAt,
    deliveryStatus: invitation.deliveryStatus,
    sentAt: invitation.sentAt,
  };
}

export async function revokeInvitation({ actorUserId, judgeProfileId, invitationId }) {
  return inTransaction(async (client) => {
    const { rows } = await client.query(
      `UPDATE judge_invitation
          SET status = 'REVOKED', revoked_at = CURRENT_TIMESTAMP, revoked_by = $3
        WHERE id = $1 AND judge_profile_id = $2 AND status = 'PENDING'
        RETURNING id`,
      [invitationId, judgeProfileId, actorUserId],
    );
    if (rows.length === 0) throw new Error("INVITATION_INVALID");
    await auditEvent(client, {
      actorUserId,
      action: "JUDGE_INVITATION_REVOKED",
      entityType: "judge_invitation",
      entityId: invitationId,
      after: { reason: "ADMIN_REVOKED" },
    });
    return { revoked: true };
  });
}

export async function inspectInvitation({ secret, client = getPool() }) {
  const { rows } = await client.query(
    `SELECT jp.email, ji.expires_at AS "expiresAt"
       FROM judge_invitation ji
       JOIN judge_profile jp ON jp.id = ji.judge_profile_id
      WHERE ji.secret_hash = $1
        AND ji.status = 'PENDING'
        AND ji.expires_at > clock_timestamp()
        AND jp.registration_status = 'INVITED'`,
    [hashSecret(secret)],
  );
  if (rows.length === 0) throw new Error("INVITATION_INVALID");
  return { valid: true, maskedEmail: maskEmail(rows[0].email), expiresAt: rows[0].expiresAt };
}

export async function acceptInvitation({
  secret,
  password,
  createUser = createOrVerifyCredentialUser,
}) {
  const secretHash = hashSecret(secret);
  const claimId = randomUUID();
  let createdUser = null;
  const invitation = await inTransaction(async (client) => {
    await client.query("SELECT pg_advisory_xact_lock(hashtext($1), hashtext($2))", [invitationLockKey, secretHash]);
    const { rows } = await client.query(
      `UPDATE judge_invitation ji
          SET acceptance_claim_id = $2, acceptance_claimed_at = clock_timestamp()
         FROM judge_profile jp
        WHERE ji.secret_hash = $1
          AND jp.id = ji.judge_profile_id
          AND ji.status = 'PENDING'
          AND ji.expires_at > clock_timestamp()
          AND jp.registration_status = 'INVITED'
          AND (
            ji.acceptance_claim_id IS NULL
            OR ji.acceptance_claimed_at < clock_timestamp() - INTERVAL '5 minutes'
          )
      RETURNING ji.id AS "invitationId", jp.id AS "judgeProfileId", jp.name, jp.email`,
      [secretHash, claimId],
    );
    if (rows.length === 0) throw new Error("INVITATION_INVALID");
    return rows[0];
  });

  try {
    const identity = await createUser({
      email: invitation.email,
      name: invitation.name,
      password,
    });
    createdUser = identity.user ?? identity;
    return await inTransaction(async (client) => {
      const { rows } = await client.query(
        `SELECT 1
           FROM judge_invitation ji
           JOIN judge_profile jp ON jp.id = ji.judge_profile_id
          WHERE ji.id = $1
            AND ji.acceptance_claim_id = $2
            AND ji.status = 'PENDING'
            AND ji.expires_at > clock_timestamp()
            AND jp.id = $3
            AND jp.registration_status = 'INVITED'
          FOR UPDATE OF ji, jp`,
        [invitation.invitationId, claimId, invitation.judgeProfileId],
      );
      if (rows.length === 0) throw new Error("INVITATION_INVALID");
      await client.query(
        `UPDATE judge_profile
            SET user_id = $2, registration_status = 'REGISTERED'
          WHERE id = $1`,
        [invitation.judgeProfileId, createdUser.id],
      );
      await client.query(
        `UPDATE judge_invitation
            SET status = 'USED', used_at = CURRENT_TIMESTAMP
          WHERE id = $1`,
        [invitation.invitationId],
      );
      await grantRole({
        client,
        actorUserId: createdUser.id,
        userId: createdUser.id,
        roleCode: "JUDGE",
      });
      await auditEvent(client, {
        actorUserId: createdUser.id,
        action: "JUDGE_COMPLETED_REGISTRATION",
        entityType: "judge_profile",
        entityId: invitation.judgeProfileId,
        after: { registrationStatus: "REGISTERED", invitationId: invitation.invitationId },
      });
      return { accepted: true, next: "TWO_FACTOR_SETUP" };
    });
  } catch (error) {
    if (createdUser?.id) {
      try {
        const { rows } = await getPool().query(
          `SELECT ji.status, jp.user_id AS "userId",
                  EXISTS (
                    SELECT 1 FROM user_role ur
                     WHERE ur.user_id = jp.user_id AND ur.role_code = 'JUDGE'
                  ) AS "hasJudgeRole"
             FROM judge_invitation ji
             JOIN judge_profile jp ON jp.id = ji.judge_profile_id
            WHERE ji.id = $1`,
          [invitation.invitationId],
        );
        const state = rows[0];
        if (state?.status === "USED" && state.userId === createdUser.id && state.hasJudgeRole) {
          return { accepted: true, next: "TWO_FACTOR_SETUP" };
        }
      } catch {
        // Preserve the identity: retries can reconcile it without a destructive race.
      }
    }
    try {
      await getPool().query(
        `UPDATE judge_invitation
            SET acceptance_claim_id = NULL, acceptance_claimed_at = NULL
          WHERE id = $1 AND status = 'PENDING' AND acceptance_claim_id = $2`,
        [invitation.invitationId, claimId],
      );
    } catch {
      // A stale claim can be reclaimed after its short timeout.
    }
    if (error.message === "ACCOUNT_ALREADY_EXISTS") throw new Error("INVITATION_INVALID");
    throw error;
  }
}

export async function suspendJudge({
  actorUserId,
  judgeProfileId,
  revokeSessions = revokeUserSessions,
}) {
  const profile = await inTransaction(async (client) => {
    const { rows } = await client.query(
      `SELECT id, user_id AS "userId", registration_status AS "registrationStatus"
         FROM judge_profile WHERE id = $1 FOR UPDATE`,
      [judgeProfileId],
    );
    if (rows.length === 0) throw new Error("JUDGE_NOT_FOUND");
    if (!["REGISTERED", "SUSPENDED"].includes(rows[0].registrationStatus)) {
      throw new Error("INVALID_JUDGE_STATUS");
    }
    if (rows[0].registrationStatus === "REGISTERED") {
      await client.query(
        "UPDATE judge_profile SET registration_status = 'SUSPENDED' WHERE id = $1",
        [judgeProfileId],
      );
      await auditEvent(client, {
        actorUserId,
        action: "JUDGE_SUSPENDED",
        entityType: "judge_profile",
        entityId: judgeProfileId,
        before: { registrationStatus: "REGISTERED" },
        after: { registrationStatus: "SUSPENDED" },
      });
    }
    return { ...rows[0], alreadySuspended: rows[0].registrationStatus === "SUSPENDED" };
  });
  try {
    await revokeSessions(profile.userId);
  } catch (error) {
    const revocationError = new Error("SESSION_REVOCATION_FAILED");
    revocationError.cause = error;
    throw revocationError;
  }
  return { suspended: true, sessionsRevoked: true, alreadySuspended: profile.alreadySuspended };
}

export async function reactivateJudge({
  actorUserId,
  judgeProfileId,
  revokeSessions = revokeUserSessions,
}) {
  const { rows: candidates } = await getPool().query(
    `SELECT user_id AS "userId", registration_status AS "registrationStatus"
       FROM judge_profile WHERE id = $1`,
    [judgeProfileId],
  );
  if (candidates.length === 0) throw new Error("JUDGE_NOT_FOUND");
  if (candidates[0].registrationStatus !== "SUSPENDED") throw new Error("INVALID_JUDGE_STATUS");
  try {
    await revokeSessions(candidates[0].userId);
  } catch (error) {
    const revocationError = new Error("SESSION_REVOCATION_FAILED");
    revocationError.cause = error;
    throw revocationError;
  }
  return inTransaction(async (client) => {
    const { rows } = await client.query(
      `SELECT id, user_id AS "userId", registration_status AS "registrationStatus"
         FROM judge_profile WHERE id = $1 FOR UPDATE`,
      [judgeProfileId],
    );
    if (rows.length === 0) throw new Error("JUDGE_NOT_FOUND");
    if (rows[0].registrationStatus !== "SUSPENDED") throw new Error("INVALID_JUDGE_STATUS");
    await client.query(
      "UPDATE judge_profile SET registration_status = 'REGISTERED' WHERE id = $1",
      [judgeProfileId],
    );
    await auditEvent(client, {
      actorUserId,
      action: "JUDGE_REACTIVATED",
      entityType: "judge_profile",
      entityId: judgeProfileId,
      before: { registrationStatus: "SUSPENDED" },
      after: { registrationStatus: "REGISTERED" },
    });
    return { reactivated: true };
  });
}
