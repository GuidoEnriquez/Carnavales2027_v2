import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import { createApp } from "../app.js";
import { closePool, getPool } from "../db/pool.js";
import { migrate } from "../db/migrate.js";

const originalDatabaseUrl = process.env.DATABASE_URL;

function restoreDatabaseUrl() {
  if (originalDatabaseUrl === undefined) {
    delete process.env.DATABASE_URL;
    return;
  }
  process.env.DATABASE_URL = originalDatabaseUrl;
}

async function withServer(app, run) {
  const server = await new Promise((resolve) => {
    const instance = app.listen(0, "127.0.0.1", () => resolve(instance));
  });
  try {
    const address = server.address();
    await run(`http://127.0.0.1:${address.port}`);
  } finally {
    await new Promise((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
  }
}

test("la API ADMIN gestiona eventos y jornadas, y bloquea eventos OPEN", {
  skip: !process.env.TEST_DATABASE_URL,
}, async (context) => {
  context.after(async () => {
    await closePool();
    restoreDatabaseUrl();
  });
  process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;
  await migrate();

  const adminId = randomUUID();
  const pool = getPool();
  await pool.query(
    `INSERT INTO "user" (id, name, email, "emailVerified") VALUES ($1, $2, $3, true)`,
    [adminId, "Events admin", `${adminId}@example.test`],
  );
  await pool.query("INSERT INTO user_role (user_id, role_code) VALUES ($1, 'ADMIN')", [adminId]);
  const app = createApp({
    getSession: async ({ headers }) => headers.get("x-test-session") === "admin"
      ? { user: { id: adminId, email: `${adminId}@example.test`, name: "Events admin", twoFactorEnabled: true } }
      : null,
  });

  await withServer(app, async (baseUrl) => {
    const anonymous = await fetch(`${baseUrl}/api/v1/events`);
    assert.equal(anonymous.status, 401);

    const createEvent = await fetch(`${baseUrl}/api/v1/events`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-test-session": "admin" },
      body: JSON.stringify({ name: "Carnavales API" }),
    });
    assert.equal(createEvent.status, 201);
    const event = await createEvent.json();
    assert.equal(event.status, "CONFIGURING");

    const createNight = await fetch(`${baseUrl}/api/v1/events/${event.id}/nights`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-test-session": "admin" },
      body: JSON.stringify({ name: "Premios", displayOrder: 1, kind: "AWARDS" }),
    });
    assert.equal(createNight.status, 201);

    const getEvent = await fetch(`${baseUrl}/api/v1/events/${event.id}`, {
      headers: { "x-test-session": "admin" },
    });
    assert.equal(getEvent.status, 200);
    assert.equal((await getEvent.json()).id, event.id);
    const listNights = await fetch(`${baseUrl}/api/v1/events/${event.id}/nights`, {
      headers: { "x-test-session": "admin" },
    });
    assert.equal(listNights.status, 200);
    assert.equal((await listNights.json()).length, 1);

    const updateEvent = await fetch(`${baseUrl}/api/v1/events/${event.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json", "x-test-session": "admin" },
      body: JSON.stringify({ name: "Carnavales API editado" }),
    });
    assert.equal(updateEvent.status, 200);

    await pool.query("UPDATE carnival_event SET status = 'OPEN' WHERE id = $1", [event.id]);
    const lockedUpdate = await fetch(`${baseUrl}/api/v1/events/${event.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json", "x-test-session": "admin" },
      body: JSON.stringify({ name: "No permitido" }),
    });
    assert.equal(lockedUpdate.status, 409);
    assert.deepEqual(await lockedUpdate.json(), { code: "EVENT_LOCKED" });

    const { rows: auditRows } = await pool.query(
      "SELECT action FROM audit_event WHERE entity_type IN ('carnival_event', 'night') AND entity_id = $1",
      [event.id],
    );
    assert.ok(auditRows.some((row) => row.action === "EVENT_CREATED"));
  });
});
