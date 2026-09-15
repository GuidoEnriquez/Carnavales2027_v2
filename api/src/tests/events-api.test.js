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
      body: JSON.stringify({ name: "Premios", kind: "AWARDS", eventDate: "2027-02-12" }),
    });
    assert.equal(createNight.status, 201);
    const firstNight = await createNight.json();
    assert.equal(firstNight.displayOrder, 1);

    const createCompetitionNight = await fetch(`${baseUrl}/api/v1/events/${event.id}/nights`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-test-session": "admin" },
      body: JSON.stringify({ name: "Noche", kind: "COMPETITION", eventDate: "2027-02-06" }),
    });
    assert.equal(createCompetitionNight.status, 201);
    const secondNight = await createCompetitionNight.json();
    assert.equal(secondNight.displayOrder, 1, "crear una noche mas temprana la coloca primera");

    const duplicateDate = await fetch(`${baseUrl}/api/v1/events/${event.id}/nights`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-test-session": "admin" },
      body: JSON.stringify({ name: "Duplicada", kind: "COMPETITION", eventDate: "2027-02-06" }),
    });
    assert.equal(duplicateDate.status, 409);
    assert.deepEqual(await duplicateDate.json(), { code: "NIGHT_DATE_DUPLICATE" });

    const missingDate = await fetch(`${baseUrl}/api/v1/events/${event.id}/nights`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-test-session": "admin" },
      body: JSON.stringify({ name: "Sin fecha", kind: "COMPETITION" }),
    });
    assert.equal(missingDate.status, 400);
    assert.deepEqual(await missingDate.json(), { code: "NIGHT_DATE_REQUIRED" });

    const updateNight = await fetch(`${baseUrl}/api/v1/nights/${secondNight.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json", "x-test-session": "admin" },
      body: JSON.stringify({ name: "Noche", kind: "COMPETITION", eventDate: "2027-02-20" }),
    });
    assert.equal(updateNight.status, 200);
    assert.equal((await updateNight.json()).displayOrder, 2, "retrasar la fecha reordena el conjunto");

    const getEvent = await fetch(`${baseUrl}/api/v1/events/${event.id}`, {
      headers: { "x-test-session": "admin" },
    });
    assert.equal(getEvent.status, 200);
    assert.equal((await getEvent.json()).id, event.id);
    const listNights = await fetch(`${baseUrl}/api/v1/events/${event.id}/nights`, {
      headers: { "x-test-session": "admin" },
    });
    assert.equal(listNights.status, 200);
    const storedNights = await listNights.json();
    assert.equal(storedNights.length, 2);
    assert.deepEqual(storedNights.map(({ id }) => id), [firstNight.id, secondNight.id]);

    const updateEvent = await fetch(`${baseUrl}/api/v1/events/${event.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json", "x-test-session": "admin" },
      body: JSON.stringify({ name: "Carnavales API editado" }),
    });
    assert.equal(updateEvent.status, 200);

    await pool.query("UPDATE night SET kind='COMPETITION' WHERE event_id=$1", [event.id]);
    const { rows: categories } = await pool.query(
      "INSERT INTO event_category(event_id,name,code,display_order) VALUES($1,'Categoría','CAT_API',1) RETURNING id",
      [event.id],
    );
    await pool.query("INSERT INTO event_troupe(event_id,category_id,name) VALUES($1,$2,'Comparsa')", [event.id, categories[0].id]);
    const { rows: specialties } = await pool.query(
      "INSERT INTO event_specialty(event_id,name,code,display_order) VALUES($1,'Baile','BAILE_API',1) RETURNING id",
      [event.id],
    );
    const { rows: rubrics } = await pool.query(
      "INSERT INTO rubric(event_id,name,code,evaluation_target) VALUES($1,'Rubro','RUBRO_API','TROUPE') RETURNING id",
      [event.id],
    );
    await pool.query(
      "INSERT INTO evaluation_item(event_id,rubric_id,specialty_id,name,code) VALUES($1,$2,$3,'Ítem','ITEM_API')",
      [event.id, rubrics[0].id, specialties[0].id],
    );
    const openEvent = await fetch(`${baseUrl}/api/v1/events/${event.id}/open`, {
      method: "POST",
      headers: { "x-test-session": "admin" },
    });
    assert.equal(openEvent.status, 200);
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
