import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import { createApp } from "../app.js";
import { closePool, getPool } from "../db/pool.js";
import { migrate } from "../db/migrate.js";

const originalDatabaseUrl = process.env.DATABASE_URL;

function withServer(app) {
  return new Promise((resolve) => {
    const server = app.listen(0, "127.0.0.1", () => resolve(server));
  });
}

async function seedNight(pool, eventId, name, order) {
  const { rows: [night] } = await pool.query(
    "INSERT INTO night(event_id, name, display_order, kind, status) VALUES($1,$2,$3,'COMPETITION','DRAFT') RETURNING id",
    [eventId, name, order],
  );
  return night;
}

async function seedTroupe(pool, eventId, categoryId, name) {
  const { rows: [troupe] } = await pool.query(
    "INSERT INTO event_troupe(event_id, category_id, name) VALUES($1,$2,$3) RETURNING id",
    [eventId, categoryId, name],
  );
  return troupe;
}

async function seedSchedule(pool, eventId, nightId, troupeId, order) {
  const { rows: [entry] } = await pool.query(
    `INSERT INTO night_troupe_schedule(event_id, night_id, event_troupe_id, presentation_order, status)
     VALUES($1,$2,$3,$4,'SCHEDULED') RETURNING id`,
    [eventId, nightId, troupeId, order],
  );
  return entry;
}

async function seedEvent(pool, name) {
  const { rows: [event] } = await pool.query("INSERT INTO carnival_event(name) VALUES($1) RETURNING id", [name]);
  const { rows: [category] } = await pool.query(
    "INSERT INTO event_category(event_id, name, code, display_order) VALUES($1,'Primera','PRIMERA',1) RETURNING id",
    [event.id],
  );
  const night = await seedNight(pool, event.id, "Noche 1", 1);
  const troupeA = await seedTroupe(pool, event.id, category.id, "A");
  const troupeB = await seedTroupe(pool, event.id, category.id, "B");
  const entryA = await seedSchedule(pool, event.id, night.id, troupeA.id, 1);
  const entryB = await seedSchedule(pool, event.id, night.id, troupeB.id, 2);
  const { rows: [specialty] } = await pool.query(
    "INSERT INTO event_specialty(event_id, name, code, display_order) VALUES($1,'Baile','BAILE',1) RETURNING id",
    [event.id],
  );
  const { rows: [rubric] } = await pool.query(
    "INSERT INTO rubric(event_id, name, code, evaluation_target) VALUES($1,'R','R','TROUPE') RETURNING id",
    [event.id],
  );
  await pool.query(
    "INSERT INTO evaluation_item(event_id, rubric_id, specialty_id, name, code) VALUES($1,$2,$3,'I','I')",
    [event.id, rubric.id, specialty.id],
  );
  return { event, night, entryA, entryB, specialty, rubric };
}

