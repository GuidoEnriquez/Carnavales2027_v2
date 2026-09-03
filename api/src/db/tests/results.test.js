import { describe, it, before, after, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { getPool, closePool } from "../pool.js";
import { migrate } from "../migrate.js";
import {
  fetchConsolidatedScores,
  fetchConsolidatedPenalties,
  computeRubricRankings,
  computeOverallRanking,
  resolveTieBreaker,
  determineBestTroupe,
  releaseResults,
  computeResults,
} from "../../modules/results/results-service.js";

let client;

before(async () => {
  await migrate();
  client = await getPool().connect();
});

after(async () => {
  client?.release();
  await closePool();
});

beforeEach(async () => {
  await client.query("BEGIN");
});

afterEach(async () => {
  await client.query("ROLLBACK");
});

async function setupResultFixtures({ withRandomRubric = false, scoreOverrides = {} } = {}) {
  const suffix = Math.random().toString(36).slice(2, 8);
  const { rows: [event] } = await client.query(
    "INSERT INTO carnival_event(name) VALUES($1) RETURNING id", [`Result Event ${suffix}`],
  );
  const { rows: [night] } = await client.query(
    "INSERT INTO night(event_id, name, display_order, kind, status) VALUES($1,$2,$3,$4,$5) RETURNING id",
    [event.id, "Noche 1", 1, "COMPETITION", "OPEN"],
  );
  await client.query(
    "INSERT INTO voting_window(event_id, night_id, status, closed_at) VALUES($1,$2,'CLOSED',CURRENT_TIMESTAMP)",
    [event.id, night.id],
  );
  const { rows: [specialty] } = await client.query(
    "INSERT INTO event_specialty(event_id, name, code, display_order) VALUES($1,$2,$3,$4) RETURNING id",
    [event.id, "Baile", "BAILE", 1],
  );
  const { rows: [batterySpecialty] } = await client.query(
    "INSERT INTO event_specialty(event_id, name, code, display_order) VALUES($1,$2,$3,$4) RETURNING id",
    [event.id, "Batería", "BATERIA", 2],
  );

  const { rows: [rubricNominativeA] } = await client.query(
    "INSERT INTO rubric(event_id, name, code, evaluation_target, rubric_kind) VALUES($1,$2,$3,$4,$5) RETURNING id",
    [event.id, "Coreografía", "COREO", "TROUPE", "NOMINATIVE"],
  );
  const { rows: [rubricNominativeB] } = await client.query(
    "INSERT INTO rubric(event_id, name, code, evaluation_target, rubric_kind) VALUES($1,$2,$3,$4,$5) RETURNING id",
    [event.id, "Batería", "BATERIA", "TROUPE", "NOMINATIVE"],
  );
  let rubricRandom = null;
  if (withRandomRubric) {
    const { rows: [r] } = await client.query(
      "INSERT INTO rubric(event_id, name, code, evaluation_target, expected_subject_type, rubric_kind) VALUES($1,$2,$3,$4,$5,$6) RETURNING id",
      [event.id, "Mejor Bailarina", "BAILARINA", "NOMINATION", "PERSON", "RANDOM"],
    );
    rubricRandom = r;
  }

  const { rows: [itemA] } = await client.query(
    "INSERT INTO evaluation_item(event_id, rubric_id, specialty_id, name, code) VALUES($1,$2,$3,$4,$5) RETURNING id",
    [event.id, rubricNominativeA.id, specialty.id, "Ejecución", "EJECUCION"],
  );
  const { rows: [itemB] } = await client.query(
    "INSERT INTO evaluation_item(event_id, rubric_id, specialty_id, name, code) VALUES($1,$2,$3,$4,$5) RETURNING id",
    [event.id, rubricNominativeB.id, batterySpecialty.id, "Precisión", "PRECISION"],
  );
  let itemRandom = null;
  if (withRandomRubric) {
    const { rows: [i] } = await client.query(
      "INSERT INTO evaluation_item(event_id, rubric_id, specialty_id, name, code) VALUES($1,$2,$3,$4,$5) RETURNING id",
      [event.id, rubricRandom.id, specialty.id, "Presencia", "PRESENCIA"],
    );
    itemRandom = i;
  }

  const { rows: [category] } = await client.query(
    "INSERT INTO event_category(event_id, name, code, display_order) VALUES($1,$2,$3,$4) RETURNING id",
    [event.id, "Primera", "PRIMERA", 1],
  );
  const { rows: [troupeA] } = await client.query(
    "INSERT INTO event_troupe(event_id, category_id, name) VALUES($1,$2,$3) RETURNING id",
    [event.id, category.id, "Comparsa A"],
  );
  const { rows: [troupeB] } = await client.query(
    "INSERT INTO event_troupe(event_id, category_id, name) VALUES($1,$2,$3) RETURNING id",
    [event.id, category.id, "Comparsa B"],
  );

  const { rows: [scheduleA] } = await client.query(
    "INSERT INTO night_troupe_schedule(event_id, night_id, event_troupe_id, presentation_order, status) VALUES($1,$2,$3,$4,$5) RETURNING id",
    [event.id, night.id, troupeA.id, 1, "SCHEDULED"],
  );
  const { rows: [scheduleB] } = await client.query(
    "INSERT INTO night_troupe_schedule(event_id, night_id, event_troupe_id, presentation_order, status) VALUES($1,$2,$3,$4,$5) RETURNING id",
    [event.id, night.id, troupeB.id, 2, "SCHEDULED"],
  );

  const adminId = randomUUID();
  const judgeUserId = randomUUID();
  const batteryJudgeUserId = randomUUID();
  await client.query(
    `INSERT INTO "user"(id, name, email, "emailVerified")
     VALUES ($1, 'Admin', $2, true), ($3, 'Judge', $4, true), ($5, 'Battery Judge', $6, true)`,
    [adminId, `${adminId}@example.test`, judgeUserId, `${judgeUserId}@example.test`, batteryJudgeUserId, `${batteryJudgeUserId}@example.test`],
  );

  const { rows: [judgeProfile] } = await client.query(
    "INSERT INTO judge_profile(name, email, document_number, registration_status, created_by) VALUES($1,$2,$3,$4,$5) RETURNING id",
    [`Judge ${suffix}`, `judge${suffix}@test.test`, `DOC${suffix}`, "INVITED", adminId],
  );
  await client.query("UPDATE judge_profile SET user_id = $1, registration_status = 'REGISTERED' WHERE id = $2", [judgeUserId, judgeProfile.id]);

  const { rows: [batteryJudgeProfile] } = await client.query(
    "INSERT INTO judge_profile(name, email, document_number, registration_status, created_by) VALUES($1,$2,$3,$4,$5) RETURNING id",
    [`Battery Judge ${suffix}`, `battery${suffix}@test.test`, `DOCB${suffix}`, "INVITED", adminId],
  );
  await client.query("UPDATE judge_profile SET user_id = $1, registration_status = 'REGISTERED' WHERE id = $2", [batteryJudgeUserId, batteryJudgeProfile.id]);

  await client.query(
    "INSERT INTO judge_quota(event_id, night_id, specialty_id, max_assignments) VALUES($1,$2,$3,$4),($1,$2,$5,$4)",
    [event.id, night.id, specialty.id, 2, batterySpecialty.id],
  );
  const { rows: [assignmentA] } = await client.query(
    "INSERT INTO judge_assignment(event_id, night_id, specialty_id, judge_profile_id, assignment_type) VALUES($1,$2,$3,$4,$5) RETURNING id",
    [event.id, night.id, specialty.id, judgeProfile.id, "PRIMARY"],
  );
  const { rows: [assignmentB] } = await client.query(
    "INSERT INTO judge_assignment(event_id, night_id, specialty_id, judge_profile_id, assignment_type) VALUES($1,$2,$3,$4,$5) RETURNING id",
    [event.id, night.id, batterySpecialty.id, batteryJudgeProfile.id, "PRIMARY"],
  );

  const { rows: [ballotA] } = await client.query(
    "INSERT INTO ballot(event_id, night_id, judge_assignment_id, judge_profile_id, specialty_id, status) VALUES($1,$2,$3,$4,$5,'OPEN') RETURNING id",
    [event.id, night.id, assignmentA.id, judgeProfile.id, specialty.id],
  );
  const { rows: [ballotB] } = await client.query(
    "INSERT INTO ballot(event_id, night_id, judge_assignment_id, judge_profile_id, specialty_id, status) VALUES($1,$2,$3,$4,$5,'OPEN') RETURNING id",
    [event.id, night.id, assignmentB.id, batteryJudgeProfile.id, batterySpecialty.id],
  );

  const scoreFixtures = [
    { key: "coreoA", ballot: ballotA.id, item: itemA.id, rubric: rubricNominativeA.id, schedule: scheduleA.id, score: 8, state: "SCORED" },
    { key: "coreoB", ballot: ballotA.id, item: itemA.id, rubric: rubricNominativeA.id, schedule: scheduleB.id, score: 7, state: "SCORED" },
    { key: "bateriaA", ballot: ballotB.id, item: itemB.id, rubric: rubricNominativeB.id, schedule: scheduleA.id, score: 9, state: "SCORED" },
    { key: "bateriaB", ballot: ballotB.id, item: itemB.id, rubric: rubricNominativeB.id, schedule: scheduleB.id, score: 6, state: "SCORED" },
  ];
  if (withRandomRubric) {
    scoreFixtures.push(
      { key: "randomA", ballot: ballotA.id, item: itemRandom.id, rubric: rubricRandom.id, schedule: scheduleA.id, score: 10, state: "SCORED" },
      { key: "randomB", ballot: ballotA.id, item: itemRandom.id, rubric: rubricRandom.id, schedule: scheduleB.id, score: 5, state: "SCORED" },
    );
  }

  for (const s of scoreFixtures) {
    const override = scoreOverrides[s.key];
    const finalScore = override !== undefined ? override : s.score;
    await client.query(
      `INSERT INTO ballot_score(ballot_id, event_id, evaluation_item_id, rubric_id, night_schedule_id, score, evaluation_state, status)
       VALUES($1,$2,$3,$4,$5,$6,$7,'DRAFT')`,
      [s.ballot, event.id, s.item, s.rubric, s.schedule, finalScore, s.state],
    );
  }

  await client.query(
    "UPDATE ballot SET status = 'SUBMITTED', submitted_at = CURRENT_TIMESTAMP WHERE id = ANY($1::uuid[])",
    [[ballotA.id, ballotB.id]],
  );
  await client.query(
    "UPDATE ballot_score SET status = 'LOCKED', locked_at = CURRENT_TIMESTAMP WHERE ballot_id = ANY($1::uuid[])",
    [[ballotA.id, ballotB.id]],
  );

  return {
    event,
    night,
    rubrics: { coreo: rubricNominativeA, bateria: rubricNominativeB, random: rubricRandom },
    troupes: { a: troupeA, b: troupeB },
  };
}

describe("results DB", () => {
  it("consolida puntajes confirmados por rubro y comparsa (RF-89)", async () => {
    const data = await setupResultFixtures();
    const scores = await fetchConsolidatedScores({ eventId: data.event.id, client });
    const byKey = Object.fromEntries(scores.map((s) => [`${s.rubricCode}-${s.troupeName}`, s.totalScore]));
    assert.equal(byKey["COREO-Comparsa A"], 8);
    assert.equal(byKey["COREO-Comparsa B"], 7);
    assert.equal(byKey["BATERIA-Comparsa A"], 9);
    assert.equal(byKey["BATERIA-Comparsa B"], 6);
  });

  it("ignora rubros aleatorios en el cómputo de Mejor Comparsa (RF-91)", async () => {
    const data = await setupResultFixtures({ withRandomRubric: true });
    const scores = await fetchConsolidatedScores({ eventId: data.event.id, client });
    const overall = computeOverallRanking(scores);
    assert.equal(overall.length, 2);
    const troupeA = overall.find((t) => t.troupeName === "Comparsa A");
    const troupeB = overall.find((t) => t.troupeName === "Comparsa B");
    assert.equal(troupeA.totalScore, 8 + 9); // solo nominativos
    assert.equal(troupeB.totalScore, 7 + 6);
  });

  it("determina ganador por rubro (RF-90)", async () => {
    const data = await setupResultFixtures();
    const scores = await fetchConsolidatedScores({ eventId: data.event.id, client });
    const rankings = computeRubricRankings(scores);
    const coreo = rankings.find((r) => r.rubricCode === "COREO");
    assert.deepEqual(coreo.winnerTroupeIds, [data.troupes.a.id]);
    assert.equal(coreo.winners[0].totalScore, 8);
    const bateria = rankings.find((r) => r.rubricCode === "BATERIA");
    assert.deepEqual(bateria.winnerTroupeIds, [data.troupes.a.id]);
  });

  it("produce ranking general ordenado de mayor a menor (RF-92)", async () => {
    const data = await setupResultFixtures();
    const scores = await fetchConsolidatedScores({ eventId: data.event.id, client });
    const overall = computeOverallRanking(scores);
    assert.equal(overall[0].troupeName, "Comparsa A");
    assert.equal(overall[0].totalScore, 17);
    assert.equal(overall[1].troupeName, "Comparsa B");
    assert.equal(overall[1].totalScore, 13);
    assert.equal(overall[0].rank, 1);
    assert.equal(overall[1].rank, 2);
  });

  it("resultado es determinístico: misma entrada produce misma salida (RF-93)", async () => {
    const data = await setupResultFixtures();
    const first = await fetchConsolidatedScores({ eventId: data.event.id, client });
    const second = await fetchConsolidatedScores({ eventId: data.event.id, client });
    assert.deepEqual(first, second);
  });

  it("maneja rubro sin puntuaciones: sin ganador y sin afectar ranking", async () => {
    const data = await setupResultFixtures();
    await client.query(
      "INSERT INTO rubric(event_id, name, code, evaluation_target, rubric_kind) VALUES($1,$2,$3,$4,$5)",
      [data.event.id, "Vestuario", "VESTUARIO", "TROUPE", "NOMINATIVE"],
    );
    const scores = await fetchConsolidatedScores({ eventId: data.event.id, client });
    const rankings = computeRubricRankings(scores);
    // Un rubro sin puntuaciones no aparece en la consolidación (no hay ganador).
    assert.equal(rankings.some((r) => r.rubricCode === "VESTUARIO"), false);
  });

  it("desempate por Mejor Batería resuelve empate en Mejor Comparsa (RF-96 criterio 2)", async () => {
    // A=5+9=14, B=8+6=14 → empate en Mejor Comparsa. A ganó Batería (9 vs 6).
    const data = await setupResultFixtures({ scoreOverrides: { coreoA: 5, coreoB: 8 } });

    const scores = await fetchConsolidatedScores({ eventId: data.event.id, client });
    const rubricRankings = computeRubricRankings(scores);
    const overall = computeOverallRanking(scores);
    assert.equal(overall[0].totalScore, overall[1].totalScore);

    const result = determineBestTroupe({ overallRanking: overall, rubricRankings });
    assert.equal(result.winnerTroupeId, data.troupes.a.id);
    assert.deepEqual(result.tieBreaker.appliedCriteria, ["WON_NOMINATIVE_RUBRICS_COUNT", "BATTERY_RUBRIC_WINNER"]);
  });

  it("desempate manual cuando persisten dos comparsas tras Batería (RF-96 criterio 3)", async () => {
    // Empate total nominativo y también empate en Batería.
    const data = await setupResultFixtures({ scoreOverrides: { coreoA: 7, coreoB: 7, bateriaA: 8, bateriaB: 8 } });

    const scores = await fetchConsolidatedScores({ eventId: data.event.id, client });
    const rubricRankings = computeRubricRankings(scores);
    const overall = computeOverallRanking(scores);

    let caught;
    try {
      determineBestTroupe({ overallRanking: overall, rubricRankings });
    } catch (err) {
      caught = err;
    }
    assert.ok(caught, "Se esperaba un error de desempate manual");
    assert.equal(caught.code, "TIE_BREAKER_REQUIRES_MANUAL_DRAW");
    assert.equal(caught.remainingTroupeIds.length, 2);
  });

  it("audita liberación, cómputo y desempate de resultados (RF-97)", async () => {
    const data = await setupResultFixtures();
    const adminId = (await client.query('SELECT id FROM "user" WHERE name = $1', ["Admin"])).rows[0]?.id;
    assert.ok(adminId);

    await releaseResults({ eventId: data.event.id, actorUserId: adminId, client });
    const { rows: [releaseAudit] } = await client.query(
      "SELECT action FROM audit_event WHERE entity_id = $1 AND action = 'RESULTS_RELEASED'",
      [data.event.id],
    );
    assert.ok(releaseAudit);

    await computeResults({ eventId: data.event.id, actorUserId: adminId, client });
    const { rows: [computeAudit] } = await client.query(
      "SELECT action FROM audit_event WHERE entity_id = $1 AND action = 'RESULTS_COMPUTED'",
      [data.event.id],
    );
    assert.ok(computeAudit);
  });

  it("audita desempate cuando aplica (RF-97)", async () => {
    const data = await setupResultFixtures({ scoreOverrides: { coreoA: 5, coreoB: 8 } });
    const adminId = (await client.query('SELECT id FROM "user" WHERE name = $1', ["Admin"])).rows[0]?.id;
    await releaseResults({ eventId: data.event.id, actorUserId: adminId, client });
    await computeResults({ eventId: data.event.id, actorUserId: adminId, client });
    const { rows: [tieAudit] } = await client.query(
      "SELECT action, after_data FROM audit_event WHERE entity_id = $1 AND action = 'RESULTS_TIE_BREAKER_APPLIED'",
      [data.event.id],
    );
    assert.ok(tieAudit);
    assert.deepEqual(tieAudit.after_data.appliedCriteria, ["WON_NOMINATIVE_RUBRICS_COUNT", "BATTERY_RUBRIC_WINNER"]);
  });

  it("deduce penalizaciones activas en el puntaje neto de Mejor Comparsa (RF-117, RF-119) y no afecta rubros (RF-118)", async () => {
    const data = await setupResultFixtures();
    const adminId = (await client.query('SELECT id FROM "user" WHERE name = $1', ["Admin"])).rows[0]?.id;
    // Compresa A: coreo 8 + bateria 9 = 17 (gross). Aplicar 4 puntos de penalización.
    await client.query(
      `INSERT INTO troupe_penalty(event_id, night_id, event_troupe_id, reason, penalty_points, status, applied_by_user_id)
       VALUES($1,$2,$3,'Demora en pista',4,'APPLIED',$4)`,
      [data.event.id, data.night.id, data.troupes.a.id, adminId],
    );
    // Compresa B: 7+6 = 13, sin penalizaciones.

    const scores = await fetchConsolidatedScores({ eventId: data.event.id, client });
    const penalties = await fetchConsolidatedPenalties({ eventId: data.event.id, client });
    const overall = computeOverallRanking(scores, penalties);
    const rubricRankings = computeRubricRankings(scores);

    const troupeA = overall.find((t) => t.troupeId === data.troupes.a.id);
    const troupeB = overall.find((t) => t.troupeId === data.troupes.b.id);

    // RF-117: netScore = max(0, grossScore - penalizaciones)
    assert.equal(troupeA.grossScore, 17);
    assert.equal(troupeA.totalPenalties, 4);
    assert.equal(troupeA.penaltyPoints, 4);
    assert.equal(troupeA.netScore, 13);
    assert.equal(troupeA.totalScore, 13);
    assert.equal(troupeA.penalties.length, 1);
    assert.equal(troupeB.grossScore, 13);
    assert.equal(troupeB.totalPenalties, 0);
    assert.equal(troupeB.netScore, 13);
    // Ranking ordena por netScore; A empatado con B tras la deducción.
    assert.equal(troupeA.rank, troupeB.rank);
    // RF-118: los premios por rubro siguen basados en el puntaje artístico (sin penalización).
    const coreo = rubricRankings.find((r) => r.rubricCode === "COREO");
    assert.equal(coreo.winners[0].totalScore, 8);
    assert.equal(rubricRankings.find((r) => r.rubricCode === "BATERIA").winners[0].totalScore, 9);
    // RF-119: desglose auditable presente.
    assert.ok(Array.isArray(troupeA.penalties));
    assert.equal(troupeA.penalties[0].penaltyPoints, 4);
  });
});
