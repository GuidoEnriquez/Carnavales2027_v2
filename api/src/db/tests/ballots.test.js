import { describe, it, before, after, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { getPool, closePool } from "../pool.js";
import { migrate } from "../migrate.js";

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

async function setupTestData() {
  const suffix = Math.random().toString(36).slice(2, 8);
  const { rows: [event] } = await client.query(
    "INSERT INTO carnival_event(name) VALUES($1) RETURNING id", [`Test Ballots ${suffix}`],
  );
  const { rows: [night] } = await client.query(
    "INSERT INTO night(event_id, name, display_order, kind, status) VALUES($1,$2,$3,$4,$5) RETURNING id",
    [event.id, "Noche 1", 1, "COMPETITION", "OPEN"],
  );
  const { rows: [specialty] } = await client.query(
    "INSERT INTO event_specialty(event_id, name, code, display_order) VALUES($1,$2,$3,$4) RETURNING id",
    [event.id, "Baile", "BAILE", 1],
  );
  const { rows: [rubric] } = await client.query(
    "INSERT INTO rubric(event_id, name, code, evaluation_target) VALUES($1,$2,$3,$4) RETURNING id",
    [event.id, "Reina", "REINA", "TROUPE"],
  );
  const { rows: [item] } = await client.query(
    "INSERT INTO evaluation_item(event_id, rubric_id, specialty_id, name, code) VALUES($1,$2,$3,$4,$5) RETURNING id",
    [event.id, rubric.id, specialty.id, "Presencia", "PRESENCIA"],
  );
  const { rows: [category] } = await client.query(
    "INSERT INTO event_category(event_id, name, code, display_order) VALUES($1,$2,$3,$4) RETURNING id",
    [event.id, "Primera", "PRIMERA", 1],
  );
  const { rows: [troupe] } = await client.query(
    "INSERT INTO event_troupe(event_id, category_id, name) VALUES($1,$2,$3) RETURNING id",
    [event.id, category.id, "Comparsa 1"],
  );
  const { rows: [schedule] } = await client.query(
    "INSERT INTO night_troupe_schedule(event_id, night_id, event_troupe_id, presentation_order, status) VALUES($1,$2,$3,$4,$5) RETURNING id",
    [event.id, night.id, troupe.id, 1, "SCHEDULED"],
  );
  const adminId = randomUUID();
  const judgeUserId = randomUUID();
  await client.query(
    `INSERT INTO "user"(id, name, email, "emailVerified")
     VALUES ($1, 'Admin', $2, true), ($3, 'Judge', $4, true)`,
    [adminId, `${adminId}@example.test`, judgeUserId, `${judgeUserId}@example.test`],
  );
  const { rows: [judgeProfile] } = await client.query(
    "INSERT INTO judge_profile(name, email, document_number, registration_status, created_by) VALUES($1,$2,$3,$4,$5) RETURNING id",
    [`Judge ${suffix}`, `judge${suffix}@test.test`, `DOC${suffix}`, "INVITED", adminId],
  );
  await client.query(
    "UPDATE judge_profile SET user_id = $2, registration_status = 'REGISTERED' WHERE id = $1",
    [judgeProfile.id, judgeUserId],
  );
  await client.query(
    "INSERT INTO judge_quota(event_id, night_id, specialty_id, max_assignments) VALUES($1,$2,$3,$4)",
    [event.id, night.id, specialty.id, 3],
  );
  const { rows: [assignment] } = await client.query(
    `INSERT INTO judge_assignment(event_id, night_id, specialty_id, judge_profile_id, assignment_type)
     VALUES($1,$2,$3,$4,$5) RETURNING id`,
    [event.id, night.id, specialty.id, judgeProfile.id, "PRIMARY"],
  );

  return { event, night, specialty, rubric, item, troupe, schedule, judgeProfile, assignment };
}

describe("ballots DB", () => {
  it("crea planilla y scores al abrir votación", async () => {
    const data = await setupTestData();
    const { rows: [ballot] } = await client.query(
      `INSERT INTO ballot(event_id, night_id, judge_assignment_id, judge_profile_id, specialty_id)
       VALUES($1,$2,$3,$4,$5) RETURNING id, status`,
      [data.event.id, data.night.id, data.assignment.id, data.judgeProfile.id, data.specialty.id],
    );
    assert.equal(ballot.status, "OPEN");

    const { rows: [score] } = await client.query(
      "INSERT INTO ballot_score(ballot_id, event_id, evaluation_item_id, rubric_id, night_schedule_id) VALUES($1,$2,$3,$4,$5) RETURNING id, evaluation_state",
      [ballot.id, data.event.id, data.item.id, data.rubric.id, data.schedule.id],
    );
    assert.ok(score.id);
    assert.equal(score.evaluation_state, "PENDING");

    const { rows: scores } = await client.query(
      "SELECT * FROM ballot_score WHERE ballot_id = $1",
      [ballot.id],
    );
    assert.equal(scores.length, 1);
    assert.equal(scores[0].evaluation_item_id, data.item.id);

  });

  it("permite un score del mismo ítem por cada comparsa programada", async () => {
    const data = await setupTestData();
    const { rows: [ballot] } = await client.query(
      `INSERT INTO ballot(event_id, night_id, judge_assignment_id, judge_profile_id, specialty_id)
       VALUES($1,$2,$3,$4,$5) RETURNING id`,
      [data.event.id, data.night.id, data.assignment.id, data.judgeProfile.id, data.specialty.id],
    );
    const { rows: [troupe] } = await client.query(
      "INSERT INTO event_troupe(event_id, category_id, name) SELECT event_id, category_id, $2 FROM event_troupe WHERE id = $1 RETURNING id",
      [data.troupe.id, "Comparsa 2"],
    );
    const { rows: [secondSchedule] } = await client.query(
      `INSERT INTO night_troupe_schedule(event_id, night_id, event_troupe_id, presentation_order, status)
       VALUES($1,$2,$3,$4,$5) RETURNING id`,
      [data.event.id, data.night.id, troupe.id, 2, "SCHEDULED"],
    );
    await client.query(
      `INSERT INTO ballot_score(ballot_id, event_id, evaluation_item_id, rubric_id, night_schedule_id)
       VALUES($1,$2,$3,$4,$5), ($1,$2,$3,$4,$6)`,
      [ballot.id, data.event.id, data.item.id, data.rubric.id, data.schedule.id, secondSchedule.id],
    );
    const { rows: scores } = await client.query(
      "SELECT night_schedule_id FROM ballot_score WHERE ballot_id = $1 ORDER BY night_schedule_id",
      [ballot.id],
    );
    assert.equal(scores.length, 2);
    assert.deepEqual(scores.map((score) => score.night_schedule_id).sort(), [data.schedule.id, secondSchedule.id].sort());
  });

  it("reject score out of range", async () => {
    const data = await setupTestData();
    const { rows: [ballot] } = await client.query(
      `INSERT INTO ballot(event_id, night_id, judge_assignment_id, judge_profile_id, specialty_id)
       VALUES($1,$2,$3,$4,$5) RETURNING id`,
      [data.event.id, data.night.id, data.assignment.id, data.judgeProfile.id, data.specialty.id],
    );
    const { rows: [score] } = await client.query(
      "INSERT INTO ballot_score(ballot_id, event_id, evaluation_item_id, rubric_id, night_schedule_id) VALUES($1,$2,$3,$4,$5) RETURNING id",
      [ballot.id, data.event.id, data.item.id, data.rubric.id, data.schedule.id],
    );

    await assert.rejects(
      () => client.query("UPDATE ballot_score SET score = 11 WHERE id = $1", [score.id]),
      /CHECK|BALLOT_SCORE_OUT_OF_RANGE/,
    );
  });

  it("ballot is immutable after submit", async () => {
    const data = await setupTestData();
    const { rows: [ballot] } = await client.query(
      `INSERT INTO ballot(event_id, night_id, judge_assignment_id, judge_profile_id, specialty_id)
       VALUES($1,$2,$3,$4,$5) RETURNING id`,
      [data.event.id, data.night.id, data.assignment.id, data.judgeProfile.id, data.specialty.id],
    );
    await client.query(
      "UPDATE ballot SET status = 'SUBMITTED', submitted_at = clock_timestamp() WHERE id = $1",
      [ballot.id],
    );
    await assert.rejects(
      () => client.query("UPDATE ballot SET status = 'OPEN' WHERE id = $1", [ballot.id]),
      /BALLOT_IMMUTABLE_AFTER_SUBMIT/,
    );
  });

  it("bloquea nuevas reaperturas y permite finalizar una reapertura histórica", async () => {
    const data = await setupTestData();
    const { rows: [ballot] } = await client.query(
      `INSERT INTO ballot(event_id, night_id, judge_assignment_id, judge_profile_id, specialty_id)
       VALUES($1,$2,$3,$4,$5) RETURNING id`,
      [data.event.id, data.night.id, data.assignment.id, data.judgeProfile.id, data.specialty.id],
    );
    await client.query(
      "UPDATE ballot SET status = 'SUBMITTED', submitted_at = clock_timestamp() WHERE id = $1",
      [ballot.id],
    );
    await client.query("SAVEPOINT attempted_reopen");
    await assert.rejects(
      () => client.query("UPDATE ballot SET status = 'REOPENED', reopened_at = clock_timestamp() WHERE id = $1", [ballot.id]),
      /BALLOT_REOPEN_DISABLED/,
    );
    await client.query("ROLLBACK TO SAVEPOINT attempted_reopen");
    await client.query("ALTER TABLE ballot DISABLE TRIGGER USER");
    try {
      await client.query(
        "UPDATE ballot SET status = 'REOPENED', reopened_at = clock_timestamp(), reopen_count = 1 WHERE id = $1",
        [ballot.id],
      );
    } finally {
      await client.query("ALTER TABLE ballot ENABLE TRIGGER USER");
    }
    await client.query(
      "UPDATE ballot SET status = 'SUBMITTED' WHERE id = $1",
      [ballot.id],
    );
    const { rows: [updated] } = await client.query(
      "SELECT status, reopen_count, submitted_at FROM ballot WHERE id = $1",
      [ballot.id],
    );
    assert.equal(updated.status, "SUBMITTED");
    assert.equal(updated.reopen_count, 1);
    assert.ok(updated.submitted_at);
  });

  it("distingue pendientes, puntuaciones y no presentados", async () => {
    const data = await setupTestData();
    const { rows: [ballot] } = await client.query(
      `INSERT INTO ballot(event_id, night_id, judge_assignment_id, judge_profile_id, specialty_id)
       VALUES($1,$2,$3,$4,$5) RETURNING id`,
      [data.event.id, data.night.id, data.assignment.id, data.judgeProfile.id, data.specialty.id],
    );
    const { rows: [score] } = await client.query(
      "INSERT INTO ballot_score(ballot_id, event_id, evaluation_item_id, rubric_id, night_schedule_id) VALUES($1,$2,$3,$4,$5) RETURNING id",
      [ballot.id, data.event.id, data.item.id, data.rubric.id, data.schedule.id],
    );
    await client.query("UPDATE ballot_score SET score = 7, evaluation_state = 'SCORED' WHERE id = $1", [score.id]);
    const { rows: [scored] } = await client.query("SELECT score, evaluation_state FROM ballot_score WHERE id = $1", [score.id]);
    assert.equal(scored.score, 7);
    assert.equal(scored.evaluation_state, "SCORED");
    await client.query("UPDATE ballot_score SET score = 0, evaluation_state = 'NOT_PRESENTED' WHERE id = $1", [score.id]);
    const { rows: [updated] } = await client.query("SELECT score, evaluation_state FROM ballot_score WHERE id = $1", [score.id]);
    assert.equal(updated.score, 0);
    assert.equal(updated.evaluation_state, "NOT_PRESENTED");
  });

  it("rechaza combinaciones inválidas de estado y puntuación", async () => {
    const data = await setupTestData();
    const { rows: [ballot] } = await client.query(
      `INSERT INTO ballot(event_id, night_id, judge_assignment_id, judge_profile_id, specialty_id)
       VALUES($1,$2,$3,$4,$5) RETURNING id`,
      [data.event.id, data.night.id, data.assignment.id, data.judgeProfile.id, data.specialty.id],
    );
    await assert.rejects(
      () => client.query(
        `INSERT INTO ballot_score(ballot_id, event_id, evaluation_item_id, rubric_id, night_schedule_id, score, evaluation_state)
         VALUES($1,$2,$3,$4,$5,$6,$7)`,
        [ballot.id, data.event.id, data.item.id, data.rubric.id, data.schedule.id, 0, "SCORED"],
      ),
      /ballot_score_evaluation_state_ck/,
    );
  });

  it("audit log registra acciones", async () => {
    const data = await setupTestData();
    const { rows: [ballot] } = await client.query(
      `INSERT INTO ballot(event_id, night_id, judge_assignment_id, judge_profile_id, specialty_id)
       VALUES($1,$2,$3,$4,$5) RETURNING id`,
      [data.event.id, data.night.id, data.assignment.id, data.judgeProfile.id, data.specialty.id],
    );
    await client.query(
      "INSERT INTO ballot_audit_log(ballot_id, event_id, action, actor_id, reason) VALUES($1,$2,$3,$4,$5)",
      [ballot.id, data.event.id, "BALLOT_OPENED", "admin-user-id", null],
    );
    const { rows: logs } = await client.query(
      "SELECT action FROM ballot_audit_log WHERE ballot_id = $1",
      [ballot.id],
    );
    assert.equal(logs.length, 1);
    assert.equal(logs[0].action, "BALLOT_OPENED");
    await assert.rejects(
      () => client.query("UPDATE ballot_audit_log SET reason = 'Cambio' WHERE ballot_id = $1", [ballot.id]),
      /BALLOT_AUDIT_IMMUTABLE/,
    );
  });

  it("mantiene revisiones y ledger offline inmutables", async () => {
    const data = await setupTestData();
    const actorUserId = randomUUID();
    const { rows: [ballot] } = await client.query(
      `INSERT INTO ballot(event_id, night_id, judge_assignment_id, judge_profile_id, specialty_id)
       VALUES($1,$2,$3,$4,$5) RETURNING id, revision`,
      [data.event.id, data.night.id, data.assignment.id, data.judgeProfile.id, data.specialty.id],
    );
    assert.equal(Number(ballot.revision), 0);
    const operationId = randomUUID();
    await client.query(
      `INSERT INTO ballot_sync_operation
        (actor_user_id, ballot_id, operation_id, operation_type, content_hash, applied_revision)
       VALUES($1,$2,$3,'SAVE_SCORE',$4,1)`,
      [actorUserId, ballot.id, operationId, "a".repeat(64)],
    );
    await client.query("SAVEPOINT sync_operation_update");
    await assert.rejects(
      () => client.query("UPDATE ballot_sync_operation SET applied_revision = 2 WHERE ballot_id = $1", [ballot.id]),
      /BALLOT_SYNC_OPERATION_IMMUTABLE/,
    );
    await client.query("ROLLBACK TO SAVEPOINT sync_operation_update");
    await client.query("SAVEPOINT sync_operation_delete");
    await assert.rejects(
      () => client.query("DELETE FROM ballot_sync_operation WHERE ballot_id = $1", [ballot.id]),
      /BALLOT_SYNC_OPERATION_IMMUTABLE/,
    );
    await client.query("ROLLBACK TO SAVEPOINT sync_operation_delete");
  });

  it("exige que la planilla coincida con su asignación activa", async () => {
    const data = await setupTestData();
    const { rows: [otherSpecialty] } = await client.query(
      "INSERT INTO event_specialty(event_id, name, code, display_order) VALUES($1,$2,$3,$4) RETURNING id",
      [data.event.id, "Música", "MUSICA", 2],
    );
    await assert.rejects(
      () => client.query(
        `INSERT INTO ballot(event_id, night_id, judge_assignment_id, judge_profile_id, specialty_id)
         VALUES($1,$2,$3,$4,$5)`,
        [data.event.id, data.night.id, data.assignment.id, data.judgeProfile.id, otherSpecialty.id],
      ),
      /BALLOT_ASSIGNMENT_MISMATCH/,
    );
  });

  it("exige que cada puntaje pertenezca a la noche de su planilla", async () => {
    const data = await setupTestData();
    const { rows: [ballot] } = await client.query(
      `INSERT INTO ballot(event_id, night_id, judge_assignment_id, judge_profile_id, specialty_id)
       VALUES($1,$2,$3,$4,$5) RETURNING id`,
      [data.event.id, data.night.id, data.assignment.id, data.judgeProfile.id, data.specialty.id],
    );
    const { rows: [otherNight] } = await client.query(
      "INSERT INTO night(event_id, name, display_order, kind, status) VALUES($1,$2,$3,$4,$5) RETURNING id",
      [data.event.id, "Noche 2", 2, "COMPETITION", "OPEN"],
    );
    const { rows: [otherSchedule] } = await client.query(
      `INSERT INTO night_troupe_schedule(event_id, night_id, event_troupe_id, presentation_order, status)
       VALUES($1,$2,$3,$4,$5) RETURNING id`,
      [data.event.id, otherNight.id, data.troupe.id, 1, "SCHEDULED"],
    );
    await assert.rejects(
      () => client.query(
        `INSERT INTO ballot_score(ballot_id, event_id, evaluation_item_id, rubric_id, night_schedule_id)
         VALUES($1,$2,$3,$4,$5)`,
        [ballot.id, data.event.id, data.item.id, data.rubric.id, otherSchedule.id],
      ),
      /BALLOT_SCORE_NIGHT_MISMATCH/,
    );
  });

  it("impide alterar el rubro de un puntaje borrador", async () => {
    const data = await setupTestData();
    const { rows: [ballot] } = await client.query(
      `INSERT INTO ballot(event_id, night_id, judge_assignment_id, judge_profile_id, specialty_id)
       VALUES($1,$2,$3,$4,$5) RETURNING id`,
      [data.event.id, data.night.id, data.assignment.id, data.judgeProfile.id, data.specialty.id],
    );
    const { rows: [score] } = await client.query(
      `INSERT INTO ballot_score(ballot_id, event_id, evaluation_item_id, rubric_id, night_schedule_id)
       VALUES($1,$2,$3,$4,$5) RETURNING id`,
      [ballot.id, data.event.id, data.item.id, data.rubric.id, data.schedule.id],
    );
    const { rows: [otherRubric] } = await client.query(
      "INSERT INTO rubric(event_id, name, code, evaluation_target) VALUES($1,$2,$3,$4) RETURNING id",
      [data.event.id, "Otra reina", "OTRA_REINA", "TROUPE"],
    );
    await assert.rejects(
      () => client.query("UPDATE ballot_score SET rubric_id = $2 WHERE id = $1", [score.id, otherRubric.id]),
      /BALLOT_SCORE_RUBRIC_MISMATCH/,
    );
  });

  it("impide borrar planillas y puntajes", async () => {
    const data = await setupTestData();
    const { rows: [ballot] } = await client.query(
      `INSERT INTO ballot(event_id, night_id, judge_assignment_id, judge_profile_id, specialty_id)
       VALUES($1,$2,$3,$4,$5) RETURNING id`,
      [data.event.id, data.night.id, data.assignment.id, data.judgeProfile.id, data.specialty.id],
    );
    const { rows: [score] } = await client.query(
      "INSERT INTO ballot_score(ballot_id, event_id, evaluation_item_id, rubric_id, night_schedule_id) VALUES($1,$2,$3,$4,$5) RETURNING id",
      [ballot.id, data.event.id, data.item.id, data.rubric.id, data.schedule.id],
    );
    await client.query("SAVEPOINT delete_score");
    await assert.rejects(() => client.query("DELETE FROM ballot_score WHERE id = $1", [score.id]), /BALLOT_SCORE_DELETE_FORBIDDEN/);
    await client.query("ROLLBACK TO SAVEPOINT delete_score");
    await assert.rejects(() => client.query("DELETE FROM ballot WHERE id = $1", [ballot.id]), /BALLOT_DELETE_FORBIDDEN/);
  });
});
