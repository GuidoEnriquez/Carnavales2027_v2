import { createHash, randomBytes, randomUUID } from "node:crypto";
import { auditEvent } from "../../audit/audit-service.js";
import { createOrVerifyCredentialUser, revokeUserSessions } from "../../auth/account-service.js";
import { grantRole } from "../../auth/role-service.js";
import { getPool } from "../../db/pool.js";
import { createInvitationDelivery } from "../judges/invitation-delivery.js";

const invitationLockKey = "carnavales2027_v2_operational_invitation";

const OPERATIONAL_ROLES = new Set(["VEEDOR", "COMISARIO", "SCRUTINEER", "ESCRIBANO"]);

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
    roles: row.roles ?? [],
    invitation: row.invitationId ? {
      id: row.invitationId,
      status: row.invitationStatus,
      expiresAt: row.invitationExpiresAt,
      deliveryStatus: row.invitationDeliveryStatus,
      sentAt: row.invitationSentAt,
    } : null,
  };
}

async function issueInvitation(client, { actorUserId, operationalProfileId }) {
  const secret = randomBytes(32).toString("base64url");
  const secretHash = hashSecret(secret);
  const hours = invitationHours();
  const { rows } = await client.query(
    `INSERT INTO operational_invitation (
       operational_profile_id, secret_hash, expires_at, created_by
     ) VALUES ($1, $2, CURRENT_TIMESTAMP + ($3 * INTERVAL '1 hour'), $4)
     RETURNING id, expires_at AS "expiresAt"`,
    [operationalProfileId, secretHash, hours, actorUserId],
  );
  await auditEvent(client, {
    actorUserId,
    action: "OPERATIONAL_INVITATION_CREATED",
    entityType: "operational_invitation",
    entityId: rows[0].id,
    after: { operationalProfileId, expiresAt: rows[0].expiresAt },
  });
  return { ...rows[0], secret };
}

