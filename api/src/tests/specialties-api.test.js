import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import { createApp } from "../app.js";
import { closePool, getPool } from "../db/pool.js";
import { migrate } from "../db/migrate.js";

test("API ADMIN mantiene especialidades independientes por evento sin defaults globales", { skip: !process.env.TEST_DATABASE_URL }, async (context) => {
  const original = process.env.DATABASE_URL;
  context.after(async () => { await closePool(); if (original === undefined) delete process.env.DATABASE_URL; else process.env.DATABASE_URL = original; });
  process.env.DATABASE_URL = process.env.TEST_DATABASE_URL; await migrate();
  const adminId = randomUUID(); const pool = getPool();
  await pool.query(`INSERT INTO "user" (id,name,email,"emailVerified") VALUES ($1,'Specialty admin',$2,true)`, [adminId, `${adminId}@example.test`]);
  await pool.query("INSERT INTO user_role (user_id,role_code) VALUES ($1,'ADMIN')", [adminId]);
  const app = createApp({ getSession: async ({ headers }) => headers.get("x-test-session") === "admin" ? { user: { id: adminId, twoFactorEnabled: true } } : null });
  const server = await new Promise((resolve) => { const instance = app.listen(0, "127.0.0.1", () => resolve(instance)); });
  try {
    const base = `http://127.0.0.1:${server.address().port}`; const headers = { "content-type": "application/json", "x-test-session": "admin" };
    const createEvent = async (name) => (await fetch(`${base}/api/v1/events`, { method: "POST", headers, body: JSON.stringify({ name }) })).json();
    const eventA = await createEvent("Especialidades A"); const eventB = await createEvent("Especialidades B");
    const specialty = await fetch(`${base}/api/v1/events/${eventA.id}/specialties`, { method: "POST", headers, body: JSON.stringify({ name: "Especialidad propia", code: "PROPIA", displayOrder: 1 }) });
    assert.equal(specialty.status, 201);
    const createdSpecialty = await specialty.json();
    const edited = await fetch(`${base}/api/v1/specialties/${createdSpecialty.id}`, {
      method: "PATCH",
      headers,
      body: JSON.stringify({ name: "Baile editado", code: "BAILE_EDITADO", displayOrder: 2, active: false }),
    });
    assert.equal(edited.status, 200);
    assert.deepEqual(await edited.json(), {
      ...createdSpecialty,
      name: "Baile editado",
      code: "BAILE_EDITADO",
      displayOrder: 2,
      active: false,
    });
    const partiallyEdited = await fetch(`${base}/api/v1/specialties/${createdSpecialty.id}`, {
      method: "PATCH",
      headers,
      body: JSON.stringify({ active: true }),
    });
    assert.equal(partiallyEdited.status, 200);
    assert.deepEqual(await partiallyEdited.json(), {
      ...createdSpecialty,
      name: "Baile editado",
      code: "BAILE_EDITADO",
      displayOrder: 2,
      active: true,
    });
    const listA = await fetch(`${base}/api/v1/events/${eventA.id}/specialties`, { headers });
    const listB = await fetch(`${base}/api/v1/events/${eventB.id}/specialties`, { headers });
    assert.equal((await listA.json()).length, 1); assert.deepEqual(await listB.json(), []);
  } finally { await new Promise((resolve) => server.close(resolve)); }
});
