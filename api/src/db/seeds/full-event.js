import assert from "node:assert/strict";
import pg from "pg";
import { migrate } from "../migrate.js";
import { auditEvent } from "../../audit/audit-service.js";
import { getReadiness } from "../../modules/events/event-readiness.service.js";
import { getFullEventSeedConfig, seedFixtureUsers } from "./full-event.users.js";
import { upsertRubric } from "./full-event.rubrics.js";
import {
  FULL_EVENT, FULL_NIGHTS, FULL_TROUPES, FULL_CATEGORY, FULL_SPECIALTIES, FULL_RUBRICS,
  FULL_JUDGES, FULL_AUXILIARIES, fullScheduleForNight,
} from "./full-event.fixture.js";

async function findFixture(client) {
  const { rows } = await client.query(
    "SELECT event_id FROM configuration_seed WHERE seed_key=$1", [FULL_EVENT.seedKey],
  );
  return rows[0]?.event_id;
}

export async function validateFullCarnivalEvent(client, eventId) {
  const { rows: [event] } = await client.query("SELECT id,name,status,active FROM carnival_event WHERE id=$1", [eventId]);
  if (!event || !event.active || event.status !== "CONFIGURING") throw new Error("FULL_EVENT_SEED_EVENT_LOCKED");
  const rows = async (table) => (await client.query(`SELECT * FROM ${table} WHERE event_id=$1`, [eventId])).rows;
  try {
    assert.equal(event.name, FULL_EVENT.name);
    const nights = (await client.query(
      "SELECT *, to_char(event_date,'YYYY-MM-DD') AS date FROM night WHERE event_id=$1 ORDER BY display_order", [eventId],
    )).rows;
    assert.deepEqual(nights.map((n) => [n.name, n.display_order, n.date, n.kind, n.status]),
      FULL_NIGHTS.map((n) => [n.name, n.order, n.date, "COMPETITION", "DRAFT"]));
    const troupes = await rows("event_troupe");
    assert.deepEqual(troupes.map((t) => t.name).sort(), FULL_TROUPES.map((t) => t.name).sort());
    assert.ok(troupes.every((t) => t.active));
    const categories = await rows("event_category");
    assert.equal(categories.length, 1);
    assert.deepEqual([categories[0].code, categories[0].name, categories[0].display_order, categories[0].active],
      [FULL_CATEGORY.code, FULL_CATEGORY.name, FULL_CATEGORY.order, true]);
    assert.ok(troupes.every((t) => t.category_id === categories[0].id));
    const specialties = await rows("event_specialty");
    assert.deepEqual(specialties.map((s) => s.code).sort(), FULL_SPECIALTIES.map((s) => s.code).sort());
    assert.ok(specialties.every((s) => s.active));
    for (const entry of FULL_SPECIALTIES) {
      const specialty = specialties.find((s) => s.code === entry.code);
      assert.deepEqual([specialty.name, specialty.display_order], [entry.name, entry.order]);
    }
    const rubrics = await rows("rubric");
    assert.equal(rubrics.length, FULL_RUBRICS.length);
    const items = await rows("evaluation_item");
    assert.equal(items.length, FULL_RUBRICS.length);
    for (const entry of FULL_RUBRICS) {
      const rubric = rubrics.find((r) => r.code === entry.code);
      assert.ok(rubric);
      assert.deepEqual([rubric.name, rubric.rubric_type, rubric.evaluation_target, rubric.expected_subject_type, rubric.active],
        [entry.name, entry.type, entry.target, entry.expectedSubjectType ?? null, true]);
      assert.deepEqual([rubric.resolution_method, rubric.evaluation_objective], ["JURY", entry.evaluationObjective ?? null]);
      const item = items.find((i) => i.rubric_id === rubric.id);
      assert.ok(item);
      assert.deepEqual([item.code, item.name, item.specialty_id, item.display_order, item.active, item.required, item.allow_not_presented],
        [`${entry.code}_ITEM`, `${entry.name} — Evaluación integral`, specialties.find((s) => s.code === entry.specialty).id, 1, true, true, true]);
    }
    assert.equal((await rows("rubric_criterion")).length, 0);
    assert.equal((await rows("troupe_nomination")).length, 0);
    const assignments = (await client.query(
      `SELECT a.*, p.email, p.name, p.document_number, p.registration_status, p.user_id,
        s.code AS specialty_code FROM judge_assignment a
        JOIN judge_profile p ON p.id=a.judge_profile_id JOIN event_specialty s ON s.id=a.specialty_id
        WHERE a.event_id=$1`, [eventId],
    )).rows;
    assert.equal(assignments.length, FULL_JUDGES.length);
    assert.equal(new Set(assignments.map((a) => a.judge_profile_id)).size, FULL_JUDGES.length);
    const quotas = await rows("judge_quota");
    assert.equal(quotas.length, FULL_JUDGES.length);
    const schedule = await rows("night_troupe_schedule");
    assert.equal(schedule.length, FULL_NIGHTS.length * FULL_TROUPES.length);
    const nightSummary = [];
    for (const [index, night] of nights.entries()) {
      const definition = FULL_NIGHTS[index];
      const expectedJudges = FULL_JUDGES.filter((j) => j.nightCode === definition.code);
      const assigned = assignments.filter((a) => a.night_id === night.id);
      assert.equal(assigned.length, expectedJudges.length);
      for (const juror of expectedJudges) {
        const assignment = assigned.find((a) => a.specialty_code === juror.specialtyCode);
        assert.ok(assignment);
        assert.deepEqual([assignment.email, assignment.name, assignment.document_number, assignment.registration_status,
          assignment.assignment_type, assignment.status, assignment.replaced_assignment_id, assignment.standby_for_assignment_id],
        [juror.email, juror.name, juror.documentNumber, "REGISTERED", "PRIMARY", "ACTIVE", null, null]);
        const quota = quotas.find((q) => q.night_id === night.id && q.specialty_id === assignment.specialty_id);
        assert.equal(quota?.max_assignments, 1);
      }
      const ordered = schedule.filter((s) => s.night_id === night.id).sort((a, b) => a.presentation_order - b.presentation_order);
      assert.deepEqual(ordered.map((s) => ({ troupeName: troupes.find((t) => t.id === s.event_troupe_id)?.name,
        position: s.presentation_order, scheduledAt: s.scheduled_at?.toISOString(), zone: s.scheduled_timezone,
        source: s.order_source, status: s.status })),
      fullScheduleForNight(definition).map(({ troupeName, position, scheduledAt }) => ({ troupeName, position, scheduledAt,
        zone: FULL_EVENT.timezone, source: FULL_EVENT.orderSource, status: "SCHEDULED" })));
      nightSummary.push({ id: night.id, code: definition.code, name: night.name, date: night.date, status: night.status,
        jurors: assigned.length, participations: ordered.length, schedule: fullScheduleForNight(definition) });
    }
    for (const table of ["ballot", "ballot_score", "voting_window", "troupe_penalty", "results_release", "official_scrutiny_record"]) {
      assert.equal((await rows(table)).length, 0);
    }
    const { rows: audits } = await client.query(
      "SELECT after_data FROM audit_event WHERE action='EVENT_CONFIGURED_FROM_SEED' AND entity_id=$1", [eventId],
    );
    assert.equal(audits.length, 1);
    assert.equal(audits[0].after_data.fixtureVersion, FULL_EVENT.metadata.fixtureVersion);
    const readiness = await getReadiness({ client, eventId });
    assert.equal(readiness.ready, true);
    const nominative = rubrics.filter((r) => r.rubric_type === "NOMINATIVE").length;
    return { eventId, name: event.name, status: event.status, ready: readiness.ready, nights: nightSummary,
      troupes: troupes.length, nominative, random: rubrics.length - nominative, rubrics: rubrics.length,
      items: items.length, jurors: assignments.length, assignments: assignments.length,
      participations: schedule.length, coverage: troupes.length * nominative,
      ballots: 0, ballotsOnOpeningAllNights: assignments.length, votes: 0, penalties: 0 };
  } catch (error) {
    if (error.code !== "ERR_ASSERTION") throw error;
    throw new Error("FULL_EVENT_SEED_DRIFT: el fixture fue modificado; se conserva sin sobrescribir.", { cause: error });
  }
}

