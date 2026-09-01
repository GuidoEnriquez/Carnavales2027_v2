import { auditEvent } from "../../audit/audit-service.js";
import { getPool } from "../../db/pool.js";

function requireText(value, name) {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new TypeError(`${name} debe ser texto no vacío.`);
  }
  return value.trim();
}

function requireUuid(value, name) {
  const text = requireText(value, name);
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(text)) {
    throw new TypeError(`${name} debe ser un UUID válido.`);
  }
  return text;
}

async function runTransaction(clientOrNull, operation) {
  if (clientOrNull) {
    return operation(clientOrNull);
  }
  const client = await getPool().connect();
  try {
    await client.query("BEGIN");
    const result = await operation(client);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    try { await client.query("ROLLBACK"); } catch { /* Preserve original failure. */ }
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Devuelve todos los puntajes confirmados e inmutables de un evento,
 * agregados por rubro y comparsa.
 *
 * RF-89: acumulación por rubro/comparsa sobre SCORED (1-10) y NOT_PRESENTED (0).
 * No muta votos ni planillas.
 */
export async function fetchConsolidatedScores({ eventId, client = getPool() }) {
  const id = requireUuid(eventId, "eventId");
  const { rows } = await client.query(
    `SELECT
        r.id AS "rubricId",
        r.name AS "rubricName",
        r.code AS "rubricCode",
        r.rubric_kind AS "rubricKind",
        et.id AS "troupeId",
        et.name AS "troupeName",
        COALESCE(SUM(bs.score), 0)::INTEGER AS "totalScore",
        COUNT(bs.id)::INTEGER AS "scoreCount"
       FROM ballot_score bs
       JOIN ballot b ON b.id = bs.ballot_id AND b.status = 'SUBMITTED'
       JOIN rubric r ON r.id = bs.rubric_id
       JOIN night_troupe_schedule nts ON nts.id = bs.night_schedule_id
       JOIN event_troupe et ON et.id = nts.event_troupe_id
      WHERE bs.event_id = $1
        AND bs.status = 'LOCKED'
        AND bs.evaluation_state IN ('SCORED', 'NOT_PRESENTED')
      GROUP BY r.id, r.name, r.code, r.rubric_kind, et.id, et.name
      ORDER BY r.code, "totalScore" DESC, et.name`,
    [id],
  );
  return rows;
}

/**
 * Calcula el total por rubro y, dentro de cada rubro, el ranking de comparsas.
 * RF-90: ganador por rubro = comparsa(s) con mayor puntaje acumulado.
 */
export function computeRubricRankings(scores) {
  const byRubric = new Map();
  for (const score of scores) {
    if (!byRubric.has(score.rubricId)) {
      byRubric.set(score.rubricId, {
        rubricId: score.rubricId,
        rubricName: score.rubricName,
        rubricCode: score.rubricCode,
        rubricKind: score.rubricKind,
        troupes: [],
      });
    }
    byRubric.get(score.rubricId).troupes.push({
      troupeId: score.troupeId,
      troupeName: score.troupeName,
      totalScore: score.totalScore,
      scoreCount: score.scoreCount,
    });
  }

  const rankings = [];
  for (const rubric of byRubric.values()) {
    rubric.troupes.sort((a, b) => {
      if (b.totalScore !== a.totalScore) return b.totalScore - a.totalScore;
      return a.troupeName.localeCompare(b.troupeName);
    });

    let rank = 1;
    let previousScore = null;
    rubric.troupes.forEach((troupe, index) => {
      if (previousScore !== null && troupe.totalScore < previousScore) {
        rank = index + 1;
      }
      troupe.rank = rank;
      previousScore = troupe.totalScore;
    });

    const maxScore = rubric.troupes.length > 0 ? rubric.troupes[0].totalScore : null;
    const winners = rubric.troupes.filter((t) => t.totalScore === maxScore && maxScore !== null);

    rankings.push({
      ...rubric,
      winnerTroupeIds: winners.map((w) => w.troupeId),
      winners: winners.map((w) => ({ troupeId: w.troupeId, troupeName: w.troupeName, totalScore: w.totalScore })),
    });
  }

  return rankings.sort((a, b) => a.rubricCode.localeCompare(b.rubricCode));
}

/**
 * Calcula el ranking general de Mejor Comparsa usando solo rubros nominativos.
 * RF-91, RF-92, RF-93.
 */
export function computeOverallRanking(scores) {
  const byTroupe = new Map();
  for (const score of scores) {
    if (score.rubricKind !== "NOMINATIVE") continue;
    if (!byTroupe.has(score.troupeId)) {
      byTroupe.set(score.troupeId, {
        troupeId: score.troupeId,
        troupeName: score.troupeName,
        totalScore: 0,
        rubricScores: [],
      });
    }
    const troupe = byTroupe.get(score.troupeId);
    troupe.totalScore += score.totalScore;
    troupe.rubricScores.push({
      rubricId: score.rubricId,
      rubricName: score.rubricName,
      rubricCode: score.rubricCode,
      rubricScore: score.totalScore,
    });
  }

  const ranking = Array.from(byTroupe.values());
  ranking.sort((a, b) => {
    if (b.totalScore !== a.totalScore) return b.totalScore - a.totalScore;
    return a.troupeName.localeCompare(b.troupeName);
  });

  let rank = 1;
  let previousScore = null;
  ranking.forEach((troupe, index) => {
    if (previousScore !== null && troupe.totalScore < previousScore) {
      rank = index + 1;
    }
    troupe.rank = rank;
    previousScore = troupe.totalScore;
  });

  return ranking;
}

/**
 * Criterio 1 de desempate: mayor cantidad de rubros nominativos ganados.
 * [NECESITA ACLARACIÓN]: Confluence dice "cantidad de rubros nominativos ganados";
 * Obsidian `carnival-domain.md` dice "suma de rubros nominativos". Esta función
 * implementa la interpretación de Confluence (conteo) hasta confirmación oficial.
 */
function countWonNominativeRubrics(troupeId, rubricRankings) {
  let count = 0;
  for (const rubric of rubricRankings) {
    if (rubric.rubricKind !== "NOMINATIVE") continue;
    const troupe = rubric.troupes.find((t) => t.troupeId === troupeId);
    if (troupe && troupe.rank === 1) count += 1;
  }
  return count;
}

/**
 * Criterio 2 de desempate: ganadora en Mejor Batería.
 * Busca el rubro nominativo cuyo code sea 'BATERIA' dentro del evento.
 * Si no existe o no hay ganadora única, devuelve null.
 */
function findBatteryWinner(rubricRankings) {
  const batteryRubric = rubricRankings.find(
    (r) => r.rubricKind === "NOMINATIVE" && r.rubricCode.toUpperCase() === "BATERIA",
  );
  if (!batteryRubric) return null;
  const winners = batteryRubric.winners;
  if (winners.length !== 1) return null;
  return winners[0].troupeId;
}

/**
 * Resuelve el desempate para Mejor Comparsa.
 * RF-95, RF-96.
 *
 * Criterio 1: mayor cantidad de rubros nominativos ganados [NECESITA ACLARACIÓN].
 * Criterio 2: ganadora en Mejor Batería.
 * Criterio 3: sorteo manual [NECESITA ACLARACIÓN] → arroja error para registro manual.
 */
export function resolveTieBreaker({ tiedTroupeIds, rubricRankings, overallRanking }) {
  if (!Array.isArray(tiedTroupeIds) || tiedTroupeIds.length < 2) {
    throw new TypeError("resolveTieBreaker requiere al menos dos comparsas empatadas.");
  }

  // Criterio 1: cantidad de rubros nominativos ganados.
  const counts = tiedTroupeIds.map((id) => ({
    troupeId: id,
    wonRubrics: countWonNominativeRubrics(id, rubricRankings),
  }));
  const maxWon = Math.max(...counts.map((c) => c.wonRubrics));
  const afterCriterion1 = counts.filter((c) => c.wonRubrics === maxWon).map((c) => c.troupeId);
  if (afterCriterion1.length === 1) {
    return {
      winnerTroupeId: afterCriterion1[0],
      appliedCriteria: ["WON_NOMINATIVE_RUBRICS_COUNT"],
      remainingTroupeIds: [],
      tieBreakerContext: { wonRubricsCounts: counts },
    };
  }

  // Criterio 2: Mejor Batería.
  const batteryWinner = findBatteryWinner(rubricRankings);
  if (batteryWinner && afterCriterion1.includes(batteryWinner)) {
    return {
      winnerTroupeId: batteryWinner,
      appliedCriteria: ["WON_NOMINATIVE_RUBRICS_COUNT", "BATTERY_RUBRIC_WINNER"],
      remainingTroupeIds: afterCriterion1.filter((id) => id !== batteryWinner),
      tieBreakerContext: { wonRubricsCounts: counts, batteryRubricWinnerId: batteryWinner },
    };
  }

  // Criterio 3: sorteo. La autoría del sorteo (sistema u operador) está pendiente.
  // Se exige registro manual para no asumir generación automática.
  const error = new Error("TIE_BREAKER_REQUIRES_MANUAL_DRAW");
  error.code = "TIE_BREAKER_REQUIRES_MANUAL_DRAW";
  error.remainingTroupeIds = afterCriterion1;
  error.tieBreakerContext = {
    wonRubricsCounts: counts,
    batteryRubricWinnerId: batteryWinner,
  };
  throw error;
}

/**
 * Determina la(s) comparsa(s) ganadora(s) de Mejor Comparsa aplicando desempate si es necesario.
 */
export function determineBestTroupe({ overallRanking, rubricRankings }) {
  if (overallRanking.length === 0) {
    return { winnerTroupeId: null, tieBreaker: null };
  }
  const topScore = overallRanking[0].totalScore;
  const tied = overallRanking.filter((t) => t.totalScore === topScore);
  if (tied.length === 1) {
    return {
      winnerTroupeId: tied[0].troupeId,
      tieBreaker: null,
    };
  }
  const tiedIds = tied.map((t) => t.troupeId);
  const tieBreaker = resolveTieBreaker({ tiedTroupeIds: tiedIds, rubricRankings, overallRanking });
  return {
    winnerTroupeId: tieBreaker.winnerTroupeId,
    tieBreaker,
  };
}

async function requireResultsReleased(client, eventId) {
  const { rows } = await client.query(
    "SELECT 1 FROM results_release WHERE event_id = $1",
    [eventId],
  );
  if (rows.length === 0) {
    const error = new Error("RESULTS_NOT_RELEASED");
    error.code = "RESULTS_NOT_RELEASED";
    throw error;
  }
}

export async function releaseResults({ eventId, actorUserId, client: injectedClient = null }) {
  const id = requireUuid(eventId, "eventId");
  const actor = requireUuid(actorUserId, "actorUserId");
  return runTransaction(injectedClient, async (client) => {
    const { rows: events } = await client.query(
      "SELECT id FROM carnival_event WHERE id = $1 FOR UPDATE",
      [id],
    );
    if (!events[0]) throw new Error("EVENT_NOT_FOUND");

    const { rows: existing } = await client.query(
      "SELECT event_id FROM results_release WHERE event_id = $1",
      [id],
    );
    if (existing.length > 0) {
      return { eventId: id, alreadyReleased: true };
    }

    const { rows } = await client.query(
      `INSERT INTO results_release (event_id, released_by)
       VALUES ($1, $2)
       RETURNING event_id AS "eventId", released_at AS "releasedAt", released_by AS "releasedBy"`,
      [id, actor],
    );
    const release = rows[0];
    await auditEvent(client, {
      actorUserId: actor,
      action: "RESULTS_RELEASED",
      entityType: "results_release",
      entityId: id,
      after: { releasedAt: release.releasedAt },
    });
    return { eventId: id, alreadyReleased: false, releasedAt: release.releasedAt };
  });
}

/**
 * Calcula y expone resultados si la etapa está autorizada.
 * RF-89 a RF-97.
 */
export async function computeResults({ eventId, actorUserId, client: injectedClient = null }) {
  const id = requireUuid(eventId, "eventId");
  const actor = actorUserId ? requireUuid(actorUserId, "actorUserId") : null;
  return runTransaction(injectedClient, async (client) => {
    await requireResultsReleased(client, id);
    const scores = await fetchConsolidatedScores({ eventId: id, client });
    const rubricRankings = computeRubricRankings(scores);
    const overallRanking = computeOverallRanking(scores);
    const bestTroupe = determineBestTroupe({ overallRanking, rubricRankings });

    const result = {
      eventId: id,
      rubricRankings,
      overallRanking,
      bestTroupe,
    };

    if (actor) {
      await auditEvent(client, {
        actorUserId: actor,
        action: "RESULTS_COMPUTED",
        entityType: "results",
        entityId: id,
        after: {
          winnerTroupeId: bestTroupe.winnerTroupeId,
          overallRankingCount: overallRanking.length,
          rubricRankingCount: rubricRankings.length,
        },
      });
      if (bestTroupe.tieBreaker) {
        await auditEvent(client, {
          actorUserId: actor,
          action: "RESULTS_TIE_BREAKER_APPLIED",
          entityType: "results",
          entityId: id,
          after: {
            winnerTroupeId: bestTroupe.winnerTroupeId,
            appliedCriteria: bestTroupe.tieBreaker.appliedCriteria,
            remainingTroupeIds: bestTroupe.tieBreaker.remainingTroupeIds,
          },
        });
      }
    }

    return result;
  });
}

/**
 * Consulta pública de resultados (sin actor conocido) solo tras liberación.
 */
export async function getReleasedResults({ eventId }) {
  return computeResults({ eventId, actorUserId: null });
}
