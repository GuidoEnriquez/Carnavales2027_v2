import { auditEvent } from "../../audit/audit-service.js";
import { getPool } from "../../db/pool.js";

const assignmentTypes = new Set(["PRIMARY", "SUBSTITUTE"]);

function requireText(value, name) {
  if (typeof value !== "string" || value.trim().length === 0) throw new TypeError(`${name} debe ser texto no vacío.`);
  return value.trim();
}

function requirePositiveInteger(value, name) {
  if (!Number.isInteger(value) || value <= 0) throw new TypeError(`${name} debe ser un entero positivo.`);
  return value;
}

function requireAssignmentType(value = "PRIMARY") {
  const type = requireText(value, "assignmentType").toUpperCase();
  if (!assignmentTypes.has(type)) throw new TypeError("assignmentType inválido.");
  return type;
}

function requireReason(value) {
  return requireText(value, "reason");
}

async function inTransaction(operation) {
  const client = await getPool().connect();
  try {
    await client.query("BEGIN");
    const result = await operation(client);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    try { await client.query("ROLLBACK"); } catch { /* Preserve the original failure. */ }
    throw error;
  } finally {
    client.release();
  }
}

async function lockEvent(client, eventId) {
  const { rows } = await client.query(
    "SELECT id, status FROM carnival_event WHERE id = $1 FOR UPDATE",
    [requireText(eventId, "eventId")],
  );
  if (!rows[0]) throw new Error("EVENT_NOT_FOUND");
  return rows[0];
}

async function lockNightSpecialty(client, { eventId, nightId, specialtyId }) {
  const { rows } = await client.query(
    `SELECT n.id AS "nightId", n.kind AS "nightKind", n.status AS "nightStatus",
            s.id AS "specialtyId", s.active AS "specialtyActive"
       FROM night n
       JOIN event_specialty s ON s.event_id = n.event_id
                              AND s.id = $3
      WHERE n.event_id = $1 AND n.id = $2
      FOR UPDATE OF n, s`,
    [eventId, requireText(nightId, "nightId"), requireText(specialtyId, "specialtyId")],
  );
  if (!rows[0]) throw new Error("INVALID_ASSIGNMENT_REFERENCE");
  if (rows[0].nightKind !== "COMPETITION") throw new Error("JUDGE_ASSIGNMENT_COMPETITION_ONLY");
  if (rows[0].nightStatus === "CLOSED") throw new Error("NIGHT_CLOSED");
  if (!rows[0].specialtyActive) throw new Error("SPECIALTY_INACTIVE");
  return rows[0];
}

async function lockQuota(client, { nightId, specialtyId }) {
  const { rows } = await client.query(
    `SELECT id, max_assignments AS "maxAssignments"
       FROM judge_quota
      WHERE night_id = $1 AND specialty_id = $2
      FOR UPDATE`,
    [nightId, specialtyId],
  );
  if (!rows[0]) throw new Error("JUDGE_QUOTA_REQUIRED");
  return rows[0];
}

async function activeCount(client, { nightId, specialtyId }) {
  const { rows } = await client.query(
    `SELECT count(*)::INTEGER AS count
       FROM judge_assignment
      WHERE night_id = $1 AND specialty_id = $2 AND status = 'ACTIVE'`,
    [nightId, specialtyId],
  );
  return rows[0].count;
}

function assignmentView(row) {
  return {
    id: row.id,
    eventId: row.eventId,
    eventName: row.eventName,
    nightId: row.nightId,
    nightName: row.nightName,
    nightStatus: row.nightStatus,
    specialtyId: row.specialtyId,
    specialtyName: row.specialtyName,
    judgeProfileId: row.judgeProfileId,
    judgeName: row.judgeName,
    judgeEmail: row.judgeEmail,
    assignmentType: row.assignmentType,
    status: row.status,
    reason: row.reason,
    replacedAssignmentId: row.replacedAssignmentId,
    revokedAt: row.revokedAt,
    revokedBy: row.revokedBy,
    createdAt: row.createdAt,
  };
}