async function insertConfiguration(client, users) {
  const { rows: [event] } = await client.query("INSERT INTO carnival_event(name) VALUES($1) RETURNING id", [FULL_EVENT.name]);
  const eventId = event.id;
  await client.query("INSERT INTO configuration_seed(seed_key,event_id) VALUES($1,$2)", [FULL_EVENT.seedKey, eventId]);
  const { rows: [category] } = await client.query(
    "INSERT INTO event_category(event_id,name,code,display_order) VALUES($1,$2,$3,$4) RETURNING id",
    [eventId, FULL_CATEGORY.name, FULL_CATEGORY.code, FULL_CATEGORY.order],
  );
  const troupes = new Map();
  for (const entry of FULL_TROUPES) {
    const { rows: [troupe] } = await client.query(
      "INSERT INTO event_troupe(event_id,category_id,name) VALUES($1,$2,$3) RETURNING id", [eventId, category.id, entry.name],
    );
    troupes.set(entry.code, troupe.id);
  }
  const specialties = new Map();
  for (const entry of FULL_SPECIALTIES) {
    const { rows: [specialty] } = await client.query(
      "INSERT INTO event_specialty(event_id,name,code,display_order) VALUES($1,$2,$3,$4) RETURNING id", [eventId, entry.name, entry.code, entry.order],
    );
    specialties.set(entry.code, specialty.id);
  }
  for (const entry of FULL_RUBRICS) await upsertRubric(client, eventId, specialties, entry, entry.type, entry.target);
  for (const entry of FULL_NIGHTS) {
    const { rows: [night] } = await client.query(
      "INSERT INTO night(event_id,name,display_order,event_date,kind) VALUES($1,$2,$3,$4,'COMPETITION') RETURNING id",
      [eventId, entry.name, entry.order, entry.date],
    );
    for (const juror of FULL_JUDGES.filter((j) => j.nightCode === entry.code)) {
      const specialtyId = specialties.get(juror.specialtyCode);
      await client.query(
        "INSERT INTO judge_quota(event_id,night_id,specialty_id,max_assignments) VALUES($1,$2,$3,1)", [eventId, night.id, specialtyId],
      );
      const identity = users.judges.find((j) => j.email === juror.email);
      await client.query(
        "INSERT INTO judge_assignment(event_id,night_id,specialty_id,judge_profile_id,assignment_type) VALUES($1,$2,$3,$4,'PRIMARY')",
        [eventId, night.id, specialtyId, identity.profileId],
      );
    }
    for (const slot of fullScheduleForNight(entry)) {
      await client.query(
        `INSERT INTO night_troupe_schedule(event_id,night_id,event_troupe_id,presentation_order,scheduled_at,scheduled_timezone,order_source)
        VALUES($1,$2,$3,$4,$5,$6,$7)`,
        [eventId, night.id, troupes.get(slot.troupeCode), slot.position, slot.scheduledAt, FULL_EVENT.timezone, FULL_EVENT.orderSource],
      );
    }
  }
  await auditEvent(client, { actorUserId: null, action: "EVENT_CONFIGURED_FROM_SEED", entityType: "carnival_event", entityId: eventId,
    after: { ...FULL_EVENT.metadata, seedKey: FULL_EVENT.seedKey, year: FULL_EVENT.year, timezone: FULL_EVENT.timezone,
      schedule: FULL_NIGHTS.map((n) => ({ code: n.code, date: n.date, entries: fullScheduleForNight(n) })) } });
  return eventId;
}

