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

test("API votación: idempotencia en guardado de puntaje y confirmación de planilla (RF-173)", {
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
     VALUES ($1, 'Admin Idempotency', $2, true), ($3, 'Judge Idempotency', $4, true)`,
    [adminId, `${adminId}@example.test`, judgeUserId, `${judgeUserId}@example.test`],
  );
  await pool.query("INSERT INTO user_role (user_id, role_code) VALUES ($1, 'ADMIN')", [adminId]);
  await pool.query("INSERT INTO user_role (user_id, role_code) VALUES ($1, 'JUDGE')", [judgeUserId]);

  const { rows: [event] } = await pool.query(
    "INSERT INTO carnival_event(name) VALUES($1) RETURNING id",
    ["Idempotency Event"],
  );
  const { rows: [night] } = await pool.query(
    "INSERT INTO night(event_id, name, display_order, kind, status) VALUES($1,$2,$3,$4,$5) RETURNING id",
    [event.id, "Noche Idempotencia", 1, "COMPETITION", "OPEN"],
  );
  const { rows: [specialty] } = await pool.query(
    "INSERT INTO event_specialty(event_id, name, code, display_order) VALUES($1,$2,$3,$4) RETURNING id",
    [event.id, "Baile", `BAI-${randomUUID().slice(0, 6)}`, 1],
  );
  const { rows: [rubric] } = await pool.query(
    "INSERT INTO rubric(event_id, name, code, evaluation_target) VALUES($1,$2,$3,$4) RETURNING id",
    [event.id, "Coreografía", `COR-${randomUUID().slice(0, 6)}`, "TROUPE"],
  );
  const { rows: [item] } = await pool.query(
    "INSERT INTO evaluation_item(event_id, rubric_id, specialty_id, name, code) VALUES($1,$2,$3,$4,$5) RETURNING id",
    [event.id, rubric.id, specialty.id, "Ejecución", `EJE-${randomUUID().slice(0, 6)}`],
  );
  const { rows: [category] } = await pool.query(
    "INSERT INTO event_category(event_id, name, code, display_order) VALUES($1,$2,$3,$4) RETURNING id",
    [event.id, "Primera", `CAT-${randomUUID().slice(0, 6)}`, 1],
  );
  const { rows: [troupe] } = await pool.query(
    "INSERT INTO event_troupe(event_id, category_id, name) VALUES($1,$2,$3) RETURNING id",
    [event.id, category.id, "Comparsa Idempotente"],
  );
  await pool.query(
    "INSERT INTO night_troupe_schedule(event_id, night_id, event_troupe_id, presentation_order, status) VALUES($1,$2,$3,$4,$5)",
    [event.id, night.id, troupe.id, 1, "SCHEDULED"],
  );
  await pool.query(
    "INSERT INTO judge_quota(event_id, night_id, specialty_id, max_assignments) VALUES($1,$2,$3,$4)",
    [event.id, night.id, specialty.id, 1],
  );
  const { rows: [judgeProfile] } = await pool.query(
    "INSERT INTO judge_profile(name, email, document_number, registration_status, created_by) VALUES($1,$2,$3,$4,$5) RETURNING id",
    ["Judge Idempotency", `judge-${randomUUID()}@test.test`, `DOC-${randomUUID()}`, "INVITED", adminId],
  );
  await pool.query(
    "UPDATE judge_profile SET user_id = $2, registration_status = 'REGISTERED' WHERE id = $1",
    [judgeProfile.id, judgeUserId],
  );
  await pool.query(
    `INSERT INTO judge_assignment(event_id, night_id, specialty_id, judge_profile_id, assignment_type)
     VALUES($1,$2,$3,$4,'PRIMARY')`,
    [event.id, night.id, specialty.id, judgeProfile.id],
  );

  const openClient = await pool.connect();
  try {
    await openClient.query("BEGIN");
    await openClient.query("SELECT set_config('app.allow_event_open','true',true)");
    await openClient.query("UPDATE carnival_event SET status = 'OPEN', updated_at = CURRENT_TIMESTAMP WHERE id = $1", [event.id]);
    await openClient.query("COMMIT");
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

    // Abrir votación
    const openRes = await fetch(`${baseUrl}/api/v1/events/${event.id}/nights/${night.id}/voting/open`, {
      method: "POST",
      headers: adminHeaders,
    });
    assert.equal(openRes.status, 201);

    // Obtener planilla del juez
    const ownBallotsRes = await fetch(`${baseUrl}/api/v1/judge/ballots`, { headers: judgeHeaders });
    const ownBallots = await ownBallotsRes.json();
    assert.equal(ownBallots.length, 1);
    const ballotId = ownBallots[0].id;

    // Obtener detalles de la planilla (con scores)
    const ballotDetailsRes = await fetch(`${baseUrl}/api/v1/judge/ballots/${ballotId}`, { headers: judgeHeaders });
    const ballotDetails = await ballotDetailsRes.json();
    assert.equal(ballotDetails.scores.length, 1);
    const scoreId = ballotDetails.scores[0].id;

    const scoreIdempotencyKey = randomUUID();

    // 1. Guardar puntaje inicial con Idempotency-Key
    const firstSaveResponse = await fetch(`${baseUrl}/api/v1/judge/ballots/${ballotId}/scores/${scoreId}`, {
      method: "PUT",
      headers: {
        ...judgeHeaders,
        "Idempotency-Key": scoreIdempotencyKey,
      },
      body: JSON.stringify({ evaluationState: "SCORED", score: 9 }),
    });
    assert.equal(firstSaveResponse.status, 200);
    assert.equal(firstSaveResponse.headers.has("Idempotency-Replay"), false);
    const firstSaveData = await firstSaveResponse.json();
    assert.equal(firstSaveData.score, 9);
    assert.equal(firstSaveData.evaluationState, "SCORED");

    // 2. Reintento con la misma Idempotency-Key y mismo payload debe responder 200 sin SCORE_IMMUTABLE
    const replaySaveResponse = await fetch(`${baseUrl}/api/v1/judge/ballots/${ballotId}/scores/${scoreId}`, {
      method: "PUT",
      headers: {
        ...judgeHeaders,
        "Idempotency-Key": scoreIdempotencyKey,
      },
      body: JSON.stringify({ evaluationState: "SCORED", score: 9 }),
    });
    assert.equal(replaySaveResponse.status, 200);
    assert.equal(replaySaveResponse.headers.get("Idempotency-Replay"), "true");
    const replaySaveData = await replaySaveResponse.json();
    assert.equal(replaySaveData.score, 9);
    assert.equal(replaySaveData.evaluationState, "SCORED");

    // 3. Reintento con la misma Idempotency-Key pero payload discrepante debe responder 409 SYNC_OPERATION_MISMATCH
    const mismatchSaveResponse = await fetch(`${baseUrl}/api/v1/judge/ballots/${ballotId}/scores/${scoreId}`, {
      method: "PUT",
      headers: {
        ...judgeHeaders,
        "Idempotency-Key": scoreIdempotencyKey,
      },
      body: JSON.stringify({ evaluationState: "SCORED", score: 8 }),
    });
    assert.equal(mismatchSaveResponse.status, 409);
    const mismatchData = await mismatchSaveResponse.json();
    assert.equal(mismatchData.code, "SYNC_OPERATION_MISMATCH");

    // 4. Submit con Idempotency-Key
    const submitIdempotencyKey = randomUUID();
    const firstSubmitResponse = await fetch(`${baseUrl}/api/v1/judge/ballots/${ballotId}/submit`, {
      method: "POST",
      headers: {
        ...judgeHeaders,
        "Idempotency-Key": submitIdempotencyKey,
      },
      body: "{}",
    });
    assert.equal(firstSubmitResponse.status, 200);
    assert.equal(firstSubmitResponse.headers.has("Idempotency-Replay"), false);
    const firstSubmitData = await firstSubmitResponse.json();
    assert.equal(firstSubmitData.status, "SUBMITTED");

    // 5. Reintento de Submit con la misma Idempotency-Key debe responder 200 sin BALLOT_ALREADY_SUBMITTED
    const replaySubmitResponse = await fetch(`${baseUrl}/api/v1/judge/ballots/${ballotId}/submit`, {
      method: "POST",
      headers: {
        ...judgeHeaders,
        "Idempotency-Key": submitIdempotencyKey,
      },
      body: "{}",
    });
    assert.equal(replaySubmitResponse.status, 200);
    assert.equal(replaySubmitResponse.headers.get("Idempotency-Replay"), "true");
    const replaySubmitData = await replaySubmitResponse.json();
    assert.equal(replaySubmitData.status, "SUBMITTED");
  });
});
