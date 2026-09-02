/**
 * Orquestación del sorteo ceremonial — Spec 011 T02.
 *
 * Encapsula el flujo HTTP-friendly:
 *   1. Verifica que el evento tenga resultados liberados.
 *   2. Recalcula resultados para confirmar el empate vigente.
 *   3. Verifica que el empate realmente requiera criterio 3 (criterios 1 y 2 no resolvieron).
 *   4. Verifica que el pool solicitado coincida con el vigente (RF-99).
 *   5. Verifica que no haya un sorteo ceremonial previo (RF-104, idempotencia).
 *   6. Genera seed, selecciona ganador, persiste auditoría append-only (RF-102).
 *
 * Se ejecuta dentro de una transacción (runTransaction del módulo results-service)
 * para garantizar atomicidad entre el check de empate y la persistencia.
 */

import {
  composeAuditEvent,
  selectCeremonialWinner,
} from "./ceremonial-draw-service.js";
import { auditCeremonialDraw } from "../../audit/audit-service.js";
import { randomUUID } from "node:crypto";
import {
  fetchConsolidatedScores,
  computeRubricRankings,
  computeOverallRanking,
  determineBestTroupe,
  runTransaction,
} from "./results-service.js";

/**
 * @param {{
 *   eventId: string,
 *   remainingTroupeIds: string[],
 *   actorUserId: string,
 *   actorRole: string,
 *   correlationId?: string|null,
 * }} params
 * @returns {Promise<{
 *   eventId: string,
 *   winnerTroupeId: string,
 *   seed: number,
 *   randomValue: number,
 *   method: string,
 *   auditEventId: string,
 *   correlationId: string|null,
 *   appliedCriteria: string[],
 * }>}
 */
export async function executeCeremonialDraw({
  eventId,
  remainingTroupeIds,
  actorUserId,
  actorRole,
  correlationId = null,
}) {
  if (!Array.isArray(remainingTroupeIds) || remainingTroupeIds.length < 2) {
    const error = new Error("TIE_BREAKER_EMPTY_DRAW_POOL");
    error.code = "TIE_BREAKER_EMPTY_DRAW_POOL";
    throw error;
  }
  if (
    remainingTroupeIds.some(
      (id) => typeof id !== "string" || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id),
    )
  ) {
    const error = new Error("TIE_BREAKER_INVALID_DRAW_INPUT");
    error.code = "TIE_BREAKER_INVALID_DRAW_INPUT";
    throw error;
  }
  return runTransaction(null, async (client) => {
    // 1. Bloquear el evento para serializar el check y la inserción del draw.
    const { rows: eventRows } = await client.query(
      "SELECT id FROM carnival_event WHERE id = $1 FOR UPDATE",
      [eventId],
    );
    if (!eventRows[0]) throw new Error("EVENT_NOT_FOUND");

    // 2. Verificar results_release.
    const { rows: releaseRows } = await client.query(
      "SELECT 1 FROM results_release WHERE event_id = $1",
      [eventId],
    );
    if (releaseRows.length === 0) throw new Error("RESULTS_NOT_RELEASED");

    // 3. Verificar que no exista ya un sorteo ceremonial para este evento.
    const { rows: existingDraws } = await client.query(
      `SELECT id FROM audit_event
       WHERE entity_type = 'results'
         AND entity_id = $1
         AND action = 'RESULTS_TIE_BREAKER_CEREMONIAL_DRAW'`,
      [eventId],
    );
    if (existingDraws.length > 0) throw new Error("TIE_BREAKER_ALREADY_DRAWN");

    // 4. Recalcular resultados y verificar empate vigente.
    const scores = await fetchConsolidatedScores({ eventId, client });
    const rubricRankings = computeRubricRankings(scores);
    const overallRanking = computeOverallRanking(scores);
    if (overallRanking.length === 0) throw new Error("TIE_BREAKER_NOT_REQUIRED");

    const topScore = overallRanking[0].totalScore;
    const tied = overallRanking.filter((t) => t.totalScore === topScore);
    if (tied.length < 2) throw new Error("TIE_BREAKER_NOT_REQUIRED");

    // 5. Criterios 1 y 2 deben seguir sin resolver el empate. El pool válido
    // es el que queda después de ambos criterios, no el empate inicial.
    let tieBreaker;
    try {
      const bestTroupe = determineBestTroupe({ overallRanking, rubricRankings });
      if (bestTroupe?.winnerTroupeId) throw new Error("TIE_BREAKER_NOT_REQUIRED");
    } catch (error) {
      if (error.message !== "TIE_BREAKER_REQUIRES_MANUAL_DRAW") throw error;
      tieBreaker = error;
    }

    // 6. El pool solicitado debe ser exactamente el pool vigente (RF-99).
    const currentPool = [...tieBreaker.remainingTroupeIds].sort();
    const requestedPool = [...remainingTroupeIds].sort();
    if (
      currentPool.length !== requestedPool.length ||
      currentPool.some((id, index) => id !== requestedPool[index])
    ) {
      const error = new Error("TIE_BREAKER_STALE");
      error.expectedTroupeIds = currentPool;
      error.receivedTroupeIds = requestedPool;
      throw error;
    }

    // 7. Elegir ganador y persistir auditoría dentro de la misma transacción.
    const draw = selectCeremonialWinner({ pool: remainingTroupeIds });
    const auditPayload = composeAuditEvent({
      eventId,
      tiedTroupeIds: currentPool,
      appliedCriteria: tieBreaker.appliedCriteria,
      seed: draw.seed,
      randomValue: draw.randomValue,
      method: draw.method,
      winnerTroupeId: draw.winnerTroupeId,
      actor: { id: actorUserId, role: actorRole },
      correlationId: correlationId ?? randomUUID(),
    });
    const inserted = await auditCeremonialDraw(client, {
      actorUserId,
      eventId,
      payload: auditPayload,
    });

    return {
      eventId,
      winnerTroupeId: draw.winnerTroupeId,
      seed: draw.seed,
      randomValue: draw.randomValue,
      method: draw.method,
      auditEventId: inserted.id,
      correlationId: auditPayload.correlationId,
      appliedCriteria: tieBreaker.appliedCriteria,
    };
  });
}
