import { describe, it, before, after, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { getPool, closePool } from "../pool.js";
import { migrate } from "../migrate.js";
import { getTroupePenaltiesTotalsByEvent } from "../../modules/penalties/penalty-service.js";
import { computeOverallRanking } from "../../modules/results/results-service.js";

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

async function setupPenaltyTestData() {
  const suffix = Math.random().toString(36).slice(2, 8);
  const userSuffix = randomUUID();

  // Crear usuario comisario / aplicador
  await client.query(
    `INSERT INTO "user"(id, name, email, "emailVerified")
     VALUES ($1, $2, $3, true)`,
    [userSuffix, "Comisario Test", `comisario-${suffix}@carnaval.test`],
  );

  const { rows: [event] } = await client.query(
    "INSERT INTO carnival_event(name) VALUES($1) RETURNING id",
    [`Test Event ${suffix}`],
  );

  const { rows: [night] } = await client.query(
    "INSERT INTO night(event_id, name, display_order, kind, status) VALUES($1,$2,$3,$4,$5) RETURNING id",
    [event.id, "Noche 1", 1, "COMPETITION", "OPEN"],
  );

  const { rows: [awardsNight] } = await client.query(
    "INSERT INTO night(event_id, name, display_order, kind, status) VALUES($1,$2,$3,$4,$5) RETURNING id",
    [event.id, "Noche Premios", 2, "AWARDS", "OPEN"],
  );

  const { rows: [category] } = await client.query(
    "INSERT INTO event_category(event_id, name, code, display_order) VALUES($1,$2,$3,$4) RETURNING id",
    [event.id, "Cat A", "CAT_A", 1],
  );

  const { rows: [troupe] } = await client.query(
    "INSERT INTO event_troupe(event_id, category_id, name) VALUES($1,$2,$3) RETURNING id",
    [event.id, category.id, `Comparsa ${suffix}`],
  );

  return {
    eventId: event.id,
    nightId: night.id,
    awardsNightId: awardsNight.id,
    troupeId: troupe.id,
    userId: userSuffix,
  };
}

describe("troupe_penalty DB", () => {
  it("permite insertar una penalización válida con puntos mayores a cero", async () => {
    const data = await setupPenaltyTestData();
    const { rows: [penalty] } = await client.query(
      `INSERT INTO troupe_penalty(event_id, night_id, event_troupe_id, reason, penalty_points, applied_by_user_id)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, status, penalty_points, reason`,
      [data.eventId, data.nightId, data.troupeId, "Demora de 5 minutos en pista", 5, data.userId],
    );

    assert.ok(penalty.id);
    assert.equal(penalty.status, "APPLIED");
    assert.equal(penalty.penalty_points, 5);
    assert.equal(penalty.reason, "Demora de 5 minutos en pista");
  });

  it("rechaza penalizaciones con puntos menores o iguales a cero", async () => {
    const data = await setupPenaltyTestData();
    await assert.rejects(
      client.query(
        `INSERT INTO troupe_penalty(event_id, night_id, event_troupe_id, reason, penalty_points, applied_by_user_id)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [data.eventId, data.nightId, data.troupeId, "Sin sanción", 0, data.userId],
      ),
      /check constraint|check/i,
    );
  });

  it("rechaza penalizaciones en una noche no competitiva (AWARDS)", async () => {
    const data = await setupPenaltyTestData();
    await assert.rejects(
      client.query(
        `INSERT INTO troupe_penalty(event_id, night_id, event_troupe_id, reason, penalty_points, applied_by_user_id)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [data.eventId, data.awardsNightId, data.troupeId, "Falta en entrega", 2, data.userId],
      ),
      /PENALTY_REQUIRES_COMPETITION_NIGHT/,
    );
  });

  it("rechaza penalizaciones con comparsa de distinto evento (unicidad de contexto)", async () => {
    const data1 = await setupPenaltyTestData();
    const data2 = await setupPenaltyTestData();

    // Intentar asociar noche de evento 1 con comparsa de evento 2
    await assert.rejects(
      client.query(
        `INSERT INTO troupe_penalty(event_id, night_id, event_troupe_id, reason, penalty_points, applied_by_user_id)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [data1.eventId, data1.nightId, data2.troupeId, "Incompatibilidad de comparsa", 3, data1.userId],
      ),
      { code: "23503" },
    );
  });

  it("rechaza penalizaciones con noche de distinto evento (unicidad de contexto)", async () => {
    const data1 = await setupPenaltyTestData();
    const data2 = await setupPenaltyTestData();

    // Intentar asociar noche de evento 2 con comparsa de evento 1
    await assert.rejects(
      client.query(
        `INSERT INTO troupe_penalty(event_id, night_id, event_troupe_id, reason, penalty_points, applied_by_user_id)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [data1.eventId, data2.nightId, data1.troupeId, "Incompatibilidad de noche", 3, data1.userId],
      ),
      { code: "23503" },
    );
  });

  it("permite revocar una penalización con motivo obligatorio", async () => {
    const data = await setupPenaltyTestData();
    const { rows: [penalty] } = await client.query(
      `INSERT INTO troupe_penalty(event_id, night_id, event_troupe_id, reason, penalty_points, applied_by_user_id)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id`,
      [data.eventId, data.nightId, data.troupeId, "Error de cronómetro inicial", 4, data.userId],
    );

    const { rows: [revoked] } = await client.query(
      `UPDATE troupe_penalty
       SET status = 'REVOKED',
           revoked_by_user_id = $1,
           revocation_reason = $2
       WHERE id = $3
       RETURNING id, status, revocation_reason`,
      [data.userId, "Descargo de comparsa aceptado por fiscalía", penalty.id],
    );

    assert.equal(revoked.status, "REVOKED");
    assert.equal(revoked.revocation_reason, "Descargo de comparsa aceptado por fiscalía");
  });

  it("rechaza revocar una penalización sin motivo o sin usuario revocador", async () => {
    const data = await setupPenaltyTestData();
    const { rows: [penalty] } = await client.query(
      `INSERT INTO troupe_penalty(event_id, night_id, event_troupe_id, reason, penalty_points, applied_by_user_id)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id`,
      [data.eventId, data.nightId, data.troupeId, "Falta leve", 1, data.userId],
    );

    await assert.rejects(
      client.query(
        `UPDATE troupe_penalty
         SET status = 'REVOKED'
         WHERE id = $1`,
        [penalty.id],
      ),
      /check constraint|troupe_penalty_revocation_consistency/i,
    );
  });

  it("impide mutar una penalización ya revocada", async () => {
    const data = await setupPenaltyTestData();
    const { rows: [penalty] } = await client.query(
      `INSERT INTO troupe_penalty(event_id, night_id, event_troupe_id, reason, penalty_points, applied_by_user_id)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id`,
      [data.eventId, data.nightId, data.troupeId, "Falta a revocar", 2, data.userId],
    );

    await client.query(
      `UPDATE troupe_penalty
       SET status = 'REVOKED',
           revoked_by_user_id = $1,
           revocation_reason = $2
       WHERE id = $3`,
      [data.userId, "Anulado por comisariato", penalty.id],
    );

    await assert.rejects(
      client.query(
        `UPDATE troupe_penalty
         SET status = 'APPLIED'
         WHERE id = $1`,
        [penalty.id],
      ),
      /CANNOT_MUTATE_REVOKED_PENALTY/,
    );
  });

  it("impide modificar campos inmutables como puntos o comparsa en una penalización existente", async () => {
    const data = await setupPenaltyTestData();
    const { rows: [penalty] } = await client.query(
      `INSERT INTO troupe_penalty(event_id, night_id, event_troupe_id, reason, penalty_points, applied_by_user_id)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id`,
      [data.eventId, data.nightId, data.troupeId, "Falta inicial", 5, data.userId],
    );

    await assert.rejects(
      client.query(
        `UPDATE troupe_penalty
         SET penalty_points = 10
         WHERE id = $1`,
        [penalty.id],
      ),
      /PENALTY_FIELDS_IMMUTABLE/,
    );
  });

  it("impide borrar físicamente una penalización", async () => {
    const data = await setupPenaltyTestData();
    const { rows: [penalty] } = await client.query(
      `INSERT INTO troupe_penalty(event_id, night_id, event_troupe_id, reason, penalty_points, applied_by_user_id)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id`,
      [data.eventId, data.nightId, data.troupeId, "Falta a intentar borrar", 3, data.userId],
    );

    await assert.rejects(
      client.query("DELETE FROM troupe_penalty WHERE id = $1", [penalty.id]),
      /CANNOT_DELETE_PENALTY/,
    );
  });

  it("impide insertar nuevas penalizaciones tras la liberación de resultados", async () => {
    const data = await setupPenaltyTestData();

    // Liberar resultados del evento
    await client.query(
      `INSERT INTO results_release(event_id, released_by)
       VALUES ($1, $2)`,
      [data.eventId, data.userId],
    );

    // Intentar insertar nueva penalización tras liberación
    await assert.rejects(
      client.query(
        `INSERT INTO troupe_penalty(event_id, night_id, event_troupe_id, reason, penalty_points, applied_by_user_id)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [data.eventId, data.nightId, data.troupeId, "Falta tardía", 5, data.userId],
      ),
      /RESULTS_ALREADY_RELEASED/,
    );
  });

  it("impide revocar penalizaciones existentes tras la liberación de resultados", async () => {
    const data = await setupPenaltyTestData();

    // Insertar penalización antes de liberar
    const { rows: [penalty] } = await client.query(
      `INSERT INTO troupe_penalty(event_id, night_id, event_troupe_id, reason, penalty_points, applied_by_user_id)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id`,
      [data.eventId, data.nightId, data.troupeId, "Falta previa", 2, data.userId],
    );

    // Liberar resultados del evento
    await client.query(
      `INSERT INTO results_release(event_id, released_by)
       VALUES ($1, $2)`,
      [data.eventId, data.userId],
    );

    // Intentar revocar penalización existente tras liberación
    await assert.rejects(
      client.query(
        `UPDATE troupe_penalty
         SET status = 'REVOKED',
             revoked_by_user_id = $1,
             revocation_reason = 'Tardío'
         WHERE id = $2`,
        [data.userId, penalty.id],
      ),
      /RESULTS_ALREADY_RELEASED/,
    );
  });

  it("deducción: acumula penalizaciones activas, excluye revocadas y respeta piso de cero (RF-117, RF-119)", async () => {
    const data = await setupPenaltyTestData();

    // Crear segunda comparsa para contrastar ranking
    const { rows: [troupeCat] } = await client.query(
      "SELECT category_id FROM event_troupe WHERE id = $1",
      [data.troupeId],
    );
    const { rows: [troupe2] } = await client.query(
      "INSERT INTO event_troupe(event_id, category_id, name) VALUES($1, $2, $3) RETURNING id",
      [data.eventId, troupeCat.category_id, "Comparsa Competidora"],
    );

    // 1. Dos penalizaciones activas para comparsa 1 (3 y 5 pts)
    await client.query(
      `INSERT INTO troupe_penalty(event_id, night_id, event_troupe_id, reason, penalty_points, applied_by_user_id)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [data.eventId, data.nightId, data.troupeId, "Demora en ingreso", 3, data.userId],
    );
    await client.query(
      `INSERT INTO troupe_penalty(event_id, night_id, event_troupe_id, reason, penalty_points, applied_by_user_id)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [data.eventId, data.nightId, data.troupeId, "Exceso de sonido", 5, data.userId],
    );

    // 2. Penalización revocada de 10 puntos para comparsa 1
    const { rows: [revoked] } = await client.query(
      `INSERT INTO troupe_penalty(event_id, night_id, event_troupe_id, reason, penalty_points, applied_by_user_id)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
      [data.eventId, data.nightId, data.troupeId, "Falta a revocar", 10, data.userId],
    );
    await client.query(
      `UPDATE troupe_penalty
       SET status = 'REVOKED', revoked_by_user_id = $1, revocation_reason = 'Descargo formal aceptado'
       WHERE id = $2`,
      [data.userId, revoked.id],
    );

    // 3. Penalización activa de 2 puntos para comparsa 2
    await client.query(
      `INSERT INTO troupe_penalty(event_id, night_id, event_troupe_id, reason, penalty_points, applied_by_user_id)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [data.eventId, data.nightId, troupe2.id, "Falta leve de vestuario", 2, data.userId],
    );

    // Consultar totales mediante getTroupePenaltiesTotalsByEvent
    const totals = await getTroupePenaltiesTotalsByEvent({ eventId: data.eventId, client });
    const c1Totals = totals.get(data.troupeId);
    const c2Totals = totals.get(troupe2.id);

    // Comparsa 1: 3 + 5 = 8 puntos aplicados (los 10 revocados se excluyen)
    assert.equal(c1Totals.totalPenaltyPoints, 8);
    assert.equal(c1Totals.penalties.length, 2);
    const c1Points = c1Totals.penalties.map((p) => p.penaltyPoints).sort((a, b) => a - b);
    assert.deepEqual(c1Points, [3, 5]);

    // Comparsa 2: 2 puntos aplicados
    assert.equal(c2Totals.totalPenaltyPoints, 2);
    assert.equal(c2Totals.penalties.length, 1);
    assert.equal(c2Totals.penalties[0].penaltyPoints, 2);

    // Verificar cálculo determinístico de ranking con computeOverallRanking
    // Caso con piso 0: comparsa 1 tiene bruto 6 < penalizaciones 8 -> neto = max(0, 6 - 8) = 0
    // Comparsa 2 tiene bruto 10 - penalizaciones 2 = 8
    const mockScores = [
      { troupeId: data.troupeId, troupeName: "Comparsa 1", rubricKind: "NOMINATIVE", totalScore: 6, rubricId: randomUUID(), rubricName: "R1", rubricCode: "R1" },
      { troupeId: troupe2.id, troupeName: "Comparsa Competidora", rubricKind: "NOMINATIVE", totalScore: 10, rubricId: randomUUID(), rubricName: "R1", rubricCode: "R1" },
    ];

    const overall = computeOverallRanking(mockScores, totals);
    const r1 = overall.find((t) => t.troupeId === data.troupeId);
    const r2 = overall.find((t) => t.troupeId === troupe2.id);

    assert.equal(r1.grossScore, 6);
    assert.equal(r1.totalPenalties, 8);
    assert.equal(r1.netScore, 0); // piso 0 garantizado
    assert.equal(r1.totalScore, 0);

    assert.equal(r2.grossScore, 10);
    assert.equal(r2.totalPenalties, 2);
    assert.equal(r2.netScore, 8);
    assert.equal(r2.totalScore, 8);

    assert.equal(r2.rank, 1);
    assert.equal(r1.rank, 2);
  });
});
