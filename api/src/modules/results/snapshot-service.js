import { canonicalizeJson } from "../../audit/audit-service.js";
import { createHash } from "node:crypto";
import { getPool } from "../../db/pool.js";
import { emitMonitorEvent } from "../monitor/monitor-event-bus.js";
import {
  computeOverallRanking,
  computeRubricRankings,
  determineBestTroupe,
  fetchConsolidatedPenalties,
  fetchConsolidatedScores,
  runTransaction,
} from "./results-service.js";

/**
 * Calcula el hash SHA-256 canonicalizado según RFC 8785 (JCS).
 */
export function computeSnapshotHash(payload) {
  const canonical = canonicalizeJson(payload);
  return createHash("sha256").update(canonical, "utf8").digest("hex");
}

/**
 * Materializa un snapshot inmutable para el portal público.
 * Exclusivamente post-liberación; garantiza secreto del voto (RF-210, RF-211, RF-214).
 */
export async function materializeResultsSnapshot({
  eventId,
  client: injectedClient = null,
}) {
  return runTransaction(injectedClient, async (client) => {
    // 1. Obtener metadatos del evento
    const { rows: events } = await client.query(
      "SELECT id, name FROM carnival_event WHERE id = $1",
      [eventId],
    );
    if (events.length === 0) throw new Error("EVENT_NOT_FOUND");
    const event = events[0];

    // 2. Verificar que los resultados estén liberados
    const { rows: releaseRows } = await client.query(
      "SELECT released_at FROM results_release WHERE event_id = $1",
      [eventId],
    );
    if (releaseRows.length === 0) {
      const err = new Error("RESULTS_NOT_RELEASED");
      err.code = "RESULTS_NOT_RELEASED";
      throw err;
    }
    const releasedAt = releaseRows[0].released_at;

    // 3. Cómputo consolidado (sin notas de jurados individuales)
    const scores = await fetchConsolidatedScores({ eventId, client });
    const penalties = await fetchConsolidatedPenalties({ eventId, client });
    const rubricRankings = computeRubricRankings(scores);
    const overallRanking = computeOverallRanking(scores, penalties);

    let bestTroupe;
    try {
      bestTroupe = determineBestTroupe({ overallRanking, rubricRankings });
    } catch (error) {
      if (error.code !== "TIE_BREAKER_REQUIRES_MANUAL_DRAW") {
        throw error;
      }
      const { rows: drawRows } = await client.query(
        `SELECT id AS "auditEventId",
                after_data->>'winnerTroupeId' AS "winnerTroupeId",
                after_data->>'method' AS method,
                after_data->>'seed' AS seed,
                created_at AS "recordedAt"
         FROM audit_event
         WHERE entity_type = 'results'
           AND entity_id = $1
           AND action = 'RESULTS_TIE_BREAKER_CEREMONIAL_DRAW'
         LIMIT 1`,
        [eventId],
      );
      if (drawRows.length > 0) {
        const draw = drawRows[0];
        const winningTroupe = overallRanking.find((t) => t.troupeId === draw.winnerTroupeId);
        bestTroupe = {
          winnerTroupeId: draw.winnerTroupeId,
          winnerTroupeName: winningTroupe ? winningTroupe.troupeName : draw.winnerTroupeId,
          tieBreaker: {
            appliedCriteria: [
              "CRITERION_1_RUBRIC_WINS",
              "CRITERION_2_BATTERIE_SCORE",
              "CRITERION_3_CEREMONIAL_DRAW",
            ],
            ceremonialDraw: {
              auditEventId: draw.auditEventId,
              winnerTroupeId: draw.winnerTroupeId,
              method: draw.method,
              seed: draw.seed,
              recordedAt: draw.recordedAt,
            },
          },
        };
      } else {
        bestTroupe = {
          winnerTroupeId: null,
          winnerTroupeName: null,
          tieBreaker: {
            status: "PENDING_DRAW",
            remainingTroupeIds: error.details?.remainingTroupeIds || [],
          },
        };
      }
    }

    // 4. Consultar si existe acta oficial ya certificada
    const { rows: recordRows } = await client.query(
      `SELECT record_number, certified_role, record_hash, created_at
       FROM official_scrutiny_record
       WHERE event_id = $1`,
      [eventId],
    );
    const officialRecord = recordRows.length > 0
      ? {
          recordNumber: recordRows[0].record_number,
          certifiedRole: recordRows[0].certified_role,
          recordHash: recordRows[0].record_hash,
          certifiedAt: recordRows[0].created_at,
        }
      : null;

    const winnerTroupeName =
      overallRanking.find((t) => t.troupeId === bestTroupe.winnerTroupeId)?.troupeName ?? null;

    // 5. Armar payload público estrictamente sanitizado (RF-214)
    const rawPayload = {
      event: {
        id: event.id,
        name: event.name,
      },
      releasedAt,
      bestTroupe: {
        winnerTroupeId: bestTroupe.winnerTroupeId ?? null,
        winnerTroupeName,
        tieBreaker: bestTroupe.tieBreaker || null,
      },
      overallRanking: overallRanking.map((o) => ({
        rank: o.rank,
        troupeId: o.troupeId,
        troupeName: o.troupeName,
        grossScore: Number(o.grossScore ?? 0),
        totalPenalties: Number(o.totalPenalties ?? 0),
        netScore: Number(o.netScore ?? 0),
      })),
      rubricRankings: rubricRankings.map((r) => ({
        rubricId: r.rubricId,
        rubricName: r.rubricName,
        rubricCode: r.rubricCode,
        rubricKind: r.rubricKind,
        winnerTroupeIds: r.winnerTroupeIds ?? [],
        winners: (r.winners ?? []).map((w) => ({
          troupeId: w.troupeId,
          troupeName: w.troupeName,
          totalScore: Number(w.totalScore ?? w.score ?? 0),
        })),
        troupes: (r.troupes ?? []).map((t) => ({
          troupeId: t.troupeId,
          troupeName: t.troupeName,
          totalScore: Number(t.totalScore ?? t.score ?? 0),
          rank: t.rank,
        })),
      })),
      officialRecord: officialRecord ?? null,
    };

    const payload = JSON.parse(
      JSON.stringify(rawPayload, (k, v) => (v === undefined ? null : v)),
    );

    // 6. Calcular hash canonicalizado
    const snapshotHash = computeSnapshotHash(payload);

    // 7. Determinar siguiente versión
    const { rows: verRows } = await client.query(
      "SELECT COALESCE(MAX(version), 0) + 1 AS next_version FROM results_snapshot WHERE event_id = $1",
      [eventId],
    );
    const version = verRows[0].next_version;

    // 8. Insertar snapshot inmutable
    const { rows: inserted } = await client.query(
      `INSERT INTO results_snapshot (event_id, version, snapshot_hash, payload)
       VALUES ($1, $2, $3, $4)
       RETURNING id, event_id, version, snapshot_hash, payload, created_at`,
      [eventId, version, snapshotHash, JSON.stringify(payload)],
    );

    const snapshot = inserted[0];

    // 9. Emitir notificación en bus interno
    emitMonitorEvent("RESULTS_SNAPSHOT_UPDATED", {
      eventId,
      version,
      snapshotHash,
    });

    return snapshot;
  });
}

