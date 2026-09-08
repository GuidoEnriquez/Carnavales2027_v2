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

test("API jurado: include=progress y brand_color de comparsa", {
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
     VALUES ($1, 'Admin progress', $2, true), ($3, 'Judge progress', $4, true)`,
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
    "INSERT INTO carnival_event(name) VALUES($1) RETURNING id", ["Progress & BrandColor Event"],
  );

  const { rows: [night] } = await pool.query(
    "INSERT INTO night(event_id, name, display_order, kind, status) VALUES($1,$2,$3,$4,$5) RETURNING id",
    [event.id, "Noche Progreso", 1, "COMPETITION", "OPEN"],
  );
  const { rows: [specialty] } = await pool.query(
    "INSERT INTO event_specialty(event_id, name, code, display_order) VALUES($1,$2,$3,$4) RETURNING id",
    [event.id, "Música", "MUSICA", 1],
  );
  const { rows: [rubric] } = await pool.query(
    "INSERT INTO rubric(event_id, name, code, evaluation_target) VALUES($1,$2,$3,$4) RETURNING id",
    [event.id, "Batería", "BATERIA", "TROUPE"],
  );
  const { rows: [item1] } = await pool.query(
    "INSERT INTO evaluation_item(event_id, rubric_id, specialty_id, name, code) VALUES($1,$2,$3,$4,$5) RETURNING id",
    [event.id, rubric.id, specialty.id, "Ritmo", "RITMO"],
  );
  const { rows: [item2] } = await pool.query(
    "INSERT INTO evaluation_item(event_id, rubric_id, specialty_id, name, code) VALUES($1,$2,$3,$4,$5) RETURNING id",
    [event.id, rubric.id, specialty.id, "Afinación", "AFINACION"],
  );
  const { rows: [category] } = await pool.query(
    "INSERT INTO event_category(event_id, name, code, display_order) VALUES($1,$2,$3,$4) RETURNING id",
    [event.id, "Categoría A", "CATA", 1],
  );

  // Test brand_color format validation
  await assert.rejects(
    async () => {
      await pool.query(
        "INSERT INTO event_troupe(event_id, category_id, name, brand_color) VALUES($1,$2,$3,$4)",
        [event.id, category.id, "Comparsa Invalida", "rojo"],
      );
    },
    /event_troupe_brand_color_format/,
  );

  await assert.rejects(
    async () => {
      await pool.query(
        "INSERT INTO event_troupe(event_id, category_id, name, brand_color) VALUES($1,$2,$3,$4)",
        [event.id, category.id, "Comparsa Invalida 2", "#12345"],
      );
    },
    /event_troupe_brand_color_format/,
  );

  const { rows: [troupe1] } = await pool.query(
    "INSERT INTO event_troupe(event_id, category_id, name, brand_color) VALUES($1,$2,$3,$4) RETURNING id",
    [event.id, category.id, "Comparsa Verde", "#10B981"],
  );
  const { rows: [troupe2] } = await pool.query(
    "INSERT INTO event_troupe(event_id, category_id, name, brand_color) VALUES($1,$2,$3,$4) RETURNING id",
    [event.id, category.id, "Comparsa Azul", "#3B82F6"],
  );

  await pool.query(
    "INSERT INTO night_troupe_schedule(event_id, night_id, event_troupe_id, presentation_order, status) VALUES($1,$2,$3,$4,$5)",
    [event.id, night.id, troupe1.id, 1, "SCHEDULED"],
  );
  await pool.query(
    "INSERT INTO night_troupe_schedule(event_id, night_id, event_troupe_id, presentation_order, status) VALUES($1,$2,$3,$4,$5)",
    [event.id, night.id, troupe2.id, 2, "SCHEDULED"],
  );

  const { rows: [judgeProfile] } = await pool.query(
    "INSERT INTO judge_profile(name, email, document_number, registration_status, created_by, user_id) VALUES($1,$2,$3,$4,$5,$6) RETURNING id",
    ["Judge Test", `judge-${randomUUID()}@test.test`, `DOC-${randomUUID()}`, "REGISTERED", adminId, judgeUserId],
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

    // Open voting as admin
    const openRes = await fetch(`${baseUrl}/api/v1/events/${event.id}/nights/${night.id}/voting/open`, {
      method: "POST",
      headers: adminHeaders,
    });
    assert.equal(openRes.status, 201);
    const openData = await openRes.json();
    assert.equal(openData.ballotsCreated, 1);

    // List ballots as judge without include
    const listRes = await fetch(`${baseUrl}/api/v1/judge/ballots`, {
      headers: judgeHeaders,
    });
    assert.equal(listRes.status, 200);
    const listData = await listRes.json();
    assert.equal(listData.length, 1);
    assert.equal(listData[0].totalScores, undefined);

    // List ballots as judge WITH include=progress
    const listProgRes = await fetch(`${baseUrl}/api/v1/judge/ballots?include=progress`, {
      headers: judgeHeaders,
    });
    assert.equal(listProgRes.status, 200);
    const listProgData = await listProgRes.json();
    assert.equal(listProgData.length, 1);
    // 2 troupes * 2 items = 4 scores total, initially 0 resolved
    assert.equal(listProgData[0].totalScores, 4);
    assert.equal(listProgData[0].resolvedScores, 0);
    assert.equal(listProgData[0].troupes.length, 2);
    assert.equal(listProgData[0].troupes[0].troupeName, "Comparsa Verde");
    assert.equal(listProgData[0].troupes[0].brandColor, "#10B981");
    assert.equal(listProgData[0].troupes[0].total, 2);
    assert.equal(listProgData[0].troupes[0].resolved, 0);

    const ballotId = listProgData[0].id;

    // Fetch ballot details and check brandColor
    const ballotRes = await fetch(`${baseUrl}/api/v1/judge/ballots/${ballotId}`, {
      headers: judgeHeaders,
    });
    assert.equal(ballotRes.status, 200);
    const ballotData = await ballotRes.json();
    assert.equal(ballotData.scores.length, 4);

    const greenScores = ballotData.scores.filter((s) => s.troupeName === "Comparsa Verde");
    assert.equal(greenScores.length, 2);
    assert.equal(greenScores[0].brandColor, "#10B981");

    const blueScores = ballotData.scores.filter((s) => s.troupeName === "Comparsa Azul");
    assert.equal(blueScores.length, 2);
    assert.equal(blueScores[0].brandColor, "#3B82F6");

    // Save one score
    const saveScoreRes = await fetch(`${baseUrl}/api/v1/judge/ballots/${ballotId}/scores/${greenScores[0].id}`, {
      method: "PUT",
      headers: judgeHeaders,
      body: JSON.stringify({ evaluationState: "SCORED", score: 9 }),
    });
    assert.equal(saveScoreRes.status, 200);

    // Save another score as NOT_PRESENTED
    const saveScore2Res = await fetch(`${baseUrl}/api/v1/judge/ballots/${ballotId}/scores/${greenScores[1].id}`, {
      method: "PUT",
      headers: judgeHeaders,
      body: JSON.stringify({ evaluationState: "NOT_PRESENTED", score: 0 }),
    });
    assert.equal(saveScore2Res.status, 200);

    // Re-check progress: 2 resolved out of 4
    const listProgAfterRes = await fetch(`${baseUrl}/api/v1/judge/ballots?include=progress`, {
      headers: judgeHeaders,
    });
    assert.equal(listProgAfterRes.status, 200);
    const listProgAfterData = await listProgAfterRes.json();
    assert.equal(listProgAfterData[0].totalScores, 4);
    assert.equal(listProgAfterData[0].resolvedScores, 2);
  });
});
