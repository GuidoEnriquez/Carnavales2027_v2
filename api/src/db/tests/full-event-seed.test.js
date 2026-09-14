import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import pg from "pg";
import { prepareDemoSeedTest } from "./demo-seed-test-environment.js";
import { seedFullCarnivalEvent, validateFullCarnivalEvent } from "../seeds/full-event.js";
import { FULL_EVENT, FULL_JUDGES, FULL_NIGHTS, FULL_SPECIALTIES, fullScheduleForNight } from "../seeds/full-event.fixture.js";
import { printFullEventSummary } from "../../scripts/seed-full-event.js";
import { createOrVerifyCredentialUser } from "../../auth/account-service.js";
import { createApp } from "../../app.js";
import { migrate } from "../migrate.js";

test("fixture puro: rotación determinista y medianoche local", () => {
  assert.deepEqual(FULL_NIGHTS.map((night) => fullScheduleForNight(night).map((s) => s.troupeCode)), [
    ["TEST-ARA", "TEST-IMP", "TEST-YAS", "TEST-SAM", "TEST-FEN", "TEST-ALG", "TEST-BRI"],
    ["TEST-BRI", "TEST-ARA", "TEST-IMP", "TEST-YAS", "TEST-SAM", "TEST-FEN", "TEST-ALG"],
    ["TEST-ALG", "TEST-BRI", "TEST-ARA", "TEST-IMP", "TEST-YAS", "TEST-SAM", "TEST-FEN"],
  ]);
  assert.equal(fullScheduleForNight(FULL_NIGHTS[0])[0].scheduledAt, "2027-02-06T23:30:00.000Z");
  assert.equal(fullScheduleForNight(FULL_NIGHTS[0])[3].scheduledAt, "2027-02-07T04:00:00.000Z");
  for (const night of FULL_NIGHTS) {
    const schedule = fullScheduleForNight(night);
    assert.deepEqual(schedule.map((s) => s.position), [1, 2, 3, 4, 5, 6, 7]);
    assert.equal(new Set(schedule.map((s) => s.troupeCode)).size, 7);
    for (let i = 1; i < schedule.length; i++) {
      assert.equal(Date.parse(schedule[i].scheduledAt) - Date.parse(schedule[i - 1].scheduledAt), 90 * 60_000);
    }
  }
  const zone = FULL_EVENT.timezone;
  try {
    FULL_EVENT.timezone = "UTC";
    assert.throws(() => fullScheduleForNight(FULL_NIGHTS[0]), /TIMEZONE_OFFSET_MISMATCH/);
  } finally { FULL_EVENT.timezone = zone; }
});

test("full seed rechaza producción antes de conectar", async () => {
  const previous = process.env.NODE_ENV;
  process.env.NODE_ENV = "production";
  try { await assert.rejects(seedFullCarnivalEvent, /REQUIRES_DEVELOPMENT_OR_TEST/); }
  finally { if (previous === undefined) delete process.env.NODE_ENV; else process.env.NODE_ENV = previous; }
});