async function recordDelivery(invitationId, delivered, actorUserId) {
  return inTransaction(async (client) => {
    const { rows } = await client.query(
      `UPDATE operational_invitation
          SET delivery_status = $2,
              sent_at = CASE WHEN $2 = 'SENT' THEN CURRENT_TIMESTAMP ELSE NULL END
        WHERE id = $1
        RETURNING id, status,
                  delivery_status AS "deliveryStatus", sent_at AS "sentAt"`,
      [invitationId, delivered ? "SENT" : "FAILED"],
    );
    if (rows.length === 0) throw new Error("INVITATION_INVALID");
    await auditEvent(client, {
      actorUserId,
      action: delivered ? "OPERATIONAL_INVITED" : "OPERATIONAL_INVITATION_DELIVERY_FAILED",
      entityType: "operational_invitation",
      entityId: invitationId,
      after: { deliveryStatus: rows[0].deliveryStatus },
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
    return { ...invitation, deliveryStatus: delivery.deliveryStatus, sentAt: delivery.sentAt };
  } catch (error) {
    await recordDelivery(invitation.id, false, actorUserId);
    const deliveryError = new Error("INVITATION_DELIVERY_FAILED");
    deliveryError.cause = error;
    throw deliveryError;
  }
}

export async function listOperationalProfiles({ client = getPool() } = {}) {
  const { rows } = await client.query(
    `SELECT op.id, op.user_id AS "userId", op.name, op.email,
            op.document_number AS "documentNumber",
            op.registration_status AS "registrationStatus",
            op.created_at AS "createdAt", op.updated_at AS "updatedAt",
            COALESCE(
              (SELECT array_agg(opr.role_code) FROM operational_profile_role opr
                WHERE opr.operational_profile_id = op.id),
              ARRAY[]::text[]
            ) AS "roles",
            oi.id AS "invitationId",
            CASE WHEN oi.status = 'PENDING' AND oi.expires_at <= CURRENT_TIMESTAMP
                 THEN 'EXPIRED' ELSE oi.status END AS "invitationStatus",
            oi.expires_at AS "invitationExpiresAt",
            oi.delivery_status AS "invitationDeliveryStatus",
            oi.sent_at AS "invitationSentAt"
       FROM operational_profile op
       LEFT JOIN LATERAL (
         SELECT * FROM operational_invitation
          WHERE operational_profile_id = op.id
          ORDER BY created_at DESC
          LIMIT 1
       ) oi ON true
      ORDER BY op.name, op.email`,
  );
  return rows.map(mapProfile);
}

export async function createOperationalProfile({
  actorUserId,
  name,
  email,
  documentNumber,
  roleCodes,
  sendInvitation = createInvitationDelivery({ route: "#/invitations/operational/accept", logger: { info: (...a) => console.log("[operational-invitation]", ...a) } }),
}) {
  const profileData = {
    name: requireText(name, "name"),
    email: normalizeEmail(email),
    documentNumber: requireText(documentNumber, "documentNumber"),
  };
  const roles = Array.isArray(roleCodes) ? roleCodes : [roleCodes];
  if (roles.length === 0) throw new TypeError("Se requiere al menos un rol.");
  for (const role of roles) {
    if (!OPERATIONAL_ROLES.has(role)) {
      const error = new Error("INVALID_OPERATIONAL_ROLE");
      error.code = "INVALID_OPERATIONAL_ROLE";
      throw error;
    }
  }

  const created = await inTransaction(async (client) => {
    const { rows: existingEmail } = await client.query(
      'SELECT 1 FROM "user" WHERE lower(email) = $1',
      [profileData.email],
    );
    if (existingEmail.length > 0) throw new Error("ACCOUNT_ALREADY_EXISTS");

    const { rows: existingProfile } = await client.query(
      "SELECT 1 FROM operational_profile WHERE lower(email) = $1",
      [profileData.email],
    );
    if (existingProfile.length > 0) {
      const conflict = new Error("PROFILE_ALREADY_EXISTS");
      conflict.code = "PROFILE_ALREADY_EXISTS";
      throw conflict;
    }

    const { rows } = await client.query(
      `INSERT INTO operational_profile (name, email, document_number, created_by)
       VALUES ($1, $2, $3, $4)
       RETURNING id, user_id AS "userId", name, email,
                 document_number AS "documentNumber",
                 registration_status AS "registrationStatus",
                 created_at AS "createdAt", updated_at AS "updatedAt"`,
      [profileData.name, profileData.email, profileData.documentNumber, actorUserId],
    );
    const profile = mapProfile(rows[0]);

    for (const role of roles) {
      await client.query(
        `INSERT INTO operational_profile_role (operational_profile_id, role_code)
         VALUES ($1, $2)`,
        [profile.id, role],
      );
    }
    profile.roles = roles;

    await auditEvent(client, {
      actorUserId,
      action: "OPERATIONAL_PROFILE_CREATED",
      entityType: "operational_profile",
      entityId: profile.id,
      after: { registrationStatus: profile.registrationStatus, roles },
    });

    const invitation = await issueInvitation(client, { actorUserId, operationalProfileId: profile.id });
    return { profile, invitation };
  });

  const deliveredInvitation = await deliverInvitation({
    profile: created.profile,
    invitation: created.invitation,
    actorUserId,
    sendInvitation,
  });

  return {
    operationalProfile: created.profile,
    invitation: {
      id: deliveredInvitation.id,
      status: "PENDING",
      expiresAt: deliveredInvitation.expiresAt,
      deliveryStatus: deliveredInvitation.deliveryStatus,
      sentAt: deliveredInvitation.sentAt,
    },
  };
}

export async function reissueOperationalInvitation({
  actorUserId,
  operationalProfileId,
  sendInvitation = createInvitationDelivery({ route: "#/invitations/operational/accept", logger: { info: (...a) => console.log("[operational-invitation]", ...a) } }),
}) {
  const created = await inTransaction(async (client) => {
    const { rows } = await client.query(
      `SELECT id, user_id AS "userId", name, email,
              document_number AS "documentNumber",
              registration_status AS "registrationStatus",
              created_at AS "createdAt", updated_at AS "updatedAt"
         FROM operational_profile WHERE id = $1 FOR UPDATE`,
      [operationalProfileId],
    );
    if (rows.length === 0) throw new Error("OPERATIONAL_PROFILE_NOT_FOUND");
    const profile = mapProfile(rows[0]);
    if (profile.registrationStatus !== "INVITED") throw new Error("INVALID_OPERATIONAL_STATUS");

    const { rows: revoked } = await client.query(
      `UPDATE operational_invitation
          SET status = 'REVOKED', revoked_at = CURRENT_TIMESTAMP, revoked_by = $2
        WHERE operational_profile_id = $1 AND status = 'PENDING'
        RETURNING id`,
      [operationalProfileId, actorUserId],
    );
    for (const invitation of revoked) {
      await auditEvent(client, {
        actorUserId,
        action: "OPERATIONAL_INVITATION_REVOKED",
        entityType: "operational_invitation",
        entityId: invitation.id,
        after: { reason: "REISSUED" },
      });
    }
    return { profile, invitation: await issueInvitation(client, { actorUserId, operationalProfileId }) };
  });

  const deliveredInvitation = await deliverInvitation({
    profile: created.profile,
    invitation: created.invitation,
    actorUserId,
    sendInvitation,
  });

  return {
    id: deliveredInvitation.id,
    status: "PENDING",
    expiresAt: deliveredInvitation.expiresAt,
    deliveryStatus: deliveredInvitation.deliveryStatus,
    sentAt: deliveredInvitation.sentAt,
  };
}

export async function revokeOperationalInvitation({ actorUserId, operationalProfileId, invitationId }) {
  return inTransaction(async (client) => {
    const { rows } = await client.query(
      `UPDATE operational_invitation
          SET status = 'REVOKED', revoked_at = CURRENT_TIMESTAMP, revoked_by = $3
        WHERE id = $1 AND operational_profile_id = $2 AND status = 'PENDING'
        RETURNING id`,
      [invitationId, operationalProfileId, actorUserId],
    );
    if (rows.length === 0) throw new Error("INVITATION_INVALID");
    await auditEvent(client, {
      actorUserId,
      action: "OPERATIONAL_INVITATION_REVOKED",
      entityType: "operational_invitation",
      entityId: invitationId,
      after: { reason: "ADMIN_REVOKED" },
    });
    return { revoked: true };
  });
}

export async function suspendOperationalProfile({
  actorUserId,
  operationalProfileId,
  revokeSessions = revokeUserSessions,
}) {
  const profile = await inTransaction(async (client) => {
    const { rows } = await client.query(
      `SELECT id, user_id AS "userId", registration_status AS "registrationStatus"
         FROM operational_profile WHERE id = $1 FOR UPDATE`,
      [operationalProfileId],
    );
    if (rows.length === 0) throw new Error("OPERATIONAL_PROFILE_NOT_FOUND");
    if (!["REGISTERED", "SUSPENDED"].includes(rows[0].registrationStatus)) {
      throw new Error("INVALID_OPERATIONAL_STATUS");
    }
    if (rows[0].registrationStatus === "REGISTERED") {
      await client.query(
        "UPDATE operational_profile SET registration_status = 'SUSPENDED' WHERE id = $1",
        [operationalProfileId],
      );
      await auditEvent(client, {
        actorUserId,
        action: "OPERATIONAL_SUSPENDED",
        entityType: "operational_profile",
        entityId: operationalProfileId,
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

export async function reactivateOperationalProfile({
  actorUserId,
  operationalProfileId,
  revokeSessions = revokeUserSessions,
}) {
  const { rows: candidates } = await getPool().query(
    `SELECT user_id AS "userId", registration_status AS "registrationStatus"
       FROM operational_profile WHERE id = $1`,
    [operationalProfileId],
  );
  if (candidates.length === 0) throw new Error("OPERATIONAL_PROFILE_NOT_FOUND");
  if (candidates[0].registrationStatus !== "SUSPENDED") throw new Error("INVALID_OPERATIONAL_STATUS");
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
         FROM operational_profile WHERE id = $1 FOR UPDATE`,
      [operationalProfileId],
    );
    if (rows.length === 0) throw new Error("OPERATIONAL_PROFILE_NOT_FOUND");
    if (rows[0].registrationStatus !== "SUSPENDED") throw new Error("INVALID_OPERATIONAL_STATUS");
    await client.query(
      "UPDATE operational_profile SET registration_status = 'REGISTERED' WHERE id = $1",
      [operationalProfileId],
    );
    await auditEvent(client, {
      actorUserId,
      action: "OPERATIONAL_REACTIVATED",
      entityType: "operational_profile",
      entityId: operationalProfileId,
      before: { registrationStatus: "SUSPENDED" },
      after: { registrationStatus: "REGISTERED" },
    });
    return { reactivated: true };
  });
}

export async function inspectOperationalInvitation({ secret, client = getPool() }) {
  const { rows } = await client.query(
    `SELECT op.email, oi.expires_at AS "expiresAt",
            COALESCE(
              (SELECT array_agg(opr.role_code) FROM operational_profile_role opr
                WHERE opr.operational_profile_id = op.id),
              ARRAY[]::text[]
            ) AS "roles"
       FROM operational_invitation oi
       JOIN operational_profile op ON op.id = oi.operational_profile_id
      WHERE oi.secret_hash = $1
        AND oi.status = 'PENDING'
        AND oi.expires_at > clock_timestamp()
        AND op.registration_status = 'INVITED'`,
    [hashSecret(secret)],
  );
  if (rows.length === 0) throw new Error("INVITATION_INVALID");
  return {
    valid: true,
    maskedEmail: maskEmail(rows[0].email),
    expiresAt: rows[0].expiresAt,
    roles: rows[0].roles,
  };
}

export async function acceptOperationalInvitation({
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
      `UPDATE operational_invitation oi
          SET acceptance_claim_id = $2, acceptance_claimed_at = clock_timestamp()
         FROM operational_profile op
        WHERE oi.secret_hash = $1
          AND op.id = oi.operational_profile_id
          AND oi.status = 'PENDING'
          AND oi.expires_at > clock_timestamp()
          AND op.registration_status = 'INVITED'
          AND (
            oi.acceptance_claim_id IS NULL
            OR oi.acceptance_claimed_at < clock_timestamp() - INTERVAL '5 minutes'
          )
       RETURNING oi.id AS "invitationId", op.id AS "operationalProfileId",
                 op.email, op.name AS "profileName",
                 op.document_number AS "profileDocumentNumber",
                 COALESCE(
                   (SELECT array_agg(opr.role_code) FROM operational_profile_role opr
                     WHERE opr.operational_profile_id = op.id),
                   ARRAY[]::text[]
                 ) AS "roles"`,
      [secretHash, claimId],
    );
    if (rows.length === 0) throw new Error("INVITATION_INVALID");
    return rows[0];
  });

  try {
    const identity = await createUser({
      email: invitation.email,
      name: invitation.profileName,
      password,
    });
    createdUser = identity.user ?? identity;

    return await inTransaction(async (client) => {
      const { rows } = await client.query(
        `SELECT 1
           FROM operational_invitation oi
           JOIN operational_profile op ON op.id = oi.operational_profile_id
          WHERE oi.id = $1
            AND oi.acceptance_claim_id = $2
            AND oi.status = 'PENDING'
            AND oi.expires_at > clock_timestamp()
            AND op.id = $3
            AND op.registration_status = 'INVITED'
          FOR UPDATE OF oi, op`,
        [invitation.invitationId, claimId, invitation.operationalProfileId],
      );
      if (rows.length === 0) throw new Error("INVITATION_INVALID");

      await client.query(
        `UPDATE operational_profile
            SET user_id = $2, registration_status = 'REGISTERED'
          WHERE id = $1`,
        [invitation.operationalProfileId, createdUser.id],
      );

      await client.query(
        `UPDATE operational_invitation
            SET status = 'USED', used_at = CURRENT_TIMESTAMP
          WHERE id = $1`,
        [invitation.invitationId],
      );

      for (const roleCode of invitation.roles) {
        await grantRole({
          client,
          actorUserId: createdUser.id,
          userId: createdUser.id,
          roleCode,
        });
      }

      await auditEvent(client, {
        actorUserId: createdUser.id,
        action: "OPERATIONAL_COMPLETED_REGISTRATION",
        entityType: "operational_profile",
        entityId: invitation.operationalProfileId,
        after: { registrationStatus: "REGISTERED", roles: invitation.roles, invitationId: invitation.invitationId },
      });
      return { accepted: true, next: "TWO_FACTOR_SETUP" };
    });
  } catch (error) {
    if (createdUser?.id) {
      try {
        const { rows } = await getPool().query(
          `SELECT oi.status, op.user_id AS "userId",
                  EXISTS (
                    SELECT 1 FROM user_role ur
                     WHERE ur.user_id = op.user_id
                       AND ur.role_code = ANY(opr.role_code_arr)
                  ) AS "hasAnyRole"
             FROM operational_invitation oi
             JOIN operational_profile op ON op.id = oi.operational_profile_id
             LEFT JOIN LATERAL (
               SELECT array_agg(role_code) AS role_code_arr
                 FROM operational_profile_role
                WHERE operational_profile_id = op.id
             ) opr ON true
            WHERE oi.id = $1`,
          [invitation.invitationId],
        );
        const state = rows[0];
        if (state?.status === "USED" && state.userId === createdUser.id) {
          return { accepted: true, next: "TWO_FACTOR_SETUP" };
        }
      } catch {
        // Preserve the identity: retries can reconcile it without a destructive race.
      }
    }
    try {
      await getPool().query(
        `UPDATE operational_invitation
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