/**
 * Obtiene el snapshot más reciente de un evento.
 */
export async function getLatestResultsSnapshot(eventId, injectedClient = null) {
  const runner = async (client) => {
    const { rows } = await client.query(
      `SELECT id, event_id AS "eventId", version, snapshot_hash AS "snapshotHash", payload, created_at AS "createdAt"
       FROM results_snapshot
       WHERE event_id = $1
       ORDER BY version DESC
       LIMIT 1`,
      [eventId],
    );
    return rows[0] || null;
  };

  if (injectedClient) return runner(injectedClient);
  const client = await getPool().connect();
  try {
    return await runner(client);
  } finally {
    client.release();
  }
}

/**
 * Lista todos los eventos públicos que cuentan con resultados liberados.
 */
export async function listPublicEvents(injectedClient = null) {
  const runner = async (client) => {
    const { rows } = await client.query(
      `SELECT DISTINCT ON (ce.id)
         ce.id,
         ce.name,
         rs.version,
         rs.version AS "latestVersion",
         rs.snapshot_hash AS "snapshotHash",
         rs.created_at AS "updatedAt"
       FROM carnival_event ce
       JOIN results_snapshot rs ON rs.event_id = ce.id
       ORDER BY ce.id, rs.version DESC`,
    );
    return rows;
  };

  if (injectedClient) return runner(injectedClient);
  const client = await getPool().connect();
  try {
    return await runner(client);
  } finally {
    client.release();
  }
}
