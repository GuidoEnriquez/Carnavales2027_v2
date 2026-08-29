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
    const invalidTroupe = await fetch(`${baseUrl}/api/v1/events/${event.id}/troupes`, { method: "POST", headers, body: JSON.stringify({ name: "Texto libre", category: "Primera" }) });
    assert.equal(invalidTroupe.status, 400);
    await fetch(`${baseUrl}/api/v1/categories/${category.id}`, { method: "PATCH", headers, body: JSON.stringify({ active: false }) });
    const eligible = await fetch(`${baseUrl}/api/v1/events/${event.id}/categories?eligible=true`, { headers });
    assert.deepEqual(await eligible.json(), []);
  });
});