export async function seedFullCarnivalEvent() {
  getFullEventSeedConfig(); // Reject non-development/test or missing credentials before DB writes.
  FULL_NIGHTS.forEach(fullScheduleForNight);
  await migrate();
  const lock = new pg.Client({ connectionString: process.env.DATABASE_URL, connectionTimeoutMillis: 3000 });
  await lock.connect();
  try {
    await lock.query("SELECT pg_advisory_lock(hashtext($1))", [FULL_EVENT.seedKey]);
    // Use the dedicated connection for the whole configuration transaction.
    // Its event lock serializes replay against administrative edits/opening
    // while leaving the service pool free for Better Auth (also with max=1).
    await lock.query("BEGIN");
    let eventId = await findFixture(lock);
    if (eventId) {
      await lock.query("SELECT id FROM carnival_event WHERE id=$1 FOR UPDATE", [eventId]);
      await validateFullCarnivalEvent(lock, eventId);
    }
    else {
      const { rows } = await lock.query("SELECT id FROM carnival_event WHERE name=$1", [FULL_EVENT.name]);
      if (rows.length) throw new Error("FULL_EVENT_SEED_NAME_CONFLICT");
    }
    // Identity services own transactions and keep their mandatory audit trail.
    // No event configuration is committed until all identities exist.
    const users = await seedFixtureUsers({ judges: FULL_JUDGES, auxiliaries: FULL_AUXILIARIES });
    if (!eventId) eventId = await insertConfiguration(lock, users);
    const summary = await validateFullCarnivalEvent(lock, eventId);
    await lock.query("COMMIT");
    return { ...summary, users };
  } catch (error) {
    await lock.query("ROLLBACK");
    throw error;
  } finally {
    await lock.end();
  }
}