test("API schedule: reordena en CONFIGURING sin motivo y en OPEN con motivo auditado", { skip: !process.env.TEST_DATABASE_URL }, async (context) => {
  process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;
  await migrate();
  const pool = getPool();
  context.after(async () => {
    process.env.DATABASE_URL = originalDatabaseUrl;
    await closePool();
  });

  const adminId = randomUUID();
  await pool.query(`INSERT INTO "user"(id,name,email,"emailVerified") VALUES ($1,'Admin',$2,true)`, [adminId, `${adminId}@example.test`]);
  await pool.query("INSERT INTO user_role (user_id, role_code) VALUES ($1, 'ADMIN')", [adminId]);

  const configuring = await seedEvent(pool, "Reorden configuring");
  const opened = await seedEvent(pool, "Reorden abierto");

  const app = createApp({ getSession: async ({ headers }) => headers.get("x-test-session") === "admin" ? { user: { id: adminId, twoFactorEnabled: true } } : null });
  const server = await withServer(app);
  const baseUrl = `http://127.0.0.1:${server.address().port}`;
  try {
    const headers = { "Content-Type": "application/json", "x-test-session": "admin" };

    const openRes = await fetch(`${baseUrl}/api/v1/events/${opened.event.id}/open`, { method: "POST", headers });
    assert.equal(openRes.status, 200);

    const configuringRes = await fetch(`${baseUrl}/api/v1/events/${configuring.event.id}/schedule/reorder`, {
      method: "PATCH", headers,
      body: JSON.stringify({ nightId: configuring.night.id, orderedIds: [configuring.entryB.id, configuring.entryA.id] }),
    });
    assert.equal(configuringRes.status, 200);

    const noReason = await fetch(`${baseUrl}/api/v1/events/${opened.event.id}/schedule/reorder`, {
      method: "PATCH", headers,
      body: JSON.stringify({ nightId: opened.night.id, orderedIds: [opened.entryB.id, opened.entryA.id] }),
    });
    assert.equal(noReason.status, 422);
    assert.equal((await noReason.json()).code, "REORDER_REASON_REQUIRED");

    const openedRes = await fetch(`${baseUrl}/api/v1/events/${opened.event.id}/schedule/reorder`, {
      method: "PATCH", headers,
      body: JSON.stringify({ nightId: opened.night.id, orderedIds: [opened.entryB.id, opened.entryA.id], reason: "Intercambio acordado" }),
    });
    assert.equal(openedRes.status, 200);

    const { rows: order } = await pool.query(
      "SELECT id FROM night_troupe_schedule WHERE night_id=$1 ORDER BY presentation_order",
      [opened.night.id],
    );
    assert.deepEqual(order.map((row) => row.id), [opened.entryB.id, opened.entryA.id]);

    const { rows: audit } = await pool.query(
      "SELECT action, after_data AS after FROM audit_event WHERE action='NIGHT_TROUPE_SCHEDULE_REORDERED' AND (after_data->>'nightId' = $1)",
      [opened.night.id],
    );
    assert.equal(audit.length, 1);
    assert.equal(audit[0].after.reason, "Intercambio acordado");

    const conflict = await fetch(`${baseUrl}/api/v1/events/${opened.event.id}/schedule/reorder`, {
      method: "PATCH", headers,
      body: JSON.stringify({ nightId: opened.night.id, orderedIds: [opened.entryA.id], reason: "x" }),
    });
    assert.equal(conflict.status, 409);

    const missing = await fetch(`${baseUrl}/api/v1/events/${randomUUID()}/schedule/reorder`, {
      method: "PATCH", headers,
      body: JSON.stringify({ nightId: opened.night.id, orderedIds: [opened.entryA.id, opened.entryB.id], reason: "x" }),
    });
    assert.equal(missing.status, 404);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});

test("API schedule: reorden bloqueado cuando la jornada ya tiene ballots", { skip: !process.env.TEST_DATABASE_URL }, async (context) => {
  process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;
  await migrate();
  const pool = getPool();
  context.after(async () => {
    process.env.DATABASE_URL = originalDatabaseUrl;
    await closePool();
  });

  const adminId = randomUUID();
  await pool.query(`INSERT INTO "user"(id,name,email,"emailVerified") VALUES ($1,'Admin',$2,true)`, [adminId, `${adminId}@example.test`]);
  await pool.query("INSERT INTO user_role (user_id, role_code) VALUES ($1, 'ADMIN')", [adminId]);
  const judgeUserId = randomUUID();
  await pool.query(`INSERT INTO "user"(id,name,email,"emailVerified") VALUES ($1,'Juez',$2,true)`, [judgeUserId, `${judgeUserId}@example.test`]);
  const { rows: [profile] } = await pool.query(
    `INSERT INTO judge_profile(user_id, name, email, document_number, registration_status, created_by)
     VALUES ($1,'Juez',$2,$3,'REGISTERED',$4) RETURNING id`,
    [judgeUserId, `${judgeUserId}@example.test`, judgeUserId, adminId],
  );

  const seeded = await seedEvent(pool, "Reorden con votos");
  const { specialty } = seeded;
  await pool.query(
    "INSERT INTO judge_quota(event_id, night_id, specialty_id, max_assignments) VALUES($1,$2,$3,5)",
    [seeded.event.id, seeded.night.id, specialty.id],
  );
  const { rows: [assignment] } = await pool.query(
    "INSERT INTO judge_assignment(event_id, night_id, specialty_id, judge_profile_id) VALUES($1,$2,$3,$4) RETURNING id",
    [seeded.event.id, seeded.night.id, specialty.id, profile.id],
  );
  await pool.query(
    "INSERT INTO ballot(event_id, night_id, judge_assignment_id, judge_profile_id, specialty_id, status) VALUES($1,$2,$3,$4,$5,'OPEN')",
    [seeded.event.id, seeded.night.id, assignment.id, profile.id, specialty.id],
  );

  const app = createApp({ getSession: async ({ headers }) => headers.get("x-test-session") === "admin" ? { user: { id: adminId, twoFactorEnabled: true } } : null });
  const server = await withServer(app);
  try {
    const headers = { "Content-Type": "application/json", "x-test-session": "admin" };
    const openRes = await fetch(`http://127.0.0.1:${server.address().port}/api/v1/events/${seeded.event.id}/open`, { method: "POST", headers });
    assert.equal(openRes.status, 200);
    const blocked = await fetch(`http://127.0.0.1:${server.address().port}/api/v1/events/${seeded.event.id}/schedule/reorder`, {
      method: "PATCH", headers,
      body: JSON.stringify({ nightId: seeded.night.id, orderedIds: [seeded.entryB.id, seeded.entryA.id], reason: "Tarde" }),
    });
    assert.equal(blocked.status, 409);
    assert.equal((await blocked.json()).code, "NIGHT_VOTING_STARTED");
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});
