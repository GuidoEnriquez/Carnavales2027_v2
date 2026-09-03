import { getPool } from "../../db/pool.js";
import { auditEvent } from "../../audit/audit-service.js";

function requireText(value, fieldName) {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new TypeError(`${fieldName} debe ser texto no vacío.`);
  }
  return value.trim();
}

function requirePositiveInteger(value, fieldName) {
  const num = Number(value);
  if (!Number.isInteger(num) || num <= 0) {
    throw new TypeError(`${fieldName} debe ser un número entero mayor a 0.`);
  }
  return num;
}

export async function createTroupePenalty({
  eventId,
  nightId,
  eventTroupeId,
  reason,
  penaltyPoints,
  actorUserId,
}) {
  requireText(eventId, "eventId");
  requireText(nightId, "nightId");
  requireText(eventTroupeId, "eventTroupeId");
  const cleanReason = requireText(reason, "reason");
  const points = requirePositiveInteger(penaltyPoints, "penaltyPoints");
  requireText(actorUserId, "actorUserId");

  const pool = getPool();
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // Verificar si el evento ya fue liberado
    const { rows: releaseRows } = await client.query(
      "SELECT 1 FROM results_release WHERE event_id = $1",
      [eventId],
    );
    if (releaseRows.length > 0) {
      throw new Error("RESULTS_ALREADY_RELEASED");
    }

    // Verificar jornada competitiva del mismo evento
    const { rows: nightRows } = await client.query(
      "SELECT id, kind FROM night WHERE id = $1 AND event_id = $2",
      [nightId, eventId],
    );
    if (nightRows.length === 0) {
      throw new Error("NIGHT_NOT_FOUND");
    }
    if (nightRows[0].kind !== "COMPETITION") {
      throw new Error("PENALTY_REQUIRES_COMPETITION_NIGHT");
    }

    // Verificar comparsa del mismo evento
    const { rows: troupeRows } = await client.query(
      "SELECT id, name FROM event_troupe WHERE id = $1 AND event_id = $2",
      [eventTroupeId, eventId],
    );
    if (troupeRows.length === 0) {
      throw new Error("TROUPE_NOT_FOUND");
    }

    const { rows: [penalty] } = await client.query(
      `INSERT INTO troupe_penalty (
         event_id, night_id, event_troupe_id, reason, penalty_points, status, applied_by_user_id
       ) VALUES ($1, $2, $3, $4, $5, 'APPLIED', $6)
       RETURNING id, event_id as "eventId", night_id as "nightId", event_troupe_id as "eventTroupeId",
                 reason, penalty_points as "penaltyPoints", status, applied_by_user_id as "appliedByUserId",
                 created_at as "createdAt", updated_at as "updatedAt"`,
      [eventId, nightId, eventTroupeId, cleanReason, points, actorUserId],
    );

    await auditEvent(client, {
      actorUserId,
      action: "TROUPE_PENALTY_APPLIED",
      entityType: "troupe_penalty",
      entityId: penalty.id,
      after: {
        eventId,
        nightId,
        eventTroupeId,
        reason: cleanReason,
        penaltyPoints: points,
        status: "APPLIED",
      },
    });

    await client.query("COMMIT");
    return penalty;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function revokeTroupePenalty({
  eventId,
  penaltyId,
  revocationReason,
  actorUserId,
}) {
  requireText(eventId, "eventId");
  requireText(penaltyId, "penaltyId");
  const cleanReason = requireText(revocationReason, "revocationReason");
  requireText(actorUserId, "actorUserId");

  const pool = getPool();
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // Verificar si el evento ya fue liberado
    const { rows: releaseRows } = await client.query(
      "SELECT 1 FROM results_release WHERE event_id = $1",
      [eventId],
    );
    if (releaseRows.length > 0) {
      throw new Error("RESULTS_ALREADY_RELEASED");
    }

    // Buscar penalización con bloqueo de fila
    const { rows: penaltyRows } = await client.query(
      `SELECT * FROM troupe_penalty
       WHERE id = $1 AND event_id = $2
       FOR UPDATE`,
      [penaltyId, eventId],
    );
    if (penaltyRows.length === 0) {
      throw new Error("PENALTY_NOT_FOUND");
    }

    const current = penaltyRows[0];
    if (current.status === "REVOKED") {
      throw new Error("CANNOT_MUTATE_REVOKED_PENALTY");
    }

    const { rows: [revoked] } = await client.query(
      `UPDATE troupe_penalty
       SET status = 'REVOKED',
           revoked_by_user_id = $1,
           revocation_reason = $2,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $3
       RETURNING id, event_id as "eventId", night_id as "nightId", event_troupe_id as "eventTroupeId",
                 reason, penalty_points as "penaltyPoints", status, applied_by_user_id as "appliedByUserId",
                 revoked_by_user_id as "revokedByUserId", revocation_reason as "revocationReason",
                 created_at as "createdAt", updated_at as "updatedAt"`,
      [actorUserId, cleanReason, penaltyId],
    );

    await auditEvent(client, {
      actorUserId,
      action: "TROUPE_PENALTY_REVOKED",
      entityType: "troupe_penalty",
      entityId: penaltyId,
      before: { status: "APPLIED" },
      after: { status: "REVOKED", revocationReason: cleanReason },
    });

    await client.query("COMMIT");
    return revoked;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function listTroupePenalties({
  eventId,
  nightId = null,
  troupeId = null,
  status = null,
}) {
  requireText(eventId, "eventId");

  const pool = getPool();
  const conditions = ["tp.event_id = $1"];
  const params = [eventId];

  if (nightId) {
    params.push(nightId);
    conditions.push(`tp.night_id = $${params.length}`);
  }

  if (troupeId) {
    params.push(troupeId);
    conditions.push(`tp.event_troupe_id = $${params.length}`);
  }

  if (status) {
    params.push(status);
    conditions.push(`tp.status = $${params.length}`);
  }

  const query = `
    SELECT
      tp.id,
      tp.event_id as "eventId",
      tp.night_id as "nightId",
      n.name as "nightName",
      tp.event_troupe_id as "eventTroupeId",
      t.name as "troupeName",
      tp.reason,
      tp.penalty_points as "penaltyPoints",
      tp.status,
      tp.applied_by_user_id as "appliedByUserId",
      u1.name as "appliedByName",
      tp.revoked_by_user_id as "revokedByUserId",
      u2.name as "revokedByName",
      tp.revocation_reason as "revocationReason",
      tp.created_at as "createdAt",
      tp.updated_at as "updatedAt"
    FROM troupe_penalty tp
    JOIN night n ON n.id = tp.night_id
    JOIN event_troupe t ON t.id = tp.event_troupe_id
    JOIN "user" u1 ON u1.id = tp.applied_by_user_id
    LEFT JOIN "user" u2 ON u2.id = tp.revoked_by_user_id
    WHERE ${conditions.join(" AND ")}
    ORDER BY tp.created_at DESC
  `;

  const { rows } = await pool.query(query, params);
  return rows;
}

export async function getTroupePenaltiesTotalsByEvent({ eventId, client = null }) {
  requireText(eventId, "eventId");
  const executor = client ?? getPool();

  const query = `
    SELECT
      tp.event_troupe_id as "troupeId",
      SUM(tp.penalty_points)::INTEGER as "totalPenaltyPoints",
      json_agg(
        json_build_object(
          'id', tp.id,
          'nightId', tp.night_id,
          'nightName', n.name,
          'reason', tp.reason,
          'penaltyPoints', tp.penalty_points,
          'createdAt', tp.created_at
        ) ORDER BY tp.created_at ASC
      ) as "penalties"
    FROM troupe_penalty tp
    JOIN night n ON n.id = tp.night_id
    WHERE tp.event_id = $1 AND tp.status = 'APPLIED'
    GROUP BY tp.event_troupe_id
  `;

  const { rows } = await executor.query(query, [eventId]);
  const map = new Map();
  for (const row of rows) {
    map.set(row.troupeId, {
      totalPenaltyPoints: row.totalPenaltyPoints,
      penalties: row.penalties ?? [],
    });
  }
  return map;
}
