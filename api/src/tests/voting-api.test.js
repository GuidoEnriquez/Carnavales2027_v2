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

test("API votación: ciclo completo de planilla", {
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
  const otherJudgeUserId = randomUUID();
  await pool.query(
    `INSERT INTO "user"(id, name, email, "emailVerified")
     VALUES ($1, 'Admin voting', $2, true), ($3, 'Judge voting', $4, true), ($5, 'Other judge', $6, true)`,
    [
      adminId,
      `${adminId}@example.test`,
      judgeUserId,
      `${judgeUserId}@example.test`,
      otherJudgeUserId,
      `${otherJudgeUserId}@example.test`,
    ],
  );
  await pool.query("INSERT INTO user_role (user_id, role_code) VALUES ($1, 'ADMIN')", [adminId]);
  await pool.query("INSERT INTO user_role (user_id, role_code) VALUES ($1, 'JUDGE')", [judgeUserId]);
  await pool.query("INSERT INTO user_role (user_id, role_code) VALUES ($1, 'JUDGE')", [otherJudgeUserId]);

  const { rows: [event] } = await pool.query(
    "INSERT INTO carnival_event(name) VALUES($1) RETURNING id", ["Voting API Event"],
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
    "INSERT INTO rubric(event_id, name, code, evaluation_target) VALUES($1,$2,$3,$4) RETURNING id",
    [event.id, "Reina", "REINA", "TROUPE"],
  );
  const { rows: [item] } = await pool.query(
    "INSERT INTO evaluation_item(event_id, rubric_id, specialty_id, name, code) VALUES($1,$2,$3,$4,$5) RETURNING id",
    [event.id, rubric.id, specialty.id, "Presencia", "PRESENCIA"],
  );
  const { rows: [category] } = await pool.query(
    "INSERT INTO event_category(event_id, name, code, display_order) VALUES($1,$2,$3,$4) RETURNING id",
    [event.id, "Primera", "PRIMERA", 1],
  );
  const { rows: [troupe] } = await pool.query(
    "INSERT INTO event_troupe(event_id, category_id, name) VALUES($1,$2,$3) RETURNING id",
    [event.id, category.id, "Comparsa 1"],
  );
  const { rows: [schedule] } = await pool.query(
    "INSERT INTO night_troupe_schedule(event_id, night_id, event_troupe_id, presentation_order, status) VALUES($1,$2,$3,$4,$5) RETURNING id",
    [event.id, night.id, troupe.id, 1, "SCHEDULED"],
  );
  const { rows: [secondTroupe] } = await pool.query(
    "INSERT INTO event_troupe(event_id, category_id, name) VALUES($1,$2,$3) RETURNING id",
    [event.id, category.id, "Comparsa 2"],
  );
  await pool.query(
    "INSERT INTO night_troupe_schedule(event_id, night_id, event_troupe_id, presentation_order, status) VALUES($1,$2,$3,$4,$5)",
    [event.id, night.id, secondTroupe.id, 2, "SCHEDULED"],
  );

  await pool.query(
    "INSERT INTO judge_quota(event_id, night_id, specialty_id, max_assignments) VALUES($1,$2,$3,$4)",
    [event.id, night.id, specialty.id, 3],
  );
  const { rows: [judgeProfile] } = await pool.query(
    "INSERT INTO judge_profile(name, email, document_number, registration_status, created_by) VALUES($1,$2,$3,$4,$5) RETURNING id",
    ["Judge Voting", `judge-voting-${randomUUID()}@test.test`, `DOC-VOTE-${randomUUID()}`, "INVITED", adminId],
  );
  await pool.query(
    "UPDATE judge_profile SET user_id = $2, registration_status = 'REGISTERED' WHERE id = $1",
    [judgeProfile.id, judgeUserId],
  );
  const { rows: [otherJudgeProfile] } = await pool.query(
    "INSERT INTO judge_profile(name, email, document_number, registration_status, created_by) VALUES($1,$2,$3,$4,$5) RETURNING id",
    ["Other Judge", `other-judge-${randomUUID()}@test.test`, `DOC-OTHER-${randomUUID()}`, "INVITED", adminId],
  );
  await pool.query(
    "UPDATE judge_profile SET user_id = $2, registration_status = 'REGISTERED' WHERE id = $1",
    [otherJudgeProfile.id, otherJudgeUserId],
  );
  const { rows: [assignment] } = await pool.query(
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
       if (role === "other-judge") return { user: { id: otherJudgeUserId, twoFactorEnabled: true } };
      return null;
    },
  });

  await withServer(app, async (baseUrl) => {
    const adminHeaders = { "content-type": "application/json", "x-test-session": "admin" };
    const judgeHeaders = { "content-type": "application/json", "x-test-session": "judge" };
    const otherJudgeHeaders = { "content-type": "application/json", "x-test-session": "other-judge" };

    // 1. Unauthenticated → 401
    const unauth = await fetch(`${baseUrl}/api/v1/events/${event.id}/nights/${night.id}/voting/open`, { method: "POST" });
    assert.equal(unauth.status, 401);

    // 2. Open voting → 201
    const openRes = await fetch(`${baseUrl}/api/v1/events/${event.id}/nights/${night.id}/voting/open`, {
      method: "POST", headers: adminHeaders,
    });
    assert.equal(openRes.status, 201);
    const openData = await openRes.json();
    assert.equal(openData.ballotsCreated, 1);

    // 3. Get voting status → 200
    const statusRes = await fetch(`${baseUrl}/api/v1/events/${event.id}/nights/${night.id}/voting/status`, { headers: adminHeaders });
    assert.equal(statusRes.status, 200);
    const statusData = await statusRes.json();
    assert.equal(statusData.counts.OPEN, 1);
    assert.equal(statusData.total, 1);

    // 4. List night ballots → 200
    const listRes = await fetch(`${baseUrl}/api/v1/events/${event.id}/nights/${night.id}/voting/ballots`, { headers: adminHeaders });
    assert.equal(listRes.status, 200);
    const listData = await listRes.json();
    assert.equal(listData.length, 1);
    const ballotId = listData[0].id;

    const ownBallotsRes = await fetch(`${baseUrl}/api/v1/judge/ballots`, { headers: judgeHeaders });
    assert.equal(ownBallotsRes.status, 200);
    const ownBallots = await ownBallotsRes.json();
    assert.deepEqual(ownBallots.map((ballot) => ballot.id), [ballotId]);
    const otherBallotsRes = await fetch(`${baseUrl}/api/v1/judge/ballots`, { headers: otherJudgeHeaders });
    assert.equal(otherBallotsRes.status, 200);
    assert.deepEqual(await otherBallotsRes.json(), []);

    // 5. Judge gets ballot → 200
    const ballotRes = await fetch(`${baseUrl}/api/v1/judge/ballots/${ballotId}`, { headers: judgeHeaders });
    const ballotBody = await ballotRes.json();
    assert.equal(ballotRes.status, 200, JSON.stringify(ballotBody));
    const ballotData = ballotBody;
    assert.equal(ballotData.status, "OPEN");
    assert.equal(ballotData.scores.length, 2);
    const [firstScore, secondScore] = ballotData.scores;

    // 6. A different judge cannot edit the ballot.
    const forbiddenSave = await fetch(`${baseUrl}/api/v1/judge/ballots/${ballotId}/scores/${firstScore.id}`, {
      method: "PUT", headers: otherJudgeHeaders,
      body: JSON.stringify({ evaluationState: "SCORED", score: 8 }),
    });
    assert.equal(forbiddenSave.status, 409);
    assert.equal((await forbiddenSave.json()).code, "BALLOT_ACCESS_DENIED");

    // 7. Submit rejects unresolved items with their stable error code.
    const incompleteSubmit = await fetch(`${baseUrl}/api/v1/judge/ballots/${ballotId}/submit`, {
      method: "POST", headers: judgeHeaders,
    });
    assert.equal(incompleteSubmit.status, 409);
    assert.equal((await incompleteSubmit.json()).code, "BALLOT_INCOMPLETE");

    const incompleteClose = await fetch(`${baseUrl}/api/v1/events/${event.id}/nights/${night.id}/voting/close`, {
      method: "POST", headers: adminHeaders,
    });
    assert.equal(incompleteClose.status, 409);
    const incompleteCloseBody = await incompleteClose.json();
    assert.equal(incompleteCloseBody.code, "VOTING_CLOSE_INCOMPLETE_BALLOTS");
    assert.equal(incompleteCloseBody.details.length, 2);
    assert.deepEqual(incompleteCloseBody.details.map((item) => item.name), ["Presencia", "Presencia"]);
    assert.deepEqual(incompleteCloseBody.details.map((item) => item.judgeName), ["Judge Voting", "Judge Voting"]);
    assert.deepEqual(incompleteCloseBody.details.map((item) => item.troupeName), ["Comparsa 1", "Comparsa 2"]);

    const invalidOrdinaryScore = await fetch(`${baseUrl}/api/v1/judge/ballots/${ballotId}/scores/${firstScore.id}`, {
      method: "PUT", headers: judgeHeaders,
      body: JSON.stringify({ evaluationState: "SCORED", score: 0 }),
    });
    assert.equal(invalidOrdinaryScore.status, 400);

    // 8. The judge records one ordinary score and one independent non-presentation.
    const saveRes = await fetch(`${baseUrl}/api/v1/judge/ballots/${ballotId}/scores/${firstScore.id}`, {
      method: "PUT", headers: judgeHeaders,
      body: JSON.stringify({ evaluationState: "SCORED", score: 8 }),
    });
    assert.equal(saveRes.status, 200, JSON.stringify(await saveRes.clone().json()));
    const saveData = await saveRes.json();
    assert.equal(saveData.score, 8);
    assert.equal(saveData.evaluationState, "SCORED");
    const notPresented = await fetch(`${baseUrl}/api/v1/judge/ballots/${ballotId}/scores/${secondScore.id}`, {
      method: "PUT", headers: judgeHeaders,
      body: JSON.stringify({ evaluationState: "NOT_PRESENTED" }),
    });
    assert.equal(notPresented.status, 200);
    assert.deepEqual(await notPresented.json(), {
      id: secondScore.id,
      score: 0,
      evaluationState: "NOT_PRESENTED",
      status: "DRAFT",
    });
    const { rows: [scoreAudit] } = await pool.query(
      "SELECT details FROM ballot_audit_log WHERE ballot_id = $1 AND action = 'SCORE_DECISION_SAVED' ORDER BY created_at DESC LIMIT 1",
      [ballotId],
    );
    assert.deepEqual(scoreAudit.details, { scoreId: secondScore.id });

    // 9. Submit a complete ballot → 200.
    const submitRes = await fetch(`${baseUrl}/api/v1/judge/ballots/${ballotId}/submit`, {
      method: "POST", headers: judgeHeaders,
    });
    assert.equal(submitRes.status, 200);
    const submitData = await submitRes.json();
    assert.equal(submitData.status, "SUBMITTED");

    // 10. Judge cannot resubmit → 409.
    const resubmitRes = await fetch(`${baseUrl}/api/v1/judge/ballots/${ballotId}/submit`, {
      method: "POST", headers: judgeHeaders,
    });
    assert.equal(resubmitRes.status, 409);
    assert.equal((await resubmitRes.json()).code, "BALLOT_ALREADY_SUBMITTED");

    // 11. Historical subsanation markers prevent reopening even without a detail row.
    await pool.query("ALTER TABLE ballot_score DISABLE TRIGGER USER");
    try {
      await pool.query(
        "UPDATE ballot_score SET score = NULL, evaluation_state = 'PENDING', requires_subsanation = true, subsidized_score = NULL WHERE id = $1",
        [firstScore.id],
      );
    } finally {
      await pool.query("ALTER TABLE ballot_score ENABLE TRIGGER USER");
    }
    const historicalReopen = await fetch(`${baseUrl}/api/v1/events/${event.id}/ballots/${ballotId}/reopen`, {
      method: "POST", headers: adminHeaders,
      body: JSON.stringify({ reason: "Corrección solicitada" }),
    });
    assert.equal(historicalReopen.status, 409);
    assert.equal((await historicalReopen.json()).code, "BALLOT_SUBSANATION_FINAL");
    await pool.query("ALTER TABLE ballot_score DISABLE TRIGGER USER");
    try {
      await pool.query(
        "UPDATE ballot_score SET score = 8, evaluation_state = 'SCORED', requires_subsanation = false, subsidized_score = NULL WHERE id = $1",
        [firstScore.id],
      );
    } finally {
      await pool.query("ALTER TABLE ballot_score ENABLE TRIGGER USER");
    }

    // 12. Reopen ballot → 200.
    const reopenRes = await fetch(`${baseUrl}/api/v1/events/${event.id}/ballots/${ballotId}/reopen`, {
      method: "POST", headers: adminHeaders,
      body: JSON.stringify({ reason: "Corrección solicitada" }),
    });
    assert.equal(reopenRes.status, 200, JSON.stringify(await reopenRes.clone().json()));
    const reopenData = await reopenRes.json();
    assert.equal(reopenData.status, "REOPENED");
    assert.equal(reopenData.reopenCount, 1);

    // 13. Judge gets reopened ballot → scores are DRAFT again.
    const reopenedBallotRes = await fetch(`${baseUrl}/api/v1/judge/ballots/${ballotId}`, { headers: judgeHeaders });
    assert.equal(reopenedBallotRes.status, 200);
    const reopenedBallot = await reopenedBallotRes.json();
    assert.equal(reopenedBallot.status, "REOPENED");
    assert.equal(reopenedBallot.scores[0].status, "DRAFT");

    const resubmitReopened = await fetch(`${baseUrl}/api/v1/judge/ballots/${ballotId}/submit`, {
      method: "POST", headers: judgeHeaders,
    });
    assert.equal(resubmitReopened.status, 200);

    // 13. Obsolete pre-confirmation omission routes are unavailable.
    const retiredOmission = await fetch(`${baseUrl}/api/v1/scrutiny/ballots/${ballotId}/scores/${secondScore.id}/omissions`, {
      method: "POST", headers: adminHeaders,
    });
    assert.equal(retiredOmission.status, 404);
    const retiredSubsanation = await fetch(`${baseUrl}/api/v1/scrutiny/ballots/${ballotId}/scores/${secondScore.id}/subsanations`, {
      method: "POST", headers: adminHeaders,
    });
    assert.equal(retiredSubsanation.status, 404);

    // 14. Close voting persists the closed window.
    const closeRes = await fetch(`${baseUrl}/api/v1/events/${event.id}/nights/${night.id}/voting/close`, {
      method: "POST", headers: adminHeaders,
    });
    assert.equal(closeRes.status, 200);
    const closeData = await closeRes.json();
    assert.ok(closeData.autoSubmitted >= 0);

    // 15. Final status check.
    const finalStatus = await fetch(`${baseUrl}/api/v1/events/${event.id}/nights/${night.id}/voting/status`, { headers: adminHeaders });
    assert.equal(finalStatus.status, 200);
    const finalData = await finalStatus.json();
    assert.equal(finalData.counts.OPEN, 0);
    assert.equal(finalData.votingStatus, "CLOSED");
    const reopenWindow = await fetch(`${baseUrl}/api/v1/events/${event.id}/nights/${night.id}/voting/open`, {
      method: "POST", headers: adminHeaders,
    });
    assert.equal(reopenWindow.status, 409);
    assert.equal((await reopenWindow.json()).code, "VOTING_WINDOW_CLOSED");

    await pool.query(
      `UPDATE judge_assignment
          SET status = 'REVOKED', revoked_at = clock_timestamp(), revoked_by = $2, reason = 'Revocación de prueba'
        WHERE id = $1`,
      [assignment.id, adminId],
    );
    const revokedBallot = await fetch(`${baseUrl}/api/v1/judge/ballots/${ballotId}`, { headers: judgeHeaders });
    assert.equal(revokedBallot.status, 409);
    assert.equal((await revokedBallot.json()).code, "BALLOT_NOT_FOUND");
  });
});