export async function listEventAssignments({ eventId }) {
  const id = requireText(eventId, "eventId");
  const { rows: events } = await getPool().query("SELECT id FROM carnival_event WHERE id = $1", [id]);
  if (!events[0]) throw new Error("EVENT_NOT_FOUND");
  const { rows: quotas } = await getPool().query(
    `SELECT q.id, q.event_id AS "eventId", q.night_id AS "nightId", n.name AS "nightName",
            q.specialty_id AS "specialtyId", s.name AS "specialtyName",
            q.max_assignments AS "maxAssignments", count(a.id)::INTEGER AS "activeAssignments"
       FROM judge_quota q
       JOIN night n ON n.id = q.night_id
       JOIN event_specialty s ON s.id = q.specialty_id
       LEFT JOIN judge_assignment a ON a.night_id = q.night_id
                                  AND a.specialty_id = q.specialty_id
                                  AND a.status = 'ACTIVE'
      WHERE q.event_id = $1
      GROUP BY q.id, n.name, n.display_order, s.name, s.display_order
      ORDER BY n.display_order, s.display_order`,
    [id],
  );
  const { rows } = await getPool().query(
    `SELECT a.id, a.event_id AS "eventId", e.name AS "eventName",
            a.night_id AS "nightId", n.name AS "nightName", n.status AS "nightStatus",
            a.specialty_id AS "specialtyId", s.name AS "specialtyName",
            a.judge_profile_id AS "judgeProfileId", jp.name AS "judgeName", jp.email AS "judgeEmail",
            a.assignment_type AS "assignmentType", a.status, a.reason,
            a.replaced_assignment_id AS "replacedAssignmentId", a.revoked_at AS "revokedAt",
            a.revoked_by AS "revokedBy", a.created_at AS "createdAt"
       FROM judge_assignment a
       JOIN carnival_event e ON e.id = a.event_id
       JOIN night n ON n.id = a.night_id
       JOIN event_specialty s ON s.id = a.specialty_id
       JOIN judge_profile jp ON jp.id = a.judge_profile_id
      WHERE a.event_id = $1
      ORDER BY n.display_order, s.display_order, a.created_at`,
    [id],
  );
  return { quotas, assignments: rows.map(assignmentView) };
}

export async function setJudgeQuota({ actorUserId, eventId, nightId, specialtyId, maxAssignments }) {
  const value = requirePositiveInteger(maxAssignments, "maxAssignments");
  return inTransaction(async (client) => {
    const event = await lockEvent(client, eventId);
    if (event.status !== "CONFIGURING") throw new Error("EVENT_LOCKED");
    const context = await lockNightSpecialty(client, { eventId, nightId, specialtyId });
    const { rows } = await client.query(
      `INSERT INTO judge_quota (event_id, night_id, specialty_id, max_assignments)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (night_id, specialty_id) DO UPDATE
         SET max_assignments = EXCLUDED.max_assignments, updated_at = CURRENT_TIMESTAMP
       RETURNING id, event_id AS "eventId", night_id AS "nightId", specialty_id AS "specialtyId",
                 max_assignments AS "maxAssignments"`,
      [eventId, context.nightId, context.specialtyId, value],
    );
    const result = { ...rows[0], activeAssignments: await activeCount(client, context) };
    await auditEvent(client, {
      actorUserId,
      action: "JUDGE_QUOTA_UPDATED",
      entityType: "judge_quota",
      entityId: result.id,
      after: result,
    });
    return result;
  });
}

