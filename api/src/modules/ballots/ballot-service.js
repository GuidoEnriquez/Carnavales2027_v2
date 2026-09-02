import { auditEvent } from "../../audit/audit-service.js";
import { getPool } from "../../db/pool.js";
import { createHash } from "node:crypto";

function requireText(value, name) {
  if (typeof value !== "string" || value.trim().length === 0) throw new TypeError(`${name} debe ser texto no vacío.`);
  return value.trim();
}

function requireInteger(value, name, { min, max } = {}) {
  const n = Number(value);
  if (!Number.isInteger(n) || n < min || n > max) throw new TypeError(`${name} debe ser un entero entre ${min} y ${max}.`);
  return n;
}

function requireUuid(value, name) {
  const text = requireText(value, name);
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(text)) {
    throw new TypeError(`${name} debe ser un UUID válido.`);
  }
  return text;
}

function requireEvaluationDecision(evaluationState, score) {
  if (!["PENDING", "SCORED", "NOT_PRESENTED"].includes(evaluationState)) {
    throw new TypeError("evaluationState debe ser PENDING, SCORED o NOT_PRESENTED.");
  }
  if (evaluationState === "PENDING") {
    if (score !== undefined && score !== null) throw new TypeError("PENDING no admite score.");
    return { evaluationState, score: null };
  }
  if (evaluationState === "SCORED") {
    return { evaluationState, score: requireInteger(score, "score", { min: 1, max: 10 }) };
  }
  if (score !== undefined && score !== null && Number(score) !== 0) {
    throw new TypeError("NOT_PRESENTED solo admite score 0.");
  }
  return { evaluationState, score: 0 };
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

async function auditBallot(client, { ballotId, eventId, action, actorUserId, reason, details }) {
  await client.query(
    `INSERT INTO ballot_audit_log (ballot_id, event_id, action, actor_id, reason, details)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [ballotId, eventId, action, actorUserId, reason || null, details ? JSON.stringify(details) : null],
  );
}

async function lockJudgeBallot(client, { ballotId, actorUserId }) {
  const { rows: ballots } = await client.query(
    `SELECT b.id, b.event_id AS "eventId", b.status, b.revision,
            b.judge_profile_id AS "judgeProfileId", jp.user_id AS "userId"
       FROM ballot b
       JOIN judge_profile jp ON jp.id = b.judge_profile_id
        JOIN judge_assignment ja ON ja.id = b.judge_assignment_id
                                AND ja.status = 'ACTIVE' AND ja.assignment_type = 'PRIMARY'
       WHERE b.id = $1 AND b.status <> 'REPLACED' FOR UPDATE`,
    [ballotId],
  );
  if (!ballots[0]) throw new Error("BALLOT_NOT_FOUND");
  if (ballots[0].userId !== actorUserId) throw new Error("BALLOT_ACCESS_DENIED");
  return ballots[0];
}

async function incrementBallotRevision(client, ballotId) {
  const { rows } = await client.query(
    `UPDATE ballot
        SET revision = revision + 1, updated_at = clock_timestamp()
      WHERE id = $1
      RETURNING revision`,
    [ballotId],
  );
  return Number(rows[0].revision);
}

async function saveScoreLocked(client, { ballot, actorUserId, ballotId, scoreId, evaluationState, score }) {
  const decision = requireEvaluationDecision(evaluationState, score);
  if (ballot.status === "SUBMITTED") throw new Error("BALLOT_ALREADY_SUBMITTED");
  const { rows: scores } = await client.query(
    `SELECT bs.id, bs.status, bs.evaluation_state AS "evaluationState" FROM ballot_score bs
      WHERE bs.id = $1 AND bs.ballot_id = $2 FOR UPDATE`,
    [scoreId, ballotId],
  );
  if (!scores[0]) throw new Error("SCORE_NOT_FOUND");
  if (scores[0].status === "LOCKED") throw new Error("BALLOT_SCORE_IMMUTABLE");
  if (scores[0].evaluationState === "SCORED" || scores[0].evaluationState === "NOT_PRESENTED") {
    const error = new Error("SCORE_IMMUTABLE");
    error.code = "SCORE_IMMUTABLE";
    throw error;
  }
  const { rows } = await client.query(
    `UPDATE ballot_score
        SET score = $3, evaluation_state = $4, updated_at = clock_timestamp()
      WHERE id = $1 AND ballot_id = $2
      RETURNING id, score, evaluation_state AS "evaluationState", status`,
    [scoreId, ballotId, decision.score, decision.evaluationState],
  );
  const revision = await incrementBallotRevision(client, ballotId);
  await auditBallot(client, {
    ballotId,
    eventId: ballot.eventId,
    action: "SCORE_DECISION_SAVED",
    actorUserId,
    details: { scoreId },
  });
  return { ...rows[0], revision };
}

async function submitBallotLocked(client, { ballot, actorUserId, ballotId }) {
  if (ballot.status === "SUBMITTED") throw new Error("BALLOT_ALREADY_SUBMITTED");
  const { rows: pending } = await client.query(
    `SELECT bs.id, ei.name AS "itemName", ei.code AS "itemCode"
       FROM ballot_score bs
       JOIN evaluation_item ei ON ei.id = bs.evaluation_item_id
      WHERE bs.ballot_id = $1 AND bs.evaluation_state = 'PENDING' AND bs.status = 'DRAFT'`,
    [ballotId],
  );
  if (pending.length > 0) {
    const error = new Error("BALLOT_INCOMPLETE");
    error.pending = pending.map((item) => ({ id: item.id, name: item.itemName, code: item.itemCode }));
    throw error;
  }
  const { rows } = await client.query(
    `UPDATE ballot
        SET status = 'SUBMITTED', submitted_at = clock_timestamp(), revision = revision + 1,
            updated_at = clock_timestamp()
      WHERE id = $1
      RETURNING id, status, submitted_at AS "submittedAt", revision`,
    [ballotId],
  );
  await client.query(
    `UPDATE ballot_score SET status = 'LOCKED', locked_at = clock_timestamp(), updated_at = clock_timestamp()
      WHERE ballot_id = $1 AND status = 'DRAFT'`,
    [ballotId],
  );
  await auditBallot(client, {
    ballotId,
    eventId: ballot.eventId,
    action: "BALLOT_SUBMITTED",
    actorUserId,
    details: { judgeProfileId: ballot.judgeProfileId },
  });
  return { ...rows[0], revision: Number(rows[0].revision) };
}

function normalizeSyncOperations(value) {
  if (!Array.isArray(value) || value.length === 0 || value.length > 100) {
    throw new TypeError("operations debe contener entre 1 y 100 operaciones.");
  }
  return value.map((operation) => {
    const operationId = requireUuid(operation?.operationId, "operationId");
    if (operation?.type === "SAVE_SCORE") {
      const decision = requireEvaluationDecision(operation.evaluationState, operation.score);
      return { operationId, type: "SAVE_SCORE", scoreId: requireUuid(operation.scoreId, "scoreId"), ...decision };
    }
    if (operation?.type === "SUBMIT_BALLOT") return { operationId, type: "SUBMIT_BALLOT" };
    throw new TypeError("type debe ser SAVE_SCORE o SUBMIT_BALLOT.");
  });
}

function operationHash(operation) {
  return createHash("sha256").update(JSON.stringify(operation)).digest("hex");
}

export async function createBallotsForNight(client, { eventId, nightId, actorUserId }) {
  const { rows: assignments } = await client.query(
    `SELECT a.id AS "assignmentId", a.judge_profile_id AS "judgeProfileId",
            a.specialty_id AS "specialtyId"
       FROM judge_assignment a
       WHERE a.event_id = $1 AND a.night_id = $2
         AND a.status = 'ACTIVE' AND a.assignment_type = 'PRIMARY'`,
    [eventId, nightId],
  );
  const created = [];
  for (const assignment of assignments) {
    const { rows: existing } = await client.query(
      "SELECT id FROM ballot WHERE judge_profile_id = $1 AND night_id = $2 AND status <> 'REPLACED'",
      [assignment.judgeProfileId, nightId],
    );
    if (existing.length > 0) continue;

    const { rows } = await client.query(
      `INSERT INTO ballot (event_id, night_id, judge_assignment_id, judge_profile_id, specialty_id)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, event_id AS "eventId", night_id AS "nightId",
                 judge_profile_id AS "judgeProfileId", specialty_id AS "specialtyId",
                 status, opened_at AS "openedAt"`,
      [eventId, nightId, assignment.assignmentId, assignment.judgeProfileId, assignment.specialtyId],
    );
    const ballot = rows[0];

    const { rows: items } = await client.query(
      `SELECT ei.id AS "itemId", ei.rubric_id AS "rubricId"
         FROM evaluation_item ei
        WHERE ei.event_id = $1 AND ei.specialty_id = $2 AND ei.active = true`,
      [eventId, assignment.specialtyId],
    );

    const { rows: schedules } = await client.query(
      `SELECT id AS "scheduleId"
         FROM night_troupe_schedule
        WHERE event_id = $1 AND night_id = $2 AND status = 'SCHEDULED'`,
      [eventId, nightId],
    );

    for (const schedule of schedules) {
      for (const item of items) {
        await client.query(
          `INSERT INTO ballot_score (ballot_id, event_id, evaluation_item_id, rubric_id, night_schedule_id)
           VALUES ($1, $2, $3, $4, $5)
           ON CONFLICT (ballot_id, evaluation_item_id, night_schedule_id) DO NOTHING`,
          [ballot.id, eventId, item.itemId, item.rubricId, schedule.scheduleId],
        );
      }
    }

    await auditBallot(client, {
      ballotId: ballot.id,
      eventId,
      action: "BALLOT_OPENED",
      actorUserId,
      details: { nightId, judgeProfileId: assignment.judgeProfileId, specialtyId: assignment.specialtyId },
    });
    created.push(ballot);
  }
  return created;
}

export async function openVoting({ actorUserId, eventId, nightId }) {
  return inTransaction(async (client) => {
    const event = await lockEvent(client, eventId);
    if (event.status !== "OPEN") throw new Error("EVENT_NOT_OPEN");

    const { rows: nights } = await client.query(
      `SELECT id, status, kind FROM night WHERE id = $1 AND event_id = $2 FOR UPDATE`,
      [requireText(nightId, "nightId"), eventId],
    );
    if (!nights[0]) throw new Error("NIGHT_NOT_FOUND");
    if (nights[0].kind !== "COMPETITION") throw new Error("VOTING_COMPETITION_ONLY");
    if (nights[0].status !== "OPEN") throw new Error("NIGHT_NOT_OPEN");

    const { rows: windows } = await client.query(
      "SELECT status FROM voting_window WHERE night_id = $1 FOR UPDATE",
      [nights[0].id],
    );
    if (windows[0]?.status === "CLOSED") throw new Error("VOTING_WINDOW_CLOSED");
    if (!windows[0]) {
      await client.query(
        "INSERT INTO voting_window (night_id, event_id, status) VALUES ($1, $2, 'OPEN')",
        [nights[0].id, eventId],
      );
    }

    const created = await createBallotsForNight(client, { eventId, nightId: nights[0].id, actorUserId });
    await auditEvent(client, {
      actorUserId,
      action: "VOTING_OPENED",
      entityType: "night",
      entityId: nights[0].id,
      after: { eventId, ballotsCreated: created.length },
    });
    return { nightId: nights[0].id, ballotsCreated: created.length };
  });
}

export async function closeVoting({ actorUserId, eventId, nightId }) {
  return inTransaction(async (client) => {
    const event = await lockEvent(client, eventId);
    if (event.status !== "OPEN") throw new Error("EVENT_NOT_OPEN");

    const { rows: nights } = await client.query(
      `SELECT id, status, kind FROM night WHERE id = $1 AND event_id = $2 FOR UPDATE`,
      [requireText(nightId, "nightId"), eventId],
    );
    if (!nights[0]) throw new Error("NIGHT_NOT_FOUND");

    const { rows: windows } = await client.query(
      "SELECT status FROM voting_window WHERE night_id = $1 AND event_id = $2 FOR UPDATE",
      [nights[0].id, eventId],
    );
    if (!windows[0] || windows[0].status !== "OPEN") throw new Error("VOTING_WINDOW_NOT_OPEN");

    await client.query(
      `SELECT id FROM ballot
        WHERE night_id = $1 AND event_id = $2 AND status IN ('OPEN', 'REOPENED')
        FOR UPDATE`,
      [nights[0].id, eventId],
    );
    await client.query(
      `SELECT bs.id, ei.name AS "itemName", ei.code AS "itemCode"
         FROM ballot_score bs
         JOIN ballot b ON b.id = bs.ballot_id
         JOIN evaluation_item ei ON ei.id = bs.evaluation_item_id
        WHERE b.night_id = $1 AND b.event_id = $2 AND b.status IN ('OPEN', 'REOPENED')
        FOR UPDATE OF bs`,
      [nights[0].id, eventId],
    );

    const { rows: pending } = await client.query(
      `SELECT bs.id, b.id AS "ballotId", ei.name AS "itemName", ei.code AS "itemCode",
              r.name AS "rubricName", jp.name AS "judgeName", et.name AS "troupeName"
         FROM ballot_score bs
         JOIN ballot b ON b.id = bs.ballot_id
         JOIN evaluation_item ei ON ei.id = bs.evaluation_item_id
         JOIN rubric r ON r.id = bs.rubric_id
         JOIN judge_profile jp ON jp.id = b.judge_profile_id
         JOIN night_troupe_schedule nts ON nts.id = bs.night_schedule_id
         JOIN event_troupe et ON et.id = nts.event_troupe_id
         WHERE b.night_id = $1 AND b.event_id = $2
           AND b.status IN ('OPEN', 'REOPENED')
            AND bs.evaluation_state = 'PENDING'
         ORDER BY jp.name, et.name, ei.name, bs.id`,
      [nights[0].id, eventId],
    );
    if (pending.length > 0) {
      const error = new Error("VOTING_CLOSE_INCOMPLETE_BALLOTS");
      error.pending = pending.map((item) => ({
        id: item.id,
        ballotId: item.ballotId,
        name: item.itemName,
        code: item.itemCode,
        rubricName: item.rubricName,
        judgeName: item.judgeName,
        troupeName: item.troupeName,
      }));
      throw error;
    }

    const { rows: openBallots } = await client.query(
      `UPDATE ballot SET status = 'SUBMITTED', submitted_at = clock_timestamp(), revision = revision + 1,
              updated_at = clock_timestamp()
        WHERE night_id = $1 AND event_id = $2 AND status IN ('OPEN', 'REOPENED')
        RETURNING id`,
      [nights[0].id, eventId],
    );

    await client.query(
      `UPDATE ballot_score
          SET status = 'LOCKED', locked_at = clock_timestamp(), updated_at = clock_timestamp()
        WHERE ballot_id = ANY($1::uuid[]) AND status = 'DRAFT'`,
      [openBallots.map((ballot) => ballot.id)],
    );

    await client.query(
      "UPDATE voting_window SET status = 'CLOSED' WHERE night_id = $1",
      [nights[0].id],
    );

    await auditEvent(client, {
      actorUserId,
      action: "VOTING_CLOSED",
      entityType: "night",
      entityId: nights[0].id,
      after: { eventId, autoSubmitted: openBallots.length },
    });
    return { nightId: nights[0].id, autoSubmitted: openBallots.length };
  });
}

export async function getVotingStatus({ eventId, nightId }) {
  const id = requireText(eventId, "eventId");
  const nid = requireText(nightId, "nightId");
  const { rows: events } = await getPool().query("SELECT id FROM carnival_event WHERE id = $1", [id]);
  if (!events[0]) throw new Error("EVENT_NOT_FOUND");
  const { rows: nights } = await getPool().query(
    "SELECT id, status, kind FROM night WHERE id = $1 AND event_id = $2",
    [nid, id],
  );
  if (!nights[0]) throw new Error("NIGHT_NOT_FOUND");
  const { rows } = await getPool().query(
    `SELECT status, count(*)::INTEGER AS count
       FROM ballot
      WHERE night_id = $1 AND event_id = $2
      GROUP BY status`,
    [nid, id],
  );
  const { rows: windows } = await getPool().query(
    "SELECT status FROM voting_window WHERE night_id = $1 AND event_id = $2",
    [nid, id],
  );
  const counts = { OPEN: 0, SUBMITTED: 0, REOPENED: 0, REPLACED: 0 };
  for (const row of rows) counts[row.status] = row.count;
  return {
    nightId: nid,
    nightStatus: nights[0].status,
    votingStatus: windows[0]?.status ?? "NOT_OPEN",
    counts,
    total: counts.OPEN + counts.SUBMITTED + counts.REOPENED,
  };
}

export async function listJudgeBallots({ userId }) {
  const { rows } = await getPool().query(
    `SELECT b.id, b.status, b.night_id AS "nightId", b.submitted_at AS "submittedAt",
            b.reopened_at AS "reopenedAt", e.name AS "eventName", n.name AS "nightName",
            s.name AS "specialtyName"
       FROM ballot b
        JOIN judge_profile jp ON jp.id = b.judge_profile_id
         JOIN judge_assignment ja ON ja.id = b.judge_assignment_id
                                 AND ja.status = 'ACTIVE' AND ja.assignment_type = 'PRIMARY'
       JOIN carnival_event e ON e.id = b.event_id
       JOIN night n ON n.id = b.night_id
       JOIN event_specialty s ON s.id = b.specialty_id
      WHERE jp.user_id = $1
      ORDER BY n.event_date NULLS LAST, n.display_order, s.name`,
    [requireText(userId, "userId")],
  );
  return rows;
}

export async function getBallot({ ballotId, userId }) {
  const id = requireText(ballotId, "ballotId");
  const { rows: ballots } = await getPool().query(
    `SELECT b.id, b.event_id AS "eventId", b.night_id AS "nightId",
            b.judge_profile_id AS "judgeProfileId", b.specialty_id AS "specialtyId",
             b.status, b.revision, b.opened_at AS "openedAt", b.submitted_at AS "submittedAt",
            b.reopened_at AS "reopenedAt", b.reopen_count AS "reopenCount",
            jp.user_id AS "userId", jp.name AS "judgeName", jp.email AS "judgeEmail",
            e.name AS "eventName", n.name AS "nightName", s.name AS "specialtyName"
       FROM ballot b
        JOIN judge_profile jp ON jp.id = b.judge_profile_id
         JOIN judge_assignment ja ON ja.id = b.judge_assignment_id
                                 AND ja.status = 'ACTIVE' AND ja.assignment_type = 'PRIMARY'
       JOIN carnival_event e ON e.id = b.event_id
       JOIN night n ON n.id = b.night_id
       JOIN event_specialty s ON s.id = b.specialty_id
      WHERE b.id = $1`,
    [id],
  );
  if (!ballots[0]) throw new Error("BALLOT_NOT_FOUND");
  const ballot = ballots[0];

  if (userId && ballot.userId !== userId) throw new Error("BALLOT_ACCESS_DENIED");

  const { rows: scores } = await getPool().query(
    `SELECT bs.id, bs.evaluation_item_id AS "evaluationItemId",
            ei.name AS "itemName", ei.code AS "itemCode",
            r.name AS "rubricName", r.code AS "rubricCode",
             bs.rubric_id AS "rubricId", bs.night_schedule_id AS "nightScheduleId",
             nts.presentation_order AS "presentationOrder",
             et.name AS "troupeName",
             bs.score, bs.evaluation_state AS "evaluationState",
            bs.status, bs.locked_at AS "lockedAt"
       FROM ballot_score bs
       JOIN evaluation_item ei ON ei.id = bs.evaluation_item_id
       JOIN rubric r ON r.id = bs.rubric_id
       JOIN night_troupe_schedule nts ON nts.id = bs.night_schedule_id
       JOIN event_troupe et ON et.id = nts.event_troupe_id
      WHERE bs.ballot_id = $1
      ORDER BY nts.presentation_order, r.name, ei.name`,
    [id],
  );

  return {
    id: ballot.id,
    eventId: ballot.eventId,
    nightId: ballot.nightId,
    judgeProfileId: ballot.judgeProfileId,
    specialtyId: ballot.specialtyId,
    status: ballot.status,
    revision: Number(ballot.revision),
    openedAt: ballot.openedAt,
    submittedAt: ballot.submittedAt,
    reopenedAt: ballot.reopenedAt,
    reopenCount: ballot.reopenCount,
    judgeName: ballot.judgeName,
    judgeEmail: ballot.judgeEmail,
    eventName: ballot.eventName,
    nightName: ballot.nightName,
    specialtyName: ballot.specialtyName,
    scores: scores.map((s) => ({
      id: s.id,
      evaluationItemId: s.evaluationItemId,
      itemName: s.itemName,
      itemCode: s.itemCode,
      rubricName: s.rubricName,
      rubricCode: s.rubricCode,
      rubricId: s.rubricId,
       nightScheduleId: s.nightScheduleId,
       presentationOrder: s.presentationOrder,
        troupeName: s.troupeName,
        score: s.score,
       evaluationState: s.evaluationState,
      status: s.status,
      lockedAt: s.lockedAt,
    })),
  };
}

export async function saveScore({ actorUserId, ballotId, scoreId, evaluationState, score }) {
  const bid = requireText(ballotId, "ballotId");
  const sid = requireText(scoreId, "scoreId");

  return inTransaction(async (client) => {
    const ballot = await lockJudgeBallot(client, { ballotId: bid, actorUserId });
    const saved = await saveScoreLocked(client, {
      ballot,
      actorUserId,
      ballotId: bid,
      scoreId: sid,
      evaluationState,
      score,
    });
    return saved;
  });
}

export async function submitBallot({ actorUserId, ballotId }) {
  const bid = requireText(ballotId, "ballotId");

  return inTransaction(async (client) => {
    const ballot = await lockJudgeBallot(client, { ballotId: bid, actorUserId });
    return submitBallotLocked(client, { ballot, actorUserId, ballotId: bid });
  });
}

export async function syncBallot({ actorUserId, ballotId, baseRevision, operations }) {
  const bid = requireText(ballotId, "ballotId");
  const revision = requireInteger(baseRevision, "baseRevision", { min: 0, max: Number.MAX_SAFE_INTEGER });
  const normalized = normalizeSyncOperations(operations);
  const hashes = new Map(normalized.map((operation) => [operation.operationId, operationHash(operation)]));
  if (hashes.size !== normalized.length) throw new TypeError("operationId no puede repetirse en un lote.");

  return inTransaction(async (client) => {
    const ballot = await lockJudgeBallot(client, { ballotId: bid, actorUserId });
    const { rows: existing } = await client.query(
      `SELECT operation_id AS "operationId", content_hash AS "contentHash", applied_revision AS "appliedRevision"
         FROM ballot_sync_operation
        WHERE actor_user_id = $1 AND ballot_id = $2 AND operation_id = ANY($3::uuid[])`,
      [actorUserId, bid, normalized.map((operation) => operation.operationId)],
    );
    if (existing.length > 0) {
      for (const row of existing) {
        if (row.contentHash !== hashes.get(row.operationId)) throw new Error("SYNC_OPERATION_MISMATCH");
      }
      if (existing.length !== normalized.length) throw new Error("SYNC_BATCH_MIXED_RETRY");
      return {
        ballotId: bid,
        revision: Number(ballot.revision),
        operations: normalized.map((operation) => {
          const row = existing.find((item) => item.operationId === operation.operationId);
          return { operationId: operation.operationId, status: "ACCEPTED", revision: Number(row.appliedRevision) };
        }),
      };
    }
    if (Number(ballot.revision) !== revision) {
      const error = new Error("BALLOT_REVISION_CONFLICT");
      error.details = { revision: Number(ballot.revision) };
      throw error;
    }

    const accepted = [];
    for (const operation of normalized) {
      const result = operation.type === "SAVE_SCORE"
        ? await saveScoreLocked(client, {
          ballot,
          actorUserId,
          ballotId: bid,
          scoreId: operation.scoreId,
          evaluationState: operation.evaluationState,
          score: operation.score,
        })
        : await submitBallotLocked(client, { ballot, actorUserId, ballotId: bid });
      if (operation.type === "SUBMIT_BALLOT") ballot.status = result.status;
      ballot.revision = result.revision;
      await client.query(
        `INSERT INTO ballot_sync_operation
          (actor_user_id, ballot_id, operation_id, operation_type, content_hash, applied_revision)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [actorUserId, bid, operation.operationId, operation.type, hashes.get(operation.operationId), result.revision],
      );
      accepted.push({ operationId: operation.operationId, status: "ACCEPTED", revision: result.revision });
    }
    return { ballotId: bid, revision: Number(ballot.revision), operations: accepted };
  });
}

export async function listNightBallots({ eventId, nightId }) {
  const id = requireText(eventId, "eventId");
  const nid = requireText(nightId, "nightId");
  const { rows } = await getPool().query(
    `SELECT b.id, b.status, b.judge_profile_id AS "judgeProfileId",
            jp.name AS "judgeName", jp.email AS "judgeEmail",
            s.name AS "specialtyName", b.submitted_at AS "submittedAt",
            b.reopened_at AS "reopenedAt", b.reopen_count AS "reopenCount"
       FROM ballot b
       JOIN judge_profile jp ON jp.id = b.judge_profile_id
       JOIN event_specialty s ON s.id = b.specialty_id
      WHERE b.event_id = $1 AND b.night_id = $2
      ORDER BY jp.name`,
    [id, nid],
  );
  return rows;
}