test("API votación: juez no puede abrir votación", {
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
  const observerId = randomUUID();
  await pool.query(
    `INSERT INTO "user"(id, name, email, "emailVerified")
     VALUES ($1, 'Admin', $2, true), ($3, 'Judge', $4, true), ($5, 'Observer', $6, true)`,
    [adminId, `${adminId}@example.test`, judgeUserId, `${judgeUserId}@example.test`, observerId, `${observerId}@example.test`],
  );
  await pool.query("INSERT INTO user_role (user_id, role_code) VALUES ($1, 'ADMIN')", [adminId]);
  await pool.query("INSERT INTO user_role (user_id, role_code) VALUES ($1, 'JUDGE')", [judgeUserId]);
  await pool.query("INSERT INTO user_role (user_id, role_code) VALUES ($1, 'VEEDOR')", [observerId]);

  const { rows: [event] } = await pool.query(
    "INSERT INTO carnival_event(name) VALUES($1) RETURNING id", ["Voting No Access"],
  );
  const { rows: [night] } = await pool.query(
    "INSERT INTO night(event_id, name, display_order, kind, status) VALUES($1,$2,$3,$4,$5) RETURNING id",
    [event.id, "Noche 1", 1, "COMPETITION", "OPEN"],
  );

  const app = createApp({
    getSession: async ({ headers }) => {
      const role = headers.get("x-test-session");
      if (role === "admin") return { user: { id: adminId, twoFactorEnabled: true } };
      if (role === "judge") return { user: { id: judgeUserId, twoFactorEnabled: true } };
      if (role === "observer") return { user: { id: observerId, twoFactorEnabled: true } };
      return null;
    },
  });

  await withServer(app, async (baseUrl) => {
    const judgeHeaders = { "content-type": "application/json", "x-test-session": "judge" };
    const res = await fetch(`${baseUrl}/api/v1/events/${event.id}/nights/${night.id}/voting/open`, {
      method: "POST", headers: judgeHeaders,
    });
    assert.equal(res.status, 403);
    assert.equal((await res.json()).code, "ADMIN_REQUIRED");

    const observerStatus = await fetch(`${baseUrl}/api/v1/events/${event.id}/nights/${night.id}/voting/status`, {
      headers: { "x-test-session": "observer" },
    });
    assert.equal(observerStatus.status, 200);
    assert.deepEqual(await observerStatus.json(), {
      nightId: night.id,
      nightStatus: "OPEN",
      votingStatus: "NOT_OPEN",
      counts: { OPEN: 0, SUBMITTED: 0, REOPENED: 0 },
      total: 0,
    });
  });
});
