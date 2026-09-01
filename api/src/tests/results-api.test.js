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

async function setupEventWithScores(pool) {
  const { rows: [event] } = await pool.query("INSERT INTO carnival_event(name) VALUES($1) RETURNING id", ["Results API Event"]);
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
    [event.id, "Primera", "PRIMERA", 1],
  );
  const { rows: [troupe] } = await pool.query(
    "INSERT INTO event_troupe(event_id, category_id, name) VALUES($1,$2,$3) RETURNING id",
    [event.id, category.id, "Comparsa Única"],
  );
  const { rows: [schedule] } = await pool.query(
    "INSERT INTO night_troupe_schedule(event_id, night_id, event_troupe_id, presentation_order, status) VALUES($1,$2,$3,$4,$5) RETURNING id",
    [event.id, night.id, troupe.id, 1, "SCHEDULED"],
  );

  const adminId = randomUUID();
  const judgeUserId = randomUUID();
  const scrutineerId = randomUUID();
  const veedorId = randomUUID();
  await pool.query(
    `INSERT INTO "user"(id, name, email, "emailVerified")
     VALUES ($1,'Admin',$2,true), ($3,'Judge',$4,true), ($5,'Scrutineer',$6,true), ($7,'Veedor',$8,true)`,
    [
      adminId, `${adminId}@example.test`,
      judgeUserId, `${judgeUserId}@example.test`,
      scrutineerId, `${scrutineerId}@example.test`,
      veedorId, `${veedorId}@example.test`,
    ],
  );
  await pool.query("INSERT INTO user_role (user_id, role_code) VALUES ($1,'ADMIN')", [adminId]);
  await pool.query("INSERT INTO user_role (user_id, role_code) VALUES ($1,'JUDGE')", [judgeUserId]);
  await pool.query("INSERT INTO user_role (user_id, role_code) VALUES ($1,'SCRUTINEER')", [scrutineerId]);
  await pool.query("INSERT INTO user_role (user_id, role_code) VALUES ($1,'VEEDOR')", [veedorId]);

  const { rows: [judgeProfile] } = await pool.query(
    "INSERT INTO judge_profile(name, email, document_number, registration_status, created_by) VALUES($1,$2,$3,'INVITED',$4) RETURNING id",
    ["Judge Results", `${judgeUserId}@test.test`, `DOC-${judgeUserId}`, adminId],
  );
  await pool.query("UPDATE judge_profile SET user_id = $1, registration_status = 'REGISTERED' WHERE id = $2", [judgeUserId, judgeProfile.id]);
  await pool.query("INSERT INTO judge_quota(event_id, night_id, specialty_id, max_assignments) VALUES($1,$2,$3,1)", [event.id, night.id, specialty.id]);
  const { rows: [assignment] } = await pool.query(
    "INSERT INTO judge_assignment(event_id, night_id, specialty_id, judge_profile_id, assignment_type) VALUES($1,$2,$3,$4,'PRIMARY') RETURNING id",
    [event.id, night.id, specialty.id, judgeProfile.id],
  );

  const { rows: [ballot] } = await pool.query(
    "INSERT INTO ballot(event_id, night_id, judge_assignment_id, judge_profile_id, specialty_id, status) VALUES($1,$2,$3,$4,$5,'OPEN') RETURNING id",
    [event.id, night.id, assignment.id, judgeProfile.id, specialty.id],
  );
  await pool.query(
    `INSERT INTO ballot_score(ballot_id, event_id, evaluation_item_id, rubric_id, night_schedule_id, score, evaluation_state, status)
     VALUES($1,$2,$3,$4,$5,8,'SCORED','DRAFT')`,
    [ballot.id, event.id, item.id, rubric.id, schedule.id],
  );
  await pool.query("UPDATE ballot SET status='SUBMITTED', submitted_at=CURRENT_TIMESTAMP WHERE id=$1", [ballot.id]);
  await pool.query("UPDATE ballot_score SET status='LOCKED', locked_at=CURRENT_TIMESTAMP WHERE ballot_id=$1", [ballot.id]);

  return { eventId: event.id, adminId, judgeUserId, scrutineerId, veedorId, troupeId: troupe.id, rubricId: rubric.id };
}