export async function createJudgeAssignment({
  actorUserId,
  eventId,
  nightId,
  specialtyId,
  judgeProfileId,
  assignmentType = "PRIMARY",
}) {
  const type = requireAssignmentType(assignmentType);
  return inTransaction(async (client) => {
    const event = await lockEvent(client, eventId);
    if (event.status !== "CONFIGURING") throw new Error("JUDGE_ASSIGNMENT_OPEN_REQUIRES_REPLACEMENT");
    const context = await lockNightSpecialty(client, { eventId, nightId, specialtyId });
    const quota = await lockQuota(client, context);
    const { rows: judges } = await client.query(
      `SELECT id, name, email FROM judge_profile
        WHERE id = $1 AND registration_status = 'REGISTERED'
        FOR UPDATE`,
      [requireText(judgeProfileId, "judgeProfileId")],
    );
    if (!judges[0]) throw new Error("JUDGE_NOT_ASSIGNABLE");
    const { rows: duplicate } = await client.query(
      "SELECT 1 FROM judge_assignment WHERE judge_profile_id = $1 AND night_id = $2 AND status = 'ACTIVE'",
      [judges[0].id, nightId],
    );
    if (duplicate.length > 0) throw new Error("JUDGE_ALREADY_ASSIGNED");
    const count = await activeCount(client, context);
    if (count >= quota.maxAssignments) throw new Error("JUDGE_QUOTA_FULL");
    const { rows } = await client.query(
      `INSERT INTO judge_assignment (event_id, night_id, specialty_id, judge_profile_id, assignment_type)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, event_id AS "eventId", night_id AS "nightId", specialty_id AS "specialtyId",
                 judge_profile_id AS "judgeProfileId", assignment_type AS "assignmentType", status, created_at AS "createdAt"`,
      [eventId, nightId, specialtyId, judges[0].id, type],
    );
    const result = rows[0];
    await auditEvent(client, {
      actorUserId,
      action: "JUDGE_ASSIGNMENT_CREATED",
      entityType: "judge_assignment",
      entityId: result.id,
      after: result,
    });
    return result;
  });
}

async function lockAssignmentContext(client, assignmentId) {
  const { rows } = await client.query(
    `SELECT a.*, e.status AS "eventStatus", n.status AS "nightStatus", n.kind AS "nightKind"
       FROM judge_assignment a
       JOIN carnival_event e ON e.id = a.event_id
       JOIN night n ON n.id = a.night_id
      WHERE a.id = $1
      FOR UPDATE OF a`,
    [requireText(assignmentId, "assignmentId")],
  );
  if (!rows[0]) throw new Error("JUDGE_ASSIGNMENT_NOT_FOUND");
  return rows[0];
}

function ensureAssignmentChangeAllowed(assignment) {
  if (assignment.nightKind !== "COMPETITION") throw new Error("JUDGE_ASSIGNMENT_COMPETITION_ONLY");
  if (assignment.nightStatus === "CLOSED") throw new Error("NIGHT_CLOSED");
  if (!["CONFIGURING", "OPEN"].includes(assignment.eventStatus)) throw new Error("EVENT_LOCKED");
  if (assignment.status !== "ACTIVE") throw new Error("JUDGE_ASSIGNMENT_FINAL");
}

export async function revokeJudgeAssignment({ actorUserId, assignmentId, reason }) {
  const actionReason = requireReason(reason);
  return inTransaction(async (client) => {
    const assignment = await lockAssignmentContext(client, assignmentId);
    await client.query("SELECT id FROM carnival_event WHERE id = $1 FOR UPDATE", [assignment.event_id]);
    ensureAssignmentChangeAllowed(assignment);
    const { rows } = await client.query(
      `UPDATE judge_assignment
          SET status = 'REVOKED', reason = $2, revoked_at = clock_timestamp(), revoked_by = $3
        WHERE id = $1
        RETURNING id, status, reason, revoked_at AS "revokedAt", revoked_by AS "revokedBy"`,
      [assignment.id, actionReason, actorUserId],
    );
    const result = rows[0];
    await auditEvent(client, {
      actorUserId,
      action: "JUDGE_ASSIGNMENT_REVOKED",
      entityType: "judge_assignment",
      entityId: result.id,
      before: { status: assignment.status, judgeProfileId: assignment.judge_profile_id },
      after: { ...result, nightId: assignment.night_id, specialtyId: assignment.specialty_id },
    });
    return result;
  });
}

