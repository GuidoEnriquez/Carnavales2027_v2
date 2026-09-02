import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import { closePool, getPool } from "../db/pool.js";
import { migrate } from "../db/migrate.js";
import { openVoting, closeVoting, listJudgeBallots, saveScore, submitBallot } from "../modules/ballots/ballot-service.js";
import { activateJudgeSubstitute, createJudgeAssignment } from "../modules/judges/assignment-service.js";
import { releaseResults } from "../modules/results/results-service.js";

async function setupPair() {
  const pool = getPool();
  const adminId = randomUUID();
  const primaryUserId = randomUUID();
  const substituteUserId = randomUUID();
  await pool.query(
    `INSERT INTO "user"(id,name,email,"emailVerified") VALUES
      ($1,'Admin',$2,true),($3,'Titular',$4,true),($5,'Suplente',$6,true)`,
    [adminId, `${adminId}@example.test`, primaryUserId, `${primaryUserId}@example.test`, substituteUserId, `${substituteUserId}@example.test`],
  );
  await pool.query("INSERT INTO user_role(user_id,role_code) VALUES($1,'ADMIN'),($2,'JUDGE'),($3,'JUDGE')", [adminId, primaryUserId, substituteUserId]);
  const { rows: [event] } = await pool.query("INSERT INTO carnival_event(name) VALUES($1) RETURNING id", [`Suplencias ${randomUUID()}`]);
  const { rows: [night] } = await pool.query("INSERT INTO night(event_id,name,display_order,kind,status) VALUES($1,'Noche',1,'COMPETITION','OPEN') RETURNING id", [event.id]);
  const { rows: [specialty] } = await pool.query("INSERT INTO event_specialty(event_id,name,code,display_order) VALUES($1,'Baile',$2,1) RETURNING id", [event.id, `BAILE_${randomUUID()}`]);
  const { rows: [category] } = await pool.query("INSERT INTO event_category(event_id,name,code,display_order) VALUES($1,'Categoria',$2,1) RETURNING id", [event.id, `CAT_${randomUUID()}`]);
  const { rows: [troupe] } = await pool.query("INSERT INTO event_troupe(event_id,category_id,name) VALUES($1,$2,'Comparsa') RETURNING id", [event.id, category.id]);
  const { rows: [rubric] } = await pool.query("INSERT INTO rubric(event_id,name,code,evaluation_target) VALUES($1,'Rubro',$2,'TROUPE') RETURNING id", [event.id, `RUBRO_${randomUUID()}`]);
  await pool.query("INSERT INTO evaluation_item(event_id,rubric_id,specialty_id,name,code) VALUES($1,$2,$3,'Item',$4)", [event.id, rubric.id, specialty.id, `ITEM_${randomUUID()}`]);
  await pool.query("INSERT INTO night_troupe_schedule(event_id,night_id,event_troupe_id,presentation_order) VALUES($1,$2,$3,1)", [event.id, night.id, troupe.id]);
  await pool.query("INSERT INTO judge_quota(event_id,night_id,specialty_id,max_assignments) VALUES($1,$2,$3,2)", [event.id, night.id, specialty.id]);
  for (const [id, userId, name] of [[randomUUID(), primaryUserId, "Titular"], [randomUUID(), substituteUserId, "Suplente"]]) {
    await pool.query(
      "INSERT INTO judge_profile(id,user_id,name,email,document_number,registration_status,created_by) VALUES($1,$2,$3,$4,$5,'REGISTERED',$6)",
      [id, userId, name, `${id}@example.test`, randomUUID(), adminId],
    );
    if (name === "Titular") event.primaryProfileId = id;
    else event.substituteProfileId = id;
  }
  const primary = await createJudgeAssignment({ actorUserId: adminId, eventId: event.id, nightId: night.id, specialtyId: specialty.id, judgeProfileId: event.primaryProfileId });
  await createJudgeAssignment({ actorUserId: adminId, eventId: event.id, nightId: night.id, specialtyId: specialty.id, judgeProfileId: event.substituteProfileId, assignmentType: "SUBSTITUTE", standbyForAssignmentId: primary.id });
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query("SELECT set_config('app.allow_event_open','true',true)");
    await client.query("UPDATE carnival_event SET status='OPEN' WHERE id=$1", [event.id]);
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
  return { adminId, primaryUserId, substituteUserId, eventId: event.id, nightId: night.id, primaryAssignmentId: primary.id };
}

