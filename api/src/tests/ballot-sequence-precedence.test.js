import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import { createApp } from "../app.js";
import { closePool, getPool } from "../db/pool.js";
import { migrate } from "../db/migrate.js";
import { saveScore, syncBallot } from "../modules/ballots/ballot-service.js";

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

test("Spec 025: Backend Defense (RF-193) — Votación secuencial por orden de pasada", {
  skip: !process.env.TEST_DATABASE_URL,
}, async (context) => {
  context.after(async () => {
    await closePool();
    if (originalDatabaseUrl === undefined) delete process.env.DATABASE_URL;
    else process.env.DATABASE_URL = originalDatabaseUrl;
  });
  process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;
  await migrate();

  const pool = getPool();
  const adminId = randomUUID();
  const judgeUserId = randomUUID();

  await pool.query(
    `INSERT INTO "user"(id, name, email, "emailVerified")
     VALUES ($1, 'Admin Seq', $2, true), ($3, 'Judge Seq', $4, true)`,
    [
      adminId,
      `${adminId}@example.test`,
      judgeUserId,
      `${judgeUserId}@example.test`,
    ],
  );
  await pool.query("INSERT INTO user_role (user_id, role_code) VALUES ($1, 'ADMIN')", [adminId]);
  await pool.query("INSERT INTO user_role (user_id, role_code) VALUES ($1, 'JUDGE')", [judgeUserId]);

  const { rows: [event] } = await pool.query(
    "INSERT INTO carnival_event(name) VALUES($1) RETURNING id", ["Evento Secuencia Pasada"],
  );

  const { rows: [night] } = await pool.query(
    "INSERT INTO night(event_id, name, display_order, kind, status) VALUES($1,$2,$3,$4,$5) RETURNING id",
    [event.id, "Noche Secuencial", 1, "COMPETITION", "OPEN"],
  );
  const { rows: [specialty] } = await pool.query(
    "INSERT INTO event_specialty(event_id, name, code, display_order) VALUES($1,$2,$3,$4) RETURNING id",
    [event.id, "Danza", "DANZA", 1],
  );
  const { rows: [rubric] } = await pool.query(
    "INSERT INTO rubric(event_id, name, code, evaluation_target) VALUES($1,$2,$3,$4) RETURNING id",
    [event.id, "Coreografía", "COREO", "TROUPE"],
  );
  const { rows: [item1] } = await pool.query(
    "INSERT INTO evaluation_item(event_id, rubric_id, specialty_id, name, code) VALUES($1,$2,$3,$4,$5) RETURNING id",
    [event.id, rubric.id, specialty.id, "Sincronía", "SINCRO"],
  );
  const { rows: [item2] } = await pool.query(
    "INSERT INTO evaluation_item(event_id, rubric_id, specialty_id, name, code) VALUES($1,$2,$3,$4,$5) RETURNING id",
    [event.id, rubric.id, specialty.id, "Originalidad", "ORIGINAL"],
  );
  const { rows: [category] } = await pool.query(
    "INSERT INTO event_category(event_id, name, code, display_order) VALUES($1,$2,$3,$4) RETURNING id",
    [event.id, "Categoría Única", "CATU", 1],
  );

  // 3 comparsas
  const { rows: [troupe1] } = await pool.query(
    "INSERT INTO event_troupe(event_id, category_id, name, brand_color) VALUES($1,$2,$3,$4) RETURNING id",
    [event.id, category.id, "Comparsa Primera", "#FF0000"],
  );
  const { rows: [troupe2] } = await pool.query(
    "INSERT INTO event_troupe(event_id, category_id, name, brand_color) VALUES($1,$2,$3,$4) RETURNING id",
    [event.id, category.id, "Comparsa Segunda", "#00FF00"],
  );
  const { rows: [troupe3] } = await pool.query(
    "INSERT INTO event_troupe(event_id, category_id, name, brand_color) VALUES($1,$2,$3,$4) RETURNING id",
    [event.id, category.id, "Comparsa Tercera", "#0000FF"],
  );

  await pool.query(
    "INSERT INTO night_troupe_schedule(event_id, night_id, event_troupe_id, presentation_order, status) VALUES($1,$2,$3,$4,$5)",
    [event.id, night.id, troupe1.id, 1, "SCHEDULED"],
  );
  await pool.query(
    "INSERT INTO night_troupe_schedule(event_id, night_id, event_troupe_id, presentation_order, status) VALUES($1,$2,$3,$4,$5)",
    [event.id, night.id, troupe2.id, 2, "SCHEDULED"],
  );
  await pool.query(
    "INSERT INTO night_troupe_schedule(event_id, night_id, event_troupe_id, presentation_order, status) VALUES($1,$2,$3,$4,$5)",
    [event.id, night.id, troupe3.id, 3, "SCHEDULED"],
  );

  const { rows: [judgeProfile] } = await pool.query(
    "INSERT INTO judge_profile(name, email, document_number, registration_status, created_by, user_id) VALUES($1,$2,$3,$4,$5,$6) RETURNING id",
    ["Judge Seq Test", `judge-${randomUUID()}@test.test`, `DOC-${randomUUID()}`, "REGISTERED", adminId, judgeUserId],
  );

  await pool.query(
    "INSERT INTO judge_quota(event_id, night_id, specialty_id, max_assignments) VALUES($1,$2,$3,$4)",
    [event.id, night.id, specialty.id, 3],
  );

  await pool.query(
    `INSERT INTO judge_assignment(event_id, night_id, specialty_id, judge_profile_id, assignment_type)
     VALUES($1,$2,$3,$4,$5) RETURNING id`,
    [event.id, night.id, specialty.id, judgeProfile.id, "PRIMARY"],
  );

  const openClient = await pool.connect();
  try {
    await openClient.query("BEGIN");
    await openClient.query("SELECT set_config('app.allow_event_open','true',true)");
    await openClient.query("UPDATE carnival_event SET status = 'OPEN', updated_at = CURRENT_TIMESTAMP WHERE id = $1", [event.id]);
    await openClient.query("COMMIT");
  } catch (err) {
    await openClient.query("ROLLBACK");
    throw err;
  } finally {
    openClient.release();
  }

  const app = createApp({
    getSession: async ({ headers }) => {
      const role = headers.get("x-test-session");
      if (role === "admin") return { user: { id: adminId, twoFactorEnabled: true } };
      if (role === "judge") return { user: { id: judgeUserId, twoFactorEnabled: true } };
      return null;
    },
  });

  await withServer(app, async (baseUrl) => {
    const adminHeaders = { "content-type": "application/json", "x-test-session": "admin" };
    const judgeHeaders = { "content-type": "application/json", "x-test-session": "judge" };

    // 1. Abrir votación
    const openRes = await fetch(`${baseUrl}/api/v1/events/${event.id}/nights/${night.id}/voting/open`, {
      method: "POST",
      headers: adminHeaders,
    });
    assert.equal(openRes.status, 201);

    // 2. Obtener planilla y scores
    const listRes = await fetch(`${baseUrl}/api/v1/judge/ballots?include=progress`, {
      headers: judgeHeaders,
    });
    assert.equal(listRes.status, 200);
    const [ballotSummary] = await listRes.json();
    const ballotId = ballotSummary.id;

    const detailRes = await fetch(`${baseUrl}/api/v1/judge/ballots/${ballotId}`, {
      headers: judgeHeaders,
    });
    assert.equal(detailRes.status, 200);
    const ballotDetail = await detailRes.json();

    const t1Scores = ballotDetail.scores.filter((s) => s.troupeName === "Comparsa Primera");
    const t2Scores = ballotDetail.scores.filter((s) => s.troupeName === "Comparsa Segunda");
    const t3Scores = ballotDetail.scores.filter((s) => s.troupeName === "Comparsa Tercera");

    assert.equal(t1Scores.length, 2);
    assert.equal(t2Scores.length, 2);
    assert.equal(t3Scores.length, 2);

    // 3. Intento de calificar Comparsa 2 estando Comparsa 1 pendiente -> Debe fallar con 409 TROUPE_PRECEDENCE_REQUIRED
    const outOfOrderRes = await fetch(`${baseUrl}/api/v1/judge/ballots/${ballotId}/scores/${t2Scores[0].id}`, {
      method: "PUT",
      headers: judgeHeaders,
      body: JSON.stringify({ evaluationState: "SCORED", score: 8 }),
    });
    assert.equal(outOfOrderRes.status, 409);
    const outOfOrderBody = await outOfOrderRes.json();
    assert.equal(outOfOrderBody.code, "TROUPE_PRECEDENCE_REQUIRED");

    // 4. Intento directo vía servicio saveScore -> Debe rechazar con TROUPE_PRECEDENCE_REQUIRED
    await assert.rejects(
      async () => {
        await saveScore({
          actorUserId: judgeUserId,
          ballotId,
          scoreId: t3Scores[0].id,
          evaluationState: "SCORED",
          score: 7,
        });
      },
      (err) => {
        assert.equal(err.message, "TROUPE_PRECEDENCE_REQUIRED");
        assert.equal(err.code, "TROUPE_PRECEDENCE_REQUIRED");
        return true;
      },
    );

    // 5. Calificar ítem 1 de Comparsa 1 -> Debe tener éxito
    const t1Score1Res = await fetch(`${baseUrl}/api/v1/judge/ballots/${ballotId}/scores/${t1Scores[0].id}`, {
      method: "PUT",
      headers: judgeHeaders,
      body: JSON.stringify({ evaluationState: "SCORED", score: 9 }),
    });
    assert.equal(t1Score1Res.status, 200);

    // 6. Comparsa 1 aún tiene ítem 2 pendiente -> Comparsa 2 sigue bloqueada
    const stillBlockedRes = await fetch(`${baseUrl}/api/v1/judge/ballots/${ballotId}/scores/${t2Scores[0].id}`, {
      method: "PUT",
      headers: judgeHeaders,
      body: JSON.stringify({ evaluationState: "SCORED", score: 8 }),
    });
    assert.equal(stillBlockedRes.status, 409);
    const stillBlockedBody = await stillBlockedRes.json();
    assert.equal(stillBlockedBody.code, "TROUPE_PRECEDENCE_REQUIRED");

    // 7. Calificar ítem 2 de Comparsa 1 como NOT_PRESENTED -> Debe tener éxito y completar Comparsa 1
    const t1Score2Res = await fetch(`${baseUrl}/api/v1/judge/ballots/${ballotId}/scores/${t1Scores[1].id}`, {
      method: "PUT",
      headers: judgeHeaders,
      body: JSON.stringify({ evaluationState: "NOT_PRESENTED", score: 0 }),
    });
    assert.equal(t1Score2Res.status, 200);

    // 8. Ahora Comparsa 2 está desbloqueada -> Calificar ítem 1 de Comparsa 2 tiene éxito
    const t2Score1Res = await fetch(`${baseUrl}/api/v1/judge/ballots/${ballotId}/scores/${t2Scores[0].id}`, {
      method: "PUT",
      headers: judgeHeaders,
      body: JSON.stringify({ evaluationState: "SCORED", score: 8 }),
    });
    assert.equal(t2Score1Res.status, 200);

    // 9. Comparsa 3 permanece bloqueada porque Comparsa 2 tiene ítem 2 pendiente
    const t3BlockedRes = await fetch(`${baseUrl}/api/v1/judge/ballots/${ballotId}/scores/${t3Scores[0].id}`, {
      method: "PUT",
      headers: judgeHeaders,
      body: JSON.stringify({ evaluationState: "SCORED", score: 10 }),
    });
    assert.equal(t3BlockedRes.status, 409);
    assert.equal((await t3BlockedRes.json()).code, "TROUPE_PRECEDENCE_REQUIRED");

    // 10. Completar Comparsa 2 con su ítem 2
    const t2Score2Res = await fetch(`${baseUrl}/api/v1/judge/ballots/${ballotId}/scores/${t2Scores[1].id}`, {
      method: "PUT",
      headers: judgeHeaders,
      body: JSON.stringify({ evaluationState: "SCORED", score: 9 }),
    });
    assert.equal(t2Score2Res.status, 200);

    // 11. Ahora Comparsa 3 está desbloqueada -> Calificar ítem 1 de Comparsa 3 tiene éxito
    const t3Score1Res = await fetch(`${baseUrl}/api/v1/judge/ballots/${ballotId}/scores/${t3Scores[0].id}`, {
      method: "PUT",
      headers: judgeHeaders,
      body: JSON.stringify({ evaluationState: "SCORED", score: 10 }),
    });
    assert.equal(t3Score1Res.status, 200);

    // 12. Calificar ítem 2 de Comparsa 3 -> 100% de la planilla completa
    const t3Score2Res = await fetch(`${baseUrl}/api/v1/judge/ballots/${ballotId}/scores/${t3Scores[1].id}`, {
      method: "PUT",
      headers: judgeHeaders,
      body: JSON.stringify({ evaluationState: "SCORED", score: 9 }),
    });
    assert.equal(t3Score2Res.status, 200);

    // 13. Confirmar la planilla completa
    const submitRes = await fetch(`${baseUrl}/api/v1/judge/ballots/${ballotId}/submit`, {
      method: "POST",
      headers: judgeHeaders,
    });
    assert.equal(submitRes.status, 200);
    const submitData = await submitRes.json();
    assert.equal(submitData.status, "SUBMITTED");
  });
});
