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

test("API votación: abrir sin comparsas programadas falla 409 y no crea ballots", {
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
    `INSERT INTO "user"(id, name, email, "emailVerified") VALUES ($1, 'Admin sched', $2, true), ($3, 'Judge sched', $4, true)`,
    [adminId, `${adminId}@example.test`, judgeUserId, `${judgeUserId}@example.test`],
  );
  await pool.query("INSERT INTO user_role (user_id, role_code) VALUES ($1, 'ADMIN')", [adminId]);
  await pool.query("INSERT INTO user_role (user_id, role_code) VALUES ($1, 'JUDGE')", [judgeUserId]);

  const { rows: [event] } = await pool.query(
    "INSERT INTO carnival_event(name) VALUES($1) RETURNING id", ["Voting Empty Schedule Event"],
  );
  const { rows: [night] } = await pool.query(
    "INSERT INTO night(event_id, name, display_order, kind, status) VALUES($1,$2,$3,$4,$5) RETURNING id",
    [event.id, "Noche sin schedule", 1, "COMPETITION", "OPEN"],
  );
  const { rows: [specialty] } = await pool.query(
    "INSERT INTO event_specialty(event_id, name, code, display_order) VALUES($1,$2,$3,$4) RETURNING id",
    [event.id, "Baile", "BAILE", 1],
  );
  const { rows: [rubric] } = await pool.query(
    "INSERT INTO rubric(event_id, name, code, evaluation_target) VALUES($1,$2,$3,$4) RETURNING id",
    [event.id, "Reina", "REINA", "TROUPE"],
  );
  await pool.query(
    "INSERT INTO evaluation_item(event_id, rubric_id, specialty_id, name, code) VALUES($1,$2,$3,$4,$5)",
    [event.id, rubric.id, specialty.id, "Presencia", "PRESENCIA"],
  );
  const { rows: [category] } = await pool.query(
    "INSERT INTO event_category(event_id, name, code, display_order) VALUES($1,$2,$3,$4) RETURNING id",
    [event.id, "Primera", "PRIMERA", 1],
  );
  // Comparsa existe pero SIN fila en night_troupe_schedule
  await pool.query(
    "INSERT INTO event_troupe(event_id, category_id, name) VALUES($1,$2,$3)",
    [event.id, category.id, "Comparsa sin programar"],
  );
  await pool.query(
    "INSERT INTO judge_quota(event_id, night_id, specialty_id, max_assignments) VALUES($1,$2,$3,$4)",
    [event.id, night.id, specialty.id, 3],
  );
  const { rows: [judgeProfile] } = await pool.query(
    "INSERT INTO judge_profile(name, email, document_number, registration_status, created_by) VALUES($1,$2,$3,$4,$5) RETURNING id",
    ["Judge Sched", `judge-sched-${randomUUID()}@test.test`, `DOC-SCHED-${randomUUID()}`, "INVITED", adminId],
  );
  await pool.query("UPDATE judge_profile SET user_id = $2, registration_status = 'REGISTERED' WHERE id = $1", [judgeProfile.id, judgeUserId]);
  await pool.query(
    `INSERT INTO judge_assignment(event_id, night_id, specialty_id, judge_profile_id, assignment_type) VALUES($1,$2,$3,$4,$5)`,
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
      if (headers.get("x-test-session") === "admin") return { user: { id: adminId, twoFactorEnabled: true } };
      return null;
    },
  });

  await withServer(app, async (baseUrl) => {
    const adminHeaders = { "content-type": "application/json", "x-test-session": "admin" };
    const openRes = await fetch(`${baseUrl}/api/v1/events/${event.id}/nights/${night.id}/voting/open`, {
      method: "POST", headers: adminHeaders,
    });
    assert.equal(openRes.status, 409);
    assert.equal((await openRes.json()).code, "NIGHT_SCHEDULE_EMPTY");

    const { rows: [ballotCount] } = await pool.query(
      "SELECT count(*)::INTEGER AS count FROM ballot WHERE night_id = $1 AND event_id = $2",
      [night.id, event.id],
    );
    assert.equal(ballotCount.count, 0);
  });
});
