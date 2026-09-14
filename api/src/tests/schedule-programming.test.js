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

test("API schedule: programar y quitar comparsas de la jornada", {
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
  await pool.query(
    `INSERT INTO "user"(id, name, email, "emailVerified") VALUES ($1, 'Admin sched2', $2, true)`,
    [adminId, `${adminId}@example.test`],
  );
  await pool.query("INSERT INTO user_role (user_id, role_code) VALUES ($1, 'ADMIN')", [adminId]);

  const { rows: [event] } = await pool.query(
    "INSERT INTO carnival_event(name) VALUES($1) RETURNING id", ["Schedule Programming Event"],
  );
  const { rows: [night] } = await pool.query(
    "INSERT INTO night(event_id, name, display_order, kind, status) VALUES($1,$2,$3,$4,$5) RETURNING id",
    [event.id, "Noche 1", 1, "COMPETITION", "DRAFT"],
  );
  const { rows: [category] } = await pool.query(
    "INSERT INTO event_category(event_id, name, code, display_order) VALUES($1,$2,$3,$4) RETURNING id",
    [event.id, "Primera", "PRIMERA", 1],
  );
  const { rows: [troupeA] } = await pool.query(
    "INSERT INTO event_troupe(event_id, category_id, name) VALUES($1,$2,$3) RETURNING id",
    [event.id, category.id, "Comparsa A"],
  );
  const { rows: [troupeB] } = await pool.query(
    "INSERT INTO event_troupe(event_id, category_id, name) VALUES($1,$2,$3) RETURNING id",
    [event.id, category.id, "Comparsa B"],
  );

  const app = createApp({ getSession: async ({ headers }) => headers.get("x-test-session") === "admin" ? { user: { id: adminId, twoFactorEnabled: true } } : null });
  await withServer(app, async (baseUrl) => {
    const headers = { "content-type": "application/json", "x-test-session": "admin" };

    const addA = await fetch(`${baseUrl}/api/v1/events/${event.id}/schedule`, {
      method: "POST", headers,
      body: JSON.stringify({ nightId: night.id, troupeId: troupeA.id }),
    });
    assert.equal(addA.status, 201);
    const savedA = await addA.json();
    assert.equal(savedA.presentationOrder, 1);

    const addB = await fetch(`${baseUrl}/api/v1/events/${event.id}/schedule`, {
      method: "POST", headers,
      body: JSON.stringify({ nightId: night.id, troupeId: troupeB.id }),
    });
    assert.equal(addB.status, 201);
    assert.equal((await addB.json()).presentationOrder, 2);

    const duplicate = await fetch(`${baseUrl}/api/v1/events/${event.id}/schedule`, {
      method: "POST", headers,
      body: JSON.stringify({ nightId: night.id, troupeId: troupeA.id }),
    });
    assert.equal(duplicate.status, 409);
    assert.equal((await duplicate.json()).code, "SCHEDULE_CONFLICT");

    const scheduleId = savedA.id;
    const remove = await fetch(`${baseUrl}/api/v1/schedule/${scheduleId}`, { method: "DELETE", headers });
    assert.equal(remove.status, 200);

    const missing = await fetch(`${baseUrl}/api/v1/schedule/${scheduleId}`, { method: "DELETE", headers });
    assert.equal(missing.status, 404);

    const remaining = await pool.query("SELECT COUNT(*)::int AS n FROM night_troupe_schedule WHERE event_id=$1", [event.id]);
    assert.equal(remaining.rows[0].n, 1);
  });
});