test("evento integral: seed idempotente, horarios, apertura normal y aislamiento", { skip: !process.env.TEST_DATABASE_URL }, async (t) => {
  const { pool, password } = await prepareDemoSeedTest(t);
  await migrate();
  const { rows: [foreign] } = await pool.query("INSERT INTO carnival_event(name) VALUES('Evento ajeno de control') RETURNING *");
  await t.test("un fallo de configuración revierte evento y marcador sin borrar identidades", async () => {
    const order = FULL_SPECIALTIES[1].order;
    try {
      FULL_SPECIALTIES[1].order = FULL_SPECIALTIES[0].order;
      await assert.rejects(seedFullCarnivalEvent, { code: "23505" });
    } finally { FULL_SPECIALTIES[1].order = order; }
    assert.equal((await pool.query("SELECT count(*)::int AS n FROM configuration_seed WHERE seed_key=$1", [FULL_EVENT.seedKey])).rows[0].n, 0);
    assert.equal((await pool.query("SELECT count(*)::int AS n FROM carnival_event WHERE name=$1", [FULL_EVENT.name])).rows[0].n, 0);
    assert.equal((await pool.query('SELECT count(*)::int AS n FROM "user"')).rows[0].n, 12);
  });
  const first = await seedFullCarnivalEvent();
  const eventId = first.eventId;
  const { users } = first;
  const root = `/api/v1/events/${eventId}`;
  const byUserId = new Map([users.admin, ...users.judges, ...users.auxiliaries].map((u) => [u.userId, u]));
  const app = createApp({ getSession: async ({ headers }) => {
    const id = headers.get("x-test-user");
    return byUserId.has(id) ? { user: { id, twoFactorEnabled: headers.get("x-no-2fa") !== "true" } } : null;
  } });
  const server = await new Promise((resolve) => { const s = app.listen(0, "127.0.0.1", () => resolve(s)); });
  t.after(() => new Promise((resolve) => server.close(resolve)));
  const base = `http://127.0.0.1:${server.address().port}`;
  const request = (path, { user = users.admin, method = "GET", body, headers = {} } = {}) => fetch(`${base}${path}`, {
    method, headers: { "content-type": "application/json", "x-test-user": user.userId, ...headers },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });

  await t.test("conteos reales, estados, identidades y cero votos", async () => {
    assert.equal(first.status, "CONFIGURING");
    assert.equal(first.ready, true);
    assert.equal(first.nights.length, 3);
    assert.equal(first.troupes, 7);
    assert.equal(first.nominative, 25);
    assert.equal(first.random, 11);
    assert.equal(first.rubrics, 36);
    assert.equal(first.jurors, 9);
    assert.equal(first.assignments, 9);
    assert.equal(first.participations, 21);
    assert.equal(first.coverage, 175);
    assert.equal(first.ballots, 0);
    assert.equal(first.votes, 0);
    assert.equal(first.penalties, 0);
    assert.ok(first.nights.every((n) => n.status === "DRAFT" && n.jurors === 3));
    const { rows: identities } = await pool.query('SELECT id,email FROM "user"');
    assert.equal(identities.length, 12); // ADMIN + 9 JUDGE + ESCRIBANO + VEEDOR in this fresh fixture.
    for (const user of [users.admin, ...users.judges, ...users.auxiliaries]) {
      assert.equal((await createOrVerifyCredentialUser({ name: "Fixture", email: user.email, password })).created, false);
    }
    for (const user of users.judges) {
      const definition = FULL_JUDGES.find((j) => j.email === user.email);
      const assigned = await (await request("/api/v1/judge/assignments", { user })).json();
      assert.equal(assigned.length, 1);
      assert.equal(assigned[0].nightId, first.nights.find((n) => n.code === definition.nightCode).id);
    }
    const lines = [];
    printFullEventSummary(first, (line) => lines.push(line));
    assert.ok(lines.some((line) => line.includes("0 iniciales; 9")));
    assert.ok(!lines.join("\n").includes(password));
    const audit = (await pool.query("SELECT actor_user_id,after_data FROM audit_event WHERE action='EVENT_CONFIGURED_FROM_SEED' AND entity_id=$1", [eventId])).rows;
    assert.equal(audit.length, 1);
    assert.equal(audit[0].actor_user_id, null);
    assert.equal(audit[0].after_data.officialData, false);
    assert.equal(audit[0].after_data.fixtureVersion, "2027.2");
  });
  await t.test("replay concurrente preserva UUIDs, configuración, auditoría y evento ajeno", async () => {
    const snapshot = async () => {
      const output = {};
      for (const table of ["night", "event_troupe", "rubric", "evaluation_item", "judge_assignment", "night_troupe_schedule"]) {
        output[table] = (await pool.query(`SELECT * FROM ${table} WHERE event_id=$1 ORDER BY id`, [eventId])).rows;
      }
      return output;
    };
    const before = await snapshot();
    const [second, third] = await Promise.all([seedFullCarnivalEvent(), seedFullCarnivalEvent()]);
    assert.equal(second.eventId, eventId);
    assert.equal(third.eventId, eventId);
    assert.deepEqual(await snapshot(), before);
    assert.deepEqual((await pool.query("SELECT * FROM carnival_event WHERE id=$1", [foreign.id])).rows, [foreign]);
    assert.equal((await pool.query("SELECT count(*)::int AS n FROM configuration_seed WHERE seed_key=$1", [FULL_EVENT.seedKey])).rows[0].n, 1);
    assert.equal((await pool.query("SELECT count(*)::int AS n FROM audit_event WHERE action='EVENT_CONFIGURED_FROM_SEED' AND entity_id=$1", [eventId])).rows[0].n, 1);
  });
  await t.test("API programa fechas completas por jornada; FK y unicidad se mantienen", async () => {
    for (const [index, night] of first.nights.entries()) {
      const response = await request(`${root}/schedule?nightId=${night.id}`);
      assert.equal(response.status, 200);
      const schedule = await response.json();
      assert.equal(schedule.length, 7);
      assert.deepEqual(schedule.map((s) => [s.troupeName, s.presentationOrder, s.scheduledAt]),
        fullScheduleForNight(FULL_NIGHTS[index]).map((s) => [s.troupeName, s.position, s.scheduledAt]));
      assert.ok(schedule.every((s) => s.scheduledTimezone === FULL_EVENT.timezone && s.orderSource === "TEST_SIMULATED_DRAW"));
      await assert.rejects(() => pool.query("UPDATE night_troupe_schedule SET presentation_order=1 WHERE id=$1", [schedule[1].id]), { code: "23505" });
      await assert.rejects(() => pool.query("UPDATE night_troupe_schedule SET scheduled_timezone='Invalid/Zone' WHERE id=$1", [schedule[0].id]), /SCHEDULE_TIMEZONE_INVALID/);
      await assert.rejects(() => pool.query("UPDATE night_troupe_schedule SET scheduled_at=NULL WHERE id=$1", [schedule[0].id]), { code: "23514" });
    }
  });
  await t.test("deriva se rechaza sin borrar ni corregir la edición", async () => {
    const row = (await pool.query("SELECT id,name FROM event_troupe WHERE event_id=$1 LIMIT 1", [eventId])).rows[0];
    await pool.query("UPDATE event_troupe SET name='Edición manual conservada' WHERE id=$1", [row.id]);
    await assert.rejects(seedFullCarnivalEvent, /FULL_EVENT_SEED_DRIFT/);
    assert.equal((await pool.query("SELECT name FROM event_troupe WHERE id=$1", [row.id])).rows[0].name, "Edición manual conservada");
    await pool.query("UPDATE event_troupe SET name=$2 WHERE id=$1", [row.id, row.name]);
    await validateFullCarnivalEvent(pool, eventId);
    const item = (await pool.query("SELECT id,name FROM evaluation_item WHERE event_id=$1 LIMIT 1", [eventId])).rows[0];
    await pool.query("UPDATE evaluation_item SET name='Ítem editado' WHERE id=$1", [item.id]);
    await assert.rejects(seedFullCarnivalEvent, /FULL_EVENT_SEED_DRIFT/);
    await pool.query("UPDATE evaluation_item SET name=$2 WHERE id=$1", [item.id, item.name]);
  });
  await t.test("edición concurrente se serializa antes de restablecer credenciales", async () => {
    const editor = new pg.Client({ connectionString: process.env.DATABASE_URL });
    await editor.connect();
    const oldPassword = process.env.SEED_DEMO_PASSWORD;
    const accounts = (await pool.query("SELECT id,password FROM account ORDER BY id")).rows;
    let replay;
    try {
      await editor.query("BEGIN");
      await editor.query("SELECT id FROM carnival_event WHERE id=$1 FOR UPDATE", [eventId]);
      process.env.SEED_DEMO_PASSWORD = randomUUID();
      replay = seedFullCarnivalEvent().catch((error) => error);
      let waiting = false;
      for (let attempt = 0; attempt < 200 && !waiting; attempt++) {
        await editor.query("SELECT pg_stat_clear_snapshot()");
        waiting = (await editor.query(`SELECT EXISTS(SELECT 1 FROM pg_stat_activity WHERE datname=current_database()
          AND wait_event_type='Lock' AND query='SELECT id FROM carnival_event WHERE id=$1 FOR UPDATE') AS waiting`)).rows[0].waiting;
        if (!waiting) await new Promise((resolve) => setTimeout(resolve, 10));
      }
      assert.equal(waiting, true, "seed debe esperar el lock de configuración");
      await editor.query("UPDATE carnival_event SET name='Edición concurrente' WHERE id=$1", [eventId]);
      await editor.query("COMMIT");
      assert.match((await replay).message, /FULL_EVENT_SEED_DRIFT/);
      assert.deepEqual((await pool.query("SELECT id,password FROM account ORDER BY id")).rows, accounts);
    } finally {
      await editor.query("ROLLBACK");
      if (replay) await replay;
      process.env.SEED_DEMO_PASSWORD = oldPassword;
      await editor.query("UPDATE carnival_event SET name=$2 WHERE id=$1", [eventId, FULL_EVENT.name]);
      await editor.end();
    }
  });
  await t.test("ADMIN abre solo jornada 1 por el flujo HTTP; otras jornadas quedan bloqueadas", async () => {
    const firstNight = first.nights[0];
    assert.equal((await request(`${root}/open`, { method: "POST", body: {}, headers: { "x-no-2fa": "true" } })).status, 403);
    assert.equal((await request(`${root}/open`, { method: "POST", body: {} })).status, 200);
    assert.equal((await request(`/api/v1/nights/${firstNight.id}`, { method: "PATCH", body: {
      name: firstNight.name, displayOrder: 1, kind: "COMPETITION", eventDate: firstNight.date, status: "OPEN",
    } })).status, 200);
    const response = await request(`${root}/nights/${firstNight.id}/voting/open`, { method: "POST", body: {} });
    assert.equal(response.status, 201);
    assert.equal((await response.json()).ballotsCreated, 3);
    for (const night of first.nights.slice(1)) {
      const blocked = await request(`${root}/nights/${night.id}/voting/open`, { method: "POST", body: {} });
      assert.equal(blocked.status, 409);
      assert.equal((await blocked.json()).code, "NIGHT_NOT_OPEN");
    }
    for (const juror of users.judges.slice(3)) {
      assert.deepEqual(await (await request("/api/v1/judge/ballots", { user: juror })).json(), []);
    }
    await assert.rejects(seedFullCarnivalEvent, /FULL_EVENT_SEED_EVENT_LOCKED/);
    const schedule = (await pool.query("SELECT id FROM night_troupe_schedule WHERE event_id=$1 LIMIT 1", [eventId])).rows[0];
    await assert.rejects(() => pool.query("UPDATE night_troupe_schedule SET scheduled_at=scheduled_at+interval '1 minute' WHERE id=$1", [schedule.id]), /EVENT_LOCKED/);
  });
  await t.test("PENDING/NULL, especialidad propia, aislamiento y rechazo de cierre incompleto", async () => {
    for (const juror of users.judges.slice(0, 3)) {
      const ballots = await (await request("/api/v1/judge/ballots", { user: juror })).json();
      assert.equal(ballots.length, 1);
      const ballot = await (await request(`/api/v1/judge/ballots/${ballots[0].id}`, { user: juror })).json();
      assert.equal(ballot.status, "OPEN");
      assert.equal(ballot.submittedAt, null);
      assert.ok(ballot.scores.every((s) => s.evaluationState === "PENDING" && s.score === null && s.lockedAt === null));
      assert.deepEqual([...new Set(ballot.scores.map((s) => s.presentationOrder))], [1, 2, 3, 4, 5, 6, 7]);
      const ownItems = (await pool.query("SELECT id FROM evaluation_item WHERE event_id=$1 AND specialty_id=$2", [eventId, ballot.specialtyId])).rows.map((i) => i.id);
      assert.ok(ballot.scores.every((s) => ownItems.includes(s.evaluationItemId)));
      const forbidden = await request(`/api/v1/judge/ballots/${ballot.id}`, { user: users.judges[3] });
      assert.equal(forbidden.status, 409); // Existing API contract for ballot ownership.
      assert.equal((await forbidden.json()).code, "BALLOT_ACCESS_DENIED");
      const submit = await request(`/api/v1/judge/ballots/${ballot.id}/submit`, { user: juror, method: "POST", body: {} });
      assert.equal(submit.status, 409);
      assert.equal((await submit.json()).code, "BALLOT_INCOMPLETE");
    }
    assert.equal((await request(`${root}/nights/${first.nights[0].id}/voting/close`, { method: "POST", body: {} })).status, 409);
    for (const user of users.auxiliaries) {
      assert.equal((await request("/api/v1/judge/ballots", { user })).status, 403);
    }
    const veedor = users.auxiliaries.find((u) => u.role === "VEEDOR");
    for (const night of first.nights) assert.equal((await request(`${root}/nights/${night.id}/voting/status`, { user: veedor })).status, 200);
  });
  await t.test("puntuación normal 1..10, cero explícito, idempotencia y decisión inmutable", async () => {
    const user = users.judges[0]; // BAILE: enough independent items in the first troupe.
    const [{ id }] = await (await request("/api/v1/judge/ballots", { user })).json();
    const ballot = await (await request(`/api/v1/judge/ballots/${id}`, { user })).json();
    const scores = ballot.scores.filter((s) => s.presentationOrder === 1);
    assert.ok(scores.length > 11);
    const path = (score) => `/api/v1/judge/ballots/${id}/scores/${score.id}`;
    const foreignScore = (await pool.query("SELECT id FROM ballot_score WHERE event_id=$1 AND ballot_id<>$2 LIMIT 1", [eventId, id])).rows[0];
    const wrongSpecialty = await request(path(foreignScore), { user, method: "PUT", body: { evaluationState: "SCORED", score: 8 } });
    assert.equal(wrongSpecialty.status, 409);
    assert.equal((await wrongSpecialty.json()).code, "SCORE_NOT_FOUND");
    for (const value of [-1, 0, 11]) {
      assert.equal((await request(path(scores[0]), { user, method: "PUT", body: { evaluationState: "SCORED", score: value } })).status, 400);
    }
    const operationId = randomUUID();
    for (let score = 1; score <= 10; score++) {
      const response = await request(path(scores[score - 1]), { user, method: "PUT", body: { evaluationState: "SCORED", score },
        headers: score === 1 ? { "Idempotency-Key": operationId } : {} });
      assert.equal(response.status, 200);
      assert.equal((await response.json()).score, score);
    }
    const replay = await request(path(scores[0]), { user, method: "PUT", body: { evaluationState: "SCORED", score: 1 }, headers: { "Idempotency-Key": operationId } });
    assert.equal(replay.status, 200);
    assert.equal(replay.headers.get("Idempotency-Replay"), "true");
    assert.equal((await request(path(scores[0]), { user, method: "PUT", body: { evaluationState: "SCORED", score: 8 } })).status, 409);
    const missing = await request(path(scores[10]), { user, method: "PUT", body: { evaluationState: "NOT_PRESENTED" } });
    assert.equal(missing.status, 200);
    assert.equal((await missing.json()).score, 0);
    const after = await (await request(`/api/v1/judge/ballots/${id}`, { user })).json();
    assert.ok(after.scores.some((s) => s.evaluationState === "PENDING" && s.score === null));
    // Scores above exist only in this isolated test, never in the seeded local event.
  });
  await t.test("abrir las otras jornadas genera nueve planillas totales, no 63", async () => {
    for (const [index, night] of first.nights.entries()) {
      if (index === 0) continue;
      assert.equal((await request(`/api/v1/nights/${night.id}`, { method: "PATCH", body: {
        name: night.name, displayOrder: index + 1, kind: "COMPETITION", eventDate: night.date, status: "OPEN",
      } })).status, 200);
      const opened = await request(`${root}/nights/${night.id}/voting/open`, { method: "POST", body: {} });
      assert.equal(opened.status, 201);
      assert.equal((await opened.json()).ballotsCreated, 3);
      const ballots = (await pool.query("SELECT id FROM ballot WHERE night_id=$1", [night.id])).rows;
      assert.equal(ballots.length, 3);
      const scores = (await pool.query("SELECT score,evaluation_state FROM ballot_score WHERE ballot_id=ANY($1)", [ballots.map((b) => b.id)])).rows;
      assert.equal(scores.length, 36 * 7);
      assert.ok(scores.every((s) => s.score === null && s.evaluation_state === "PENDING"));
    }
    assert.equal((await pool.query("SELECT count(*)::int AS n FROM ballot WHERE event_id=$1", [eventId])).rows[0].n, 9);
  });
});
