import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import { createApp } from "../app.js";
import { closePool, getPool } from "../db/pool.js";
import { migrate } from "../db/migrate.js";

const originalDatabaseUrl = process.env.DATABASE_URL;

async function withServer(app, run) {
  const server = await new Promise((resolve) => {
    const instance = app.listen(0, "127.0.0.1", () => resolve(instance));
  });
  try {
    await run(`http://127.0.0.1:${server.address().port}`);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
}

async function setupTestEvent(pool) {
  const { rows: [event] } = await pool.query(
    "INSERT INTO carnival_event(name) VALUES($1) RETURNING id",
    ["Penalties Test Event"],
  );
  const { rows: [night] } = await pool.query(
    "INSERT INTO night(event_id, name, display_order, kind, status) VALUES($1,$2,$3,$4,$5) RETURNING id",
    [event.id, "Noche 1", 1, "COMPETITION", "OPEN"],
  );
  const { rows: [awardsNight] } = await pool.query(
    "INSERT INTO night(event_id, name, display_order, kind, status) VALUES($1,$2,$3,$4,$5) RETURNING id",
    [event.id, "Noche Premios", 2, "AWARDS", "OPEN"],
  );
  const { rows: [category] } = await pool.query(
    "INSERT INTO event_category(event_id, name, code, display_order) VALUES($1,$2,$3,$4) RETURNING id",
    [event.id, "Cat A", "CAT_A", 1],
  );
  const { rows: [troupe] } = await pool.query(
    "INSERT INTO event_troupe(event_id, category_id, name) VALUES($1,$2,$3) RETURNING id",
    [event.id, category.id, "Comparsa Penalizable"],
  );

  const adminId = randomUUID();
  const comisarioId = randomUUID();
  const judgeId = randomUUID();
  const veedorId = randomUUID();

  await pool.query(
    `INSERT INTO "user"(id, name, email, "emailVerified")
     VALUES ($1,'Admin',$2,true), ($3,'Comisario',$4,true), ($5,'Judge',$6,true), ($7,'Veedor',$8,true)`,
    [
      adminId, `${adminId}@example.test`,
      comisarioId, `${comisarioId}@example.test`,
      judgeId, `${judgeId}@example.test`,
      veedorId, `${veedorId}@example.test`,
    ],
  );

  await pool.query("INSERT INTO user_role(user_id, role_code) VALUES ($1,'ADMIN'), ($2,'COMISARIO'), ($3,'JUDGE'), ($4,'VEEDOR')", [
    adminId,
    comisarioId,
    judgeId,
    veedorId,
  ]);

  return {
    eventId: event.id,
    nightId: night.id,
    awardsNightId: awardsNight.id,
    troupeId: troupe.id,
    adminId,
    comisarioId,
    judgeId,
    veedorId,
  };
}

test("API penalizaciones: autorización, ciclo de vida, auditoría y bloqueo post-liberación", async (context) => {
  context.after(async () => {
    await closePool();
    if (originalDatabaseUrl === undefined) delete process.env.DATABASE_URL;
    else process.env.DATABASE_URL = originalDatabaseUrl;
  });

  process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;
  await migrate();
  const pool = getPool();
  const fixture = await setupTestEvent(pool);

  const getSession = async ({ headers }) => {
    const caller = headers.get("x-test-caller");
    if (caller === "admin") return { user: { id: fixture.adminId, twoFactorEnabled: true } };
    if (caller === "admin-no-2fa") return { user: { id: fixture.adminId, twoFactorEnabled: false } };
    if (caller === "comisario") return { user: { id: fixture.comisarioId, twoFactorEnabled: true } };
    if (caller === "comisario-no-2fa") return { user: { id: fixture.comisarioId, twoFactorEnabled: false } };
    if (caller === "judge") return { user: { id: fixture.judgeId, twoFactorEnabled: true } };
    if (caller === "veedor") return { user: { id: fixture.veedorId, twoFactorEnabled: true } };
    return null;
  };

  const app = createApp({ getSession });

  await withServer(app, async (baseUrl) => {
    const postPenalty = async (caller, payload) =>
      fetch(`${baseUrl}/api/v1/events/${fixture.eventId}/penalties`, {
        method: "POST",
        headers: { "content-type": "application/json", "x-test-caller": caller },
        body: JSON.stringify(payload),
      });

    const getPenalties = async (caller, query = "") =>
      fetch(`${baseUrl}/api/v1/events/${fixture.eventId}/penalties${query}`, {
        headers: { "x-test-caller": caller },
      });

    const revokePenalty = async (caller, penaltyId, payload) =>
      fetch(`${baseUrl}/api/v1/events/${fixture.eventId}/penalties/${penaltyId}/revoke`, {
        method: "POST",
        headers: { "content-type": "application/json", "x-test-caller": caller },
        body: JSON.stringify(payload),
      });

    // 1. Rechazo sin autenticación (401)
    const unauth = await fetch(`${baseUrl}/api/v1/events/${fixture.eventId}/penalties`);
    assert.equal(unauth.status, 401);

    // 2. Rechazo sin 2FA (403 TWO_FACTOR_REQUIRED) para COMISARIO y ADMIN
    const no2fa = await postPenalty("comisario-no-2fa", {
      nightId: fixture.nightId,
      eventTroupeId: fixture.troupeId,
      reason: "Demora en largada",
      penaltyPoints: 2,
    });
    assert.equal(no2fa.status, 403);
    assert.equal((await no2fa.json()).code, "TWO_FACTOR_REQUIRED");

    const adminNo2fa = await postPenalty("admin-no-2fa", {
      nightId: fixture.nightId,
      eventTroupeId: fixture.troupeId,
      reason: "Demora en largada",
      penaltyPoints: 2,
    });
    assert.equal(adminNo2fa.status, 403);
    assert.equal((await adminNo2fa.json()).code, "TWO_FACTOR_REQUIRED");

    // 3. Rechazo a JUDGE y VEEDOR (403 PENALTIES_ACCESS_DENIED)
    const judgeRes = await postPenalty("judge", {
      nightId: fixture.nightId,
      eventTroupeId: fixture.troupeId,
      reason: "Demora",
      penaltyPoints: 1,
    });
    assert.equal(judgeRes.status, 403);
    assert.equal((await judgeRes.json()).code, "PENALTIES_ACCESS_DENIED");

    const veedorRes = await getPenalties("veedor");
    assert.equal(veedorRes.status, 403);
    assert.equal((await veedorRes.json()).code, "PENALTIES_ACCESS_DENIED");

    // 4. Rechazo si los puntos son <= 0, no enteros o inválidos (400)
    for (const badPts of [0, -5, 2.5, "tres", NaN]) {
      const invalidPts = await postPenalty("comisario", {
        nightId: fixture.nightId,
        eventTroupeId: fixture.troupeId,
        reason: "Demora",
        penaltyPoints: badPts,
      });
      assert.equal(invalidPts.status, 400);
    }

    const emptyReason = await postPenalty("comisario", {
      nightId: fixture.nightId,
      eventTroupeId: fixture.troupeId,
      reason: "   ",
      penaltyPoints: 3,
    });
    assert.equal(emptyReason.status, 400);

    // 5. Rechazo en noche no competitiva (409 PENALTY_REQUIRES_COMPETITION_NIGHT)
    const awardsRes = await postPenalty("comisario", {
      nightId: fixture.awardsNightId,
      eventTroupeId: fixture.troupeId,
      reason: "Falta en desfile",
      penaltyPoints: 3,
    });
    assert.equal(awardsRes.status, 409);
    assert.equal((await awardsRes.json()).code, "PENALTY_REQUIRES_COMPETITION_NIGHT");

    // 6. Alta exitosa por COMISARIO (201)
    const createRes = await postPenalty("comisario", {
      nightId: fixture.nightId,
      eventTroupeId: fixture.troupeId,
      reason: "Demora de 8 minutos en salida",
      penaltyPoints: 5,
    });
    assert.equal(createRes.status, 201);
    const penalty = await createRes.json();
    assert.ok(penalty.id);
    assert.equal(penalty.status, "APPLIED");
    assert.equal(penalty.penaltyPoints, 5);
    assert.equal(penalty.reason, "Demora de 8 minutos en salida");

    // Verificar auditoría TROUPE_PENALTY_APPLIED
    const { rows: auditApplied } = await pool.query(
      "SELECT * FROM audit_event WHERE action = 'TROUPE_PENALTY_APPLIED' AND entity_id = $1",
      [penalty.id],
    );
    assert.equal(auditApplied.length, 1);
    assert.equal(auditApplied[0].actor_user_id, fixture.comisarioId);

    // 7. Listado por ADMIN (200)
    const listRes = await getPenalties("admin");
    assert.equal(listRes.status, 200);
    const list = await listRes.json();
    assert.equal(list.length, 1);
    assert.equal(list[0].id, penalty.id);
    assert.equal(list[0].troupeName, "Comparsa Penalizable");

    // 8. Revocación sin motivo o no autorizada (400 / 403)
    const emptyRevoke = await revokePenalty("admin", penalty.id, { revocationReason: "" });
    assert.equal(emptyRevoke.status, 400);

    const whitespaceRevoke = await revokePenalty("admin", penalty.id, { revocationReason: "   " });
    assert.equal(whitespaceRevoke.status, 400);

    const revokeNo2fa = await revokePenalty("comisario-no-2fa", penalty.id, {
      revocationReason: "Sin 2FA",
    });
    assert.equal(revokeNo2fa.status, 403);
    assert.equal((await revokeNo2fa.json()).code, "TWO_FACTOR_REQUIRED");

    const revokeJudge = await revokePenalty("judge", penalty.id, {
      revocationReason: "Intento juez",
    });
    assert.equal(revokeJudge.status, 403);
    assert.equal((await revokeJudge.json()).code, "PENALTIES_ACCESS_DENIED");

    const revokeVeedor = await revokePenalty("veedor", penalty.id, {
      revocationReason: "Intento veedor",
    });
    assert.equal(revokeVeedor.status, 403);
    assert.equal((await revokeVeedor.json()).code, "PENALTIES_ACCESS_DENIED");

    // 9. Revocación exitosa por ADMIN (200)
    const revokeRes = await revokePenalty("admin", penalty.id, {
      revocationReason: "Falla técnica en semáforo de largada constatada",
    });
    assert.equal(revokeRes.status, 200);
    const revoked = await revokeRes.json();
    assert.equal(revoked.status, "REVOKED");
    assert.equal(revoked.revocationReason, "Falla técnica en semáforo de largada constatada");

    // Verificar auditoría TROUPE_PENALTY_REVOKED
    const { rows: auditRevoked } = await pool.query(
      "SELECT * FROM audit_event WHERE action = 'TROUPE_PENALTY_REVOKED' AND entity_id = $1",
      [penalty.id],
    );
    assert.equal(auditRevoked.length, 1);
    assert.equal(auditRevoked[0].actor_user_id, fixture.adminId);

    // 10. No se puede revocar nuevamente (409 CANNOT_MUTATE_REVOKED_PENALTY)
    const secondRevoke = await revokePenalty("comisario", penalty.id, {
      revocationReason: "Segundo intento",
    });
    assert.equal(secondRevoke.status, 409);
    assert.equal((await secondRevoke.json()).code, "CANNOT_MUTATE_REVOKED_PENALTY");

    // 11. Cargar una nueva penalización activa y luego liberar resultados
    const secondPenaltyRes = await postPenalty("comisario", {
      nightId: fixture.nightId,
      eventTroupeId: fixture.troupeId,
      reason: "Menos integrantes que el mínimo reglamentario",
      penaltyPoints: 10,
    });
    assert.equal(secondPenaltyRes.status, 201);
    const secondPenalty = await secondPenaltyRes.json();

    // Liberar resultados del evento
    await pool.query(
      "INSERT INTO results_release(event_id, released_by) VALUES ($1, $2)",
      [fixture.eventId, fixture.adminId],
    );

    // 12. Intentar crear o revocar tras liberación (409 RESULTS_ALREADY_RELEASED)
    const postPostRelease = await postPenalty("comisario", {
      nightId: fixture.nightId,
      eventTroupeId: fixture.troupeId,
      reason: "Falta posterior",
      penaltyPoints: 2,
    });
    assert.equal(postPostRelease.status, 409);
    assert.equal((await postPostRelease.json()).code, "RESULTS_ALREADY_RELEASED");

    const revokePostRelease = await revokePenalty("admin", secondPenalty.id, {
      revocationReason: "Descargo tardío",
    });
    assert.equal(revokePostRelease.status, 409);
    assert.equal((await revokePostRelease.json()).code, "RESULTS_ALREADY_RELEASED");
  });
});

async function setupRankingTestEvent(pool) {
  const { rows: [event] } = await pool.query(
    "INSERT INTO carnival_event(name) VALUES($1) RETURNING id",
    ["Penalties Ranking Test Event"],
  );
  const { rows: [night] } = await pool.query(
    "INSERT INTO night(event_id, name, display_order, kind, status) VALUES($1,$2,$3,$4,$5) RETURNING id",
    [event.id, "Noche 1", 1, "COMPETITION", "OPEN"],
  );
  const { rows: [specialty] } = await pool.query(
    "INSERT INTO event_specialty(event_id, name, code, display_order) VALUES($1,$2,$3,$4) RETURNING id",
    [event.id, "Baile", "BAILE", 1],
  );
  const { rows: [rubric] } = await pool.query(
    "INSERT INTO rubric(event_id, name, code, evaluation_target, rubric_kind) VALUES($1,$2,$3,$4,$5) RETURNING id",
    [event.id, "Coreografía", "COREO", "TROUPE", "NOMINATIVE"],
  );
  const { rows: [item] } = await pool.query(
    "INSERT INTO evaluation_item(event_id, rubric_id, specialty_id, name, code) VALUES($1,$2,$3,$4,$5) RETURNING id",
    [event.id, rubric.id, specialty.id, "Ejecución", "EJECUCION"],
  );
  const { rows: [category] } = await pool.query(
    "INSERT INTO event_category(event_id, name, code, display_order) VALUES($1,$2,$3,$4) RETURNING id",
    [event.id, "Cat A", "CAT_A", 1],
  );
  const { rows: [troupeAlfa] } = await pool.query(
    "INSERT INTO event_troupe(event_id, category_id, name) VALUES($1,$2,$3) RETURNING id",
    [event.id, category.id, "Comparsa Alfa"],
  );
  const { rows: [troupeBeta] } = await pool.query(
    "INSERT INTO event_troupe(event_id, category_id, name) VALUES($1,$2,$3) RETURNING id",
    [event.id, category.id, "Comparsa Beta"],
  );

  const { rows: [scheduleAlfa] } = await pool.query(
    "INSERT INTO night_troupe_schedule(event_id, night_id, event_troupe_id, presentation_order, status) VALUES($1,$2,$3,$4,$5) RETURNING id",
    [event.id, night.id, troupeAlfa.id, 1, "SCHEDULED"],
  );
  const { rows: [scheduleBeta] } = await pool.query(
    "INSERT INTO night_troupe_schedule(event_id, night_id, event_troupe_id, presentation_order, status) VALUES($1,$2,$3,$4,$5) RETURNING id",
    [event.id, night.id, troupeBeta.id, 2, "SCHEDULED"],
  );

  const adminId = randomUUID();
  const comisarioId = randomUUID();
  const judgeId = randomUUID();

  await pool.query(
    `INSERT INTO "user"(id, name, email, "emailVerified")
     VALUES ($1,'Admin Ranking',$2,true), ($3,'Comisario Ranking',$4,true), ($5,'Judge Ranking',$6,true)`,
    [
      adminId, `${adminId}@example.test`,
      comisarioId, `${comisarioId}@example.test`,
      judgeId, `${judgeId}@example.test`,
    ],
  );

  await pool.query("INSERT INTO user_role(user_id, role_code) VALUES ($1,'ADMIN'), ($2,'COMISARIO'), ($3,'JUDGE')", [
    adminId,
    comisarioId,
    judgeId,
  ]);

  const { rows: [judgeProfile] } = await pool.query(
    "INSERT INTO judge_profile(name, email, document_number, registration_status, created_by) VALUES($1,$2,$3,'INVITED',$4) RETURNING id",
    ["Judge Ranking", `${judgeId}@example.test`, `DOC-${judgeId}`, adminId],
  );
  await pool.query("UPDATE judge_profile SET user_id = $1, registration_status = 'REGISTERED' WHERE id = $2", [judgeId, judgeProfile.id]);

  await pool.query("INSERT INTO judge_quota(event_id, night_id, specialty_id, max_assignments) VALUES($1,$2,$3,1)", [event.id, night.id, specialty.id]);
  const { rows: [assignment] } = await pool.query(
    "INSERT INTO judge_assignment(event_id, night_id, specialty_id, judge_profile_id, assignment_type) VALUES($1,$2,$3,$4,'PRIMARY') RETURNING id",
    [event.id, night.id, specialty.id, judgeProfile.id],
  );

  const { rows: [ballot] } = await pool.query(
    "INSERT INTO ballot(event_id, night_id, judge_assignment_id, judge_profile_id, specialty_id, status) VALUES($1,$2,$3,$4,$5,'OPEN') RETURNING id",
    [event.id, night.id, assignment.id, judgeProfile.id, specialty.id],
  );

  // Alfa: 10 pts, Beta: 8 pts
  await pool.query(
    `INSERT INTO ballot_score(ballot_id, event_id, evaluation_item_id, rubric_id, night_schedule_id, score, evaluation_state, status)
     VALUES ($1,$2,$3,$4,$5,10,'SCORED','DRAFT'),
            ($1,$2,$3,$4,$6,8,'SCORED','DRAFT')`,
    [ballot.id, event.id, item.id, rubric.id, scheduleAlfa.id, scheduleBeta.id],
  );

  await pool.query("UPDATE ballot SET status = 'SUBMITTED', submitted_at = CURRENT_TIMESTAMP WHERE id = $1", [ballot.id]);
  await pool.query("UPDATE ballot_score SET status = 'LOCKED', locked_at = CURRENT_TIMESTAMP WHERE ballot_id = $1", [ballot.id]);
  await pool.query(
    "INSERT INTO voting_window(event_id, night_id, status, closed_at) VALUES($1,$2,'CLOSED',CURRENT_TIMESTAMP)",
    [event.id, night.id],
  );

  return {
    eventId: event.id,
    nightId: night.id,
    troupeAlfaId: troupeAlfa.id,
    troupeBetaId: troupeBeta.id,
    adminId,
    comisarioId,
    judgeId,
  };
}

test("API penalizaciones: impacto exacto en el ranking de Mejor Comparsa y preservación de rubros individuales (RF-117, RF-118, RF-119)", async (context) => {
  context.after(async () => {
    await closePool();
    if (originalDatabaseUrl === undefined) delete process.env.DATABASE_URL;
    else process.env.DATABASE_URL = originalDatabaseUrl;
  });

  process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;
  await migrate();
  const pool = getPool();
  const fixture = await setupRankingTestEvent(pool);

  const getSession = async ({ headers }) => {
    const caller = headers.get("x-test-caller");
    if (caller === "admin") return { user: { id: fixture.adminId, twoFactorEnabled: true } };
    if (caller === "comisario") return { user: { id: fixture.comisarioId, twoFactorEnabled: true } };
    return null;
  };

  const app = createApp({ getSession });

  await withServer(app, async (baseUrl) => {
    // 1. Comisario aplica penalización activa de 4 puntos a Comparsa Alfa
    const pen1Res = await fetch(`${baseUrl}/api/v1/events/${fixture.eventId}/penalties`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-test-caller": "comisario" },
      body: JSON.stringify({
        nightId: fixture.nightId,
        eventTroupeId: fixture.troupeAlfaId,
        reason: "Demora en ingreso a pista",
        penaltyPoints: 4,
      }),
    });
    assert.equal(pen1Res.status, 201);
    const pen1 = await pen1Res.json();

    // 2. Comisario aplica segunda penalización de 3 puntos a Alfa y luego Admin la revoca
    const pen2Res = await fetch(`${baseUrl}/api/v1/events/${fixture.eventId}/penalties`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-test-caller": "comisario" },
      body: JSON.stringify({
        nightId: fixture.nightId,
        eventTroupeId: fixture.troupeAlfaId,
        reason: "Falta formal subsanada",
        penaltyPoints: 3,
      }),
    });
    assert.equal(pen2Res.status, 201);
    const pen2 = await pen2Res.json();

    const revokeRes = await fetch(`${baseUrl}/api/v1/events/${fixture.eventId}/penalties/${pen2.id}/revoke`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-test-caller": "admin" },
      body: JSON.stringify({ revocationReason: "Descargo aceptado formalmente" }),
    });
    assert.equal(revokeRes.status, 200);

    // 3. Admin libera resultados
    const releaseRes = await fetch(`${baseUrl}/api/v1/events/${fixture.eventId}/results/release`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-test-caller": "admin" },
    });
    assert.equal(releaseRes.status, 201);

    // 4. Consultar resultados oficiales liberados
    const resultsRes = await fetch(`${baseUrl}/api/v1/events/${fixture.eventId}/results`, {
      headers: { "x-test-caller": "admin" },
    });
    assert.equal(resultsRes.status, 200);
    const results = await resultsRes.json();

    // RF-117: Ranking general ordenado por netScore = max(0, grossScore - totalPenalties)
    // Alfa: bruto 10 - penalizaciones 4 = neto 6
    // Beta: bruto 8 - penalizaciones 0 = neto 8
    // Beta supera a Alfa debido a las penalizaciones aplicadas
    assert.equal(results.overallRanking.length, 2);

    const rank1 = results.overallRanking[0];
    const rank2 = results.overallRanking[1];

    assert.equal(rank1.troupeId, fixture.troupeBetaId);
    assert.equal(rank1.rank, 1);
    assert.equal(rank1.grossScore, 8);
    assert.equal(rank1.totalPenalties, 0);
    assert.equal(rank1.netScore, 8);
    assert.equal(rank1.totalScore, 8);

    assert.equal(rank2.troupeId, fixture.troupeAlfaId);
    assert.equal(rank2.rank, 2);
    assert.equal(rank2.grossScore, 10);
    assert.equal(rank2.totalPenalties, 4);
    assert.equal(rank2.penaltyPoints, 4);
    assert.equal(rank2.netScore, 6);
    assert.equal(rank2.totalScore, 6);

    // RF-119: Desglose de penalizaciones activas expuesto y excluye revocadas
    assert.equal(rank2.penalties.length, 1);
    assert.equal(rank2.penalties[0].id, pen1.id);
    assert.equal(rank2.penalties[0].penaltyPoints, 4);
    assert.equal(rank2.penalties[0].reason, "Demora en ingreso a pista");

    // Mejor comparsa ganadora es Beta
    assert.equal(results.bestTroupe.winnerTroupeId, fixture.troupeBetaId);

    // RF-118: Premios por rubro artístico intactos (Alfa sigue ganando Coreografía con 10 pts)
    const coreoRubric = results.rubricRankings.find((r) => r.rubricCode === "COREO");
    assert.ok(coreoRubric);
    assert.deepEqual(coreoRubric.winnerTroupeIds, [fixture.troupeAlfaId]);
    assert.equal(coreoRubric.winners[0].totalScore, 10);
  });
});
