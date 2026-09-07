import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import { createApp } from "../app.js";
import { closePool, getPool } from "../db/pool.js";
import { migrate } from "../db/migrate.js";

async function withServer(app, run) {
  const server = await new Promise((resolve) => { const instance = app.listen(0, "127.0.0.1", () => resolve(instance)); });
  try { await run(`http://127.0.0.1:${server.address().port}`); } finally { await new Promise((resolve) => server.close(resolve)); }
}

test("API ADMIN administra categorías y participaciones sin texto libre", { skip: !process.env.TEST_DATABASE_URL }, async (context) => {
  const original = process.env.DATABASE_URL;
  context.after(async () => { await closePool(); if (original === undefined) delete process.env.DATABASE_URL; else process.env.DATABASE_URL = original; });
  process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;
  await migrate();
  const adminId = randomUUID();
  const pool = getPool();
  await pool.query(`INSERT INTO "user" (id, name, email, "emailVerified") VALUES ($1, 'Category admin', $2, true)`, [adminId, `${adminId}@example.test`]);
  await pool.query("INSERT INTO user_role (user_id, role_code) VALUES ($1, 'ADMIN')", [adminId]);
  const app = createApp({ getSession: async ({ headers }) => headers.get("x-test-session") === "admin" ? { user: { id: adminId, twoFactorEnabled: true } } : null });
  await withServer(app, async (baseUrl) => {
    const headers = { "content-type": "application/json", "x-test-session": "admin" };
    const eventResponse = await fetch(`${baseUrl}/api/v1/events`, { method: "POST", headers, body: JSON.stringify({ name: "Evento categorías API" }) });
    const event = await eventResponse.json();
    const categoryResponse = await fetch(`${baseUrl}/api/v1/events/${event.id}/categories`, { method: "POST", headers, body: JSON.stringify({ name: "Primera", code: "PRIMERA", displayOrder: 1 }) });
    assert.equal(categoryResponse.status, 201);
    const category = await categoryResponse.json();
    const troupeResponse = await fetch(`${baseUrl}/api/v1/events/${event.id}/troupes`, { method: "POST", headers, body: JSON.stringify({ name: "Comparsa API", categoryId: category.id }) });
    assert.equal(troupeResponse.status, 201);
    const troupe = await troupeResponse.json();
    const listedTroupes = await fetch(`${baseUrl}/api/v1/events/${event.id}/troupes`, { headers });
    assert.equal(listedTroupes.status, 200);
    assert.equal((await listedTroupes.json()).length, 1);
    const updatedTroupe = await fetch(`${baseUrl}/api/v1/troupes/${troupe.id}`, {
      method: "PATCH",
      headers,
      body: JSON.stringify({ name: "Comparsa editada", categoryId: category.id, active: false }),
    });
    assert.equal(updatedTroupe.status, 200);
    assert.equal((await updatedTroupe.json()).active, false);
    const invalidTroupe = await fetch(`${baseUrl}/api/v1/events/${event.id}/troupes`, { method: "POST", headers, body: JSON.stringify({ name: "Texto libre", category: "Primera" }) });
    assert.equal(invalidTroupe.status, 400);
    const updatedCategory = await fetch(`${baseUrl}/api/v1/categories/${category.id}`, {
      method: "PATCH",
      headers,
      body: JSON.stringify({ name: "Primera editada", code: "PRIMERA_EDITADA", displayOrder: 2, active: false }),
    });
    assert.equal(updatedCategory.status, 200);
    assert.equal((await updatedCategory.json()).name, "Primera editada");
    const generatedCategoryResponse = await fetch(`${baseUrl}/api/v1/events/${event.id}/categories`, {
      method: "POST",
      headers,
      body: JSON.stringify({ name: "Categoría juvenil", displayOrder: 3 }),
    });
    assert.equal(generatedCategoryResponse.status, 201);
    assert.equal((await generatedCategoryResponse.json()).code, "CATEGORIA_JUVENIL");
    const deactivateWithInactiveCategory = await fetch(`${baseUrl}/api/v1/troupes/${troupe.id}`, {
      method: "PATCH",
      headers,
      body: JSON.stringify({ active: false }),
    });
    assert.equal(deactivateWithInactiveCategory.status, 200);
    const reactivateWithInactiveCategory = await fetch(`${baseUrl}/api/v1/troupes/${troupe.id}`, {
      method: "PATCH",
      headers,
      body: JSON.stringify({ active: true }),
    });
    assert.equal(reactivateWithInactiveCategory.status, 409);
    assert.deepEqual(await reactivateWithInactiveCategory.json(), { code: "CATEGORY_INACTIVE" });
    const eligible = await fetch(`${baseUrl}/api/v1/events/${event.id}/categories?eligible=true`, { headers });
    assert.deepEqual((await eligible.json()).map(({ code }) => code), ["CATEGORIA_JUVENIL"]);

    const duplicate = await fetch(`${baseUrl}/api/v1/events/${event.id}/categories`, {
      method: "POST",
      headers,
      body: JSON.stringify({ name: "Duplicada", code: "PRIMERA_EDITADA", displayOrder: 4 }),
    });
    assert.equal(duplicate.status, 409);
    assert.equal((await duplicate.json()).code, "RESOURCE_CONFLICT");

    const missingEvent = await fetch(`${baseUrl}/api/v1/events/${randomUUID()}/categories`, { headers });
    assert.equal(missingEvent.status, 404);
    assert.deepEqual(await missingEvent.json(), { code: "EVENT_NOT_FOUND" });

    const malformed = await fetch(`${baseUrl}/api/v1/events`, { method: "POST", headers, body: "{" });
    assert.equal(malformed.status, 400);
    assert.deepEqual(await malformed.json(), { code: "VALIDATION_ERROR" });
  });
});