test("suplente espera, reemplaza un titular incompleto y recibe la unica planilla votante", { skip: !process.env.TEST_DATABASE_URL }, async (context) => {
  const original = process.env.DATABASE_URL;
  context.after(async () => { await closePool(); if (original === undefined) delete process.env.DATABASE_URL; else process.env.DATABASE_URL = original; });
  process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;
  await migrate();
  const data = await setupPair();
  const opened = await openVoting({ actorUserId: data.adminId, eventId: data.eventId, nightId: data.nightId });
  assert.equal(opened.ballotsCreated, 1);
  assert.equal((await listJudgeBallots({ userId: data.substituteUserId })).length, 0);
  const [primaryBallot] = await listJudgeBallots({ userId: data.primaryUserId });
  const pool = getPool();
  const { rows: [primaryScore] } = await pool.query("SELECT id FROM ballot_score WHERE ballot_id=$1", [primaryBallot.id]);
  await saveScore({ actorUserId: data.primaryUserId, ballotId: primaryBallot.id, scoreId: primaryScore.id, evaluationState: "SCORED", score: 8 });
  const activated = await activateJudgeSubstitute({ actorUserId: data.adminId, primaryAssignmentId: data.primaryAssignmentId, reason: "Titular no finalizo la planilla" });
  assert.equal(activated.ballotsCreated, 1);
  assert.deepEqual(await listJudgeBallots({ userId: data.primaryUserId }), []);
  const [substituteBallot] = await listJudgeBallots({ userId: data.substituteUserId });
  assert.ok(substituteBallot);
  const { rows: [replaced] } = await pool.query("SELECT status FROM ballot WHERE id=$1", [primaryBallot.id]);
  assert.equal(replaced.status, "REPLACED");
  const { rows: [preserved] } = await pool.query("SELECT evaluation_state FROM ballot_score WHERE id=$1", [primaryScore.id]);
  assert.equal(preserved.evaluation_state, "SCORED");
  const { rows: [substituteScore] } = await pool.query("SELECT id FROM ballot_score WHERE ballot_id=$1", [substituteBallot.id]);
  await saveScore({ actorUserId: data.substituteUserId, ballotId: substituteBallot.id, scoreId: substituteScore.id, evaluationState: "SCORED", score: 9 });
  await submitBallot({ actorUserId: data.substituteUserId, ballotId: substituteBallot.id });
  await assert.doesNotReject(() => closeVoting({ actorUserId: data.adminId, eventId: data.eventId, nightId: data.nightId }));
  await assert.doesNotReject(() => releaseResults({ eventId: data.eventId, actorUserId: data.adminId }));
});

test("no activa el suplente si el titular ya presento", { skip: !process.env.TEST_DATABASE_URL }, async (context) => {
  const original = process.env.DATABASE_URL;
  context.after(async () => { await closePool(); if (original === undefined) delete process.env.DATABASE_URL; else process.env.DATABASE_URL = original; });
  process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;
  await migrate();
  const data = await setupPair();
  await openVoting({ actorUserId: data.adminId, eventId: data.eventId, nightId: data.nightId });
  const [ballot] = await listJudgeBallots({ userId: data.primaryUserId });
  const { rows: [score] } = await getPool().query("SELECT id FROM ballot_score WHERE ballot_id=$1", [ballot.id]);
  await saveScore({ actorUserId: data.primaryUserId, ballotId: ballot.id, scoreId: score.id, evaluationState: "SCORED", score: 7 });
  await submitBallot({ actorUserId: data.primaryUserId, ballotId: ballot.id });
  await assert.rejects(
    () => activateJudgeSubstitute({ actorUserId: data.adminId, primaryAssignmentId: data.primaryAssignmentId, reason: "Tardio" }),
    /PRIMARY_BALLOT_SUBMITTED/,
  );
});