test("API resultados: solo ADMIN/SCRUTINEER pueden liberar y consultar resultados", {
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
  const data = await setupEventWithScores(pool);

  const app = createApp({
    getSession: async ({ headers }) => {
      const role = headers.get("x-test-session");
      if (role === "admin") return { user: { id: data.adminId, twoFactorEnabled: true } };
      if (role === "scrutineer") return { user: { id: data.scrutineerId, twoFactorEnabled: true } };
      if (role === "veedor") return { user: { id: data.veedorId, twoFactorEnabled: true } };
      if (role === "judge") return { user: { id: data.judgeUserId, twoFactorEnabled: true } };
      return null;
    },
  });

  await withServer(app, async (baseUrl) => {
    const adminHeaders = { "content-type": "application/json", "x-test-session": "admin" };
    const scrutineerHeaders = { "content-type": "application/json", "x-test-session": "scrutineer" };
    const veedorHeaders = { "content-type": "application/json", "x-test-session": "veedor" };
    const judgeHeaders = { "content-type": "application/json", "x-test-session": "judge" };

    // 1. Sin liberar, GET results devuelve 403 RESULTS_NOT_RELEASED.
    const unreleased = await fetch(`${baseUrl}/api/v1/events/${data.eventId}/results`, { headers: adminHeaders });
    assert.equal(unreleased.status, 403);
    assert.equal((await unreleased.json()).code, "RESULTS_NOT_RELEASED");

    // 2. Veedor no puede liberar resultados.
    const veedorRelease = await fetch(`${baseUrl}/api/v1/events/${data.eventId}/results/release`, {
      method: "POST", headers: veedorHeaders,
    });
    assert.equal(veedorRelease.status, 403);
    assert.equal((await veedorRelease.json()).code, "RESULTS_ACCESS_DENIED");

    // 3. Jurado tampoco puede consultar resultados.
    const judgeGet = await fetch(`${baseUrl}/api/v1/events/${data.eventId}/results`, { headers: judgeHeaders });
    assert.equal(judgeGet.status, 403);
    assert.equal((await judgeGet.json()).code, "RESULTS_ACCESS_DENIED");

    // 4. Scrutineer libera resultados.
    const releaseRes = await fetch(`${baseUrl}/api/v1/events/${data.eventId}/results/release`, {
      method: "POST", headers: scrutineerHeaders,
    });
    assert.equal(releaseRes.status, 201);
    const releaseData = await releaseRes.json();
    assert.equal(releaseData.eventId, data.eventId);
    assert.equal(releaseData.alreadyReleased, false);
    assert.ok(releaseData.releasedAt);

    // 5. Liberar de nuevo es idempotente.
    const duplicateRelease = await fetch(`${baseUrl}/api/v1/events/${data.eventId}/results/release`, {
      method: "POST", headers: adminHeaders,
    });
    assert.equal(duplicateRelease.status, 201);
    assert.equal((await duplicateRelease.json()).alreadyReleased, true);

    // 6. Admin consulta resultados liberados.
    const resultsRes = await fetch(`${baseUrl}/api/v1/events/${data.eventId}/results`, { headers: adminHeaders });
    assert.equal(resultsRes.status, 200);
    const results = await resultsRes.json();
    assert.equal(results.eventId, data.eventId);
    assert.equal(results.overallRanking.length, 1);
    assert.equal(results.overallRanking[0].troupeId, data.troupeId);
    assert.equal(results.overallRanking[0].totalScore, 8);
    assert.equal(results.bestTroupe.winnerTroupeId, data.troupeId);

    // 7. Audit registra la liberación.
    const { rows: [audit] } = await pool.query(
      "SELECT action, after_data->>'releasedAt' AS released FROM audit_event WHERE entity_id = $1 AND action = 'RESULTS_RELEASED'",
      [data.eventId],
    );
    assert.ok(audit);
    assert.equal(audit.action, "RESULTS_RELEASED");
    assert.ok(audit.released);
  });
});