export async function replaceJudgeAssignment({
  actorUserId,
  assignmentId,
  replacementJudgeProfileId,
  assignmentType = "PRIMARY",
  reason,
}) {
  const type = requireAssignmentType(assignmentType);
  const actionReason = requireReason(reason);
  return inTransaction(async (client) => {
    const assignment = await lockAssignmentContext(client, assignmentId);
    await client.query("SELECT id FROM carnival_event WHERE id = $1 FOR UPDATE", [assignment.event_id]);
    ensureAssignmentChangeAllowed(assignment);
    const { rows: judges } = await client.query(
      `SELECT id, name, email FROM judge_profile
        WHERE id = $1 AND registration_status = 'REGISTERED'
        FOR UPDATE`,
      [requireText(replacementJudgeProfileId, "replacementJudgeProfileId")],
    );
    if (!judges[0]) throw new Error("JUDGE_NOT_ASSIGNABLE");
    if (judges[0].id === assignment.judge_profile_id) throw new Error("JUDGE_ALREADY_ASSIGNED");
    const context = await lockNightSpecialty(client, {
      eventId: assignment.event_id,
      nightId: assignment.night_id,
      specialtyId: assignment.specialty_id,
    });
    await lockQuota(client, context);
    const { rows: duplicate } = await client.query(
      "SELECT 1 FROM judge_assignment WHERE judge_profile_id = $1 AND night_id = $2 AND status = 'ACTIVE'",
      [judges[0].id, assignment.night_id],
    );
    if (duplicate.length > 0) throw new Error("JUDGE_ALREADY_ASSIGNED");
    await client.query(
      `UPDATE judge_assignment
          SET status = 'REVOKED', reason = $2, revoked_at = clock_timestamp(), revoked_by = $3
        WHERE id = $1`,
      [assignment.id, actionReason, actorUserId],
    );
    const { rows } = await client.query(
      `INSERT INTO judge_assignment (
         event_id, night_id, specialty_id, judge_profile_id, assignment_type,
         reason, replaced_assignment_id
       ) VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING id, event_id AS "eventId", night_id AS "nightId", specialty_id AS "specialtyId",
                 judge_profile_id AS "judgeProfileId", assignment_type AS "assignmentType", status,
                 reason, replaced_assignment_id AS "replacedAssignmentId", created_at AS "createdAt"`,
      [assignment.event_id, assignment.night_id, assignment.specialty_id, judges[0].id, type, actionReason, assignment.id],
    );
    const result = rows[0];
    await auditEvent(client, {
      actorUserId,
      action: "JUDGE_ASSIGNMENT_REPLACED",
      entityType: "judge_assignment",
      entityId: result.id,
      before: {
        id: assignment.id,
        judgeProfileId: assignment.judge_profile_id,
        assignmentType: assignment.assignment_type,
        status: "ACTIVE",
      },
      after: result,
    });
    return result;
  });
}

export async function listJudgeAssignments({ userId }) {
  const normalizedUserId = requireText(userId, "userId");
  const { rows: profiles } = await getPool().query(
    `SELECT registration_status AS "registrationStatus"
       FROM judge_profile WHERE user_id = $1`,
    [normalizedUserId],
  );
  if (!profiles[0]) throw new Error("JUDGE_PROFILE_REQUIRED");
  if (profiles[0].registrationStatus === "SUSPENDED") throw new Error("JUDGE_SUSPENDED");
  if (profiles[0].registrationStatus !== "REGISTERED") throw new Error("JUDGE_INACTIVE");
  const { rows } = await getPool().query(
    `SELECT a.id, a.event_id AS "eventId", e.name AS "eventName",
            a.night_id AS "nightId", n.name AS "nightName", n.status AS "nightStatus",
            a.specialty_id AS "specialtyId", s.name AS "specialtyName",
            a.judge_profile_id AS "judgeProfileId", jp.name AS "judgeName", jp.email AS "judgeEmail",
            a.assignment_type AS "assignmentType", a.status, a.reason,
            a.replaced_assignment_id AS "replacedAssignmentId", a.revoked_at AS "revokedAt",
            a.revoked_by AS "revokedBy", a.created_at AS "createdAt"
       FROM judge_assignment a
       JOIN carnival_event e ON e.id = a.event_id
       JOIN night n ON n.id = a.night_id
       JOIN event_specialty s ON s.id = a.specialty_id
       JOIN judge_profile jp ON jp.id = a.judge_profile_id
      WHERE jp.user_id = $1 AND jp.registration_status = 'REGISTERED' AND a.status = 'ACTIVE'
      ORDER BY n.event_date NULLS LAST, n.display_order, s.display_order`,
    [normalizedUserId],
  );
  return rows.map(assignmentView);
}
