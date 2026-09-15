import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { after, before, test } from "node:test";
import { createApp } from "../app.js";
import { migrate } from "../db/migrate.js";
import { closePool, getPool } from "../db/pool.js";
import { openEvent } from "../modules/events/event-readiness.service.js";

const enabled = Boolean(process.env.TEST_DATABASE_URL);
let pool, server, base, adminId;
before(async () => {
  if (!enabled) return;
  process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;
  await migrate();
  pool = getPool();
  adminId = randomUUID();
  const judgeId = randomUUID();
  for (const [id, role] of [[adminId, "ADMIN"], [judgeId, "JUDGE"]]) {
    await pool.query('INSERT INTO "user"(id,name,email,"emailVerified") VALUES($1,$2,$3,true)', [id, role, `${id}@example.test`]);
    await pool.query("INSERT INTO user_role(user_id,role_code) VALUES($1,$2)", [id, role]);
  }
  const app = createApp({ getSession: async ({ headers }) => {
    const session = headers.get("x-test-session");
    if (!["admin", "primary", "judge"].includes(session)) return null;
    return { user: { id: session === "judge" ? judgeId : adminId, twoFactorEnabled: session !== "primary" } };
  } });
  server = await new Promise((resolve) => { const instance = app.listen(0, "127.0.0.1", () => resolve(instance)); });
  base = `http://127.0.0.1:${server.address().port}/api/v1`;
});
after(async () => {
  if (server) await new Promise((resolve) => server.close(resolve));
  await closePool();
});

async function request(path, body, { session = "admin", method = "POST" } = {}) {
  const response = await fetch(`${base}${path}`, {
    method, headers: { "content-type": "application/json", "x-test-session": session },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return { status: response.status, body: await response.json() };
}

async function newEvent(name = "Orden") {
  const result = await request("/events", { name });
  assert.equal(result.status, 201);
  return result.body;
}

function movement(first, second, direction = "DOWN") {
  return { direction, neighborId: second.id, expectedOrder: first.displayOrder, expectedNeighborOrder: second.displayOrder };
}

test("Tipo de participacion recibe orden automatico, conserva huecos y rechaza orden manual conflictivo", { skip: !enabled }, async () => {
  const event = await newEvent("Categorias orden");
  const create = async (name) => await request(`/events/${event.id}/categories`, { name });
  const first = await create("Primera");
  const second = await create("Segunda");
  const third = await create("Tercera");
  assert.deepEqual([first, second, third].map((r) => r.status), [201, 201, 201]);
  assert.deepEqual([first, second, third].map((r) => r.body.displayOrder), [1, 2, 3]);

  // displayOrder en el body de creacion es ignorado (no usa logica duplicada).
  const ignoredOrder = await request(`/events/${event.id}/categories`, { name: "Ignorada", displayOrder: 99 });
  assert.equal(ignoredOrder.status, 201);
  assert.equal(ignoredOrder.body.displayOrder, 4);

  // Desactivacion preserva el hueco del orden 2.
  const deactivated = await request(`/categories/${second.body.id}`, { active: false }, { method: "PATCH" });
  assert.equal(deactivated.status, 200);
  assert.equal(deactivated.body.displayOrder, 2);
  const later = await request(`/events/${event.id}/categories`, { name: "Tardía" });
  assert.equal(later.status, 201);
  assert.equal(later.body.displayOrder, 5);

  // El listado muestra el hueco sin renumerar y el PATCH ignora displayOrder.
  const list = (await request(`/events/${event.id}/categories`, undefined, { method: "GET" })).body;
  assert.deepEqual(list.map((row) => row.displayOrder), [1, 2, 3, 4, 5]);
  const patchWithOrder = await request(`/categories/${third.body.id}`, { name: "Tercera editada", displayOrder: 88 }, { method: "PATCH" });
  assert.equal(patchWithOrder.status, 200);
  assert.equal(patchWithOrder.body.displayOrder, 3);
  assert.equal(patchWithOrder.body.name, "Tercera editada");
  assert.deepEqual((await request(`/events/${event.id}/categories`, undefined, { method: "GET" })).body.map((row) => row.displayOrder), [1, 2, 3, 4, 5]);
});

test("Especialidades reciben orden automatico por evento e ignoran displayOrder en PATCH", { skip: !enabled }, async () => {
  const event = await newEvent("Especialidades orden");
  const one = await request(`/events/${event.id}/specialties`, { name: "Baile" });
  const two = await request(`/events/${event.id}/specialties`, { name: "Comparsa" });
  assert.deepEqual([one, two].map((r) => r.status), [201, 201]);
  assert.deepEqual([one, two].map((r) => r.body.displayOrder), [1, 2]);
  const other = await newEvent("Especialidades orden B");
  const otherSpecialty = await request(`/events/${other.id}/specialties`, { name: "Sola" });
  assert.equal(otherSpecialty.body.displayOrder, 1);
  const patched = await request(`/specialties/${two.body.id}`, { displayOrder: 9, name: "Comparsa editada" }, { method: "PATCH" });
  assert.equal(patched.status, 200);
  assert.equal(patched.body.displayOrder, 2);
  assert.equal(patched.body.name, "Comparsa editada");
});

test("dos altas concurrentes de categorias se serializan y no duplican posiciones", { skip: !enabled }, async () => {
  const event = await newEvent("Categorias concurrentes");
  const results = await Promise.all([
    request(`/events/${event.id}/categories`, { name: "A" }),
    request(`/events/${event.id}/categories`, { name: "B" }),
  ]);
  assert.deepEqual(results.map((r) => r.status), [201, 201]);
  assert.deepEqual(results.map((r) => r.body.displayOrder).sort((a, b) => a - b), [1, 2]);
});

async function reorderFixture() {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const { rows: [event] } = await client.query("INSERT INTO carnival_event(name) VALUES('Reorder flat') RETURNING id");
    const categories = [];
    const specialties = [];
    for (const displayOrder of [1, 2, 3]) {
      const { rows: [category] } = await client.query("INSERT INTO event_category(event_id,name,code,display_order) VALUES($1,$2,$3,$4) RETURNING id, display_order AS \"displayOrder\"", [event.id, `C${displayOrder}`, `C${displayOrder}`, displayOrder]);
      categories.push(category);
    }
    for (const displayOrder of [1, 2, 3]) {
      const { rows: [specialty] } = await client.query("INSERT INTO event_specialty(event_id,name,code,display_order) VALUES($1,$2,$3,$4) RETURNING id, display_order AS \"displayOrder\"", [event.id, `S${displayOrder}`, `S${displayOrder}`, displayOrder]);
      specialties.push(specialty);
    }
    await client.query("INSERT INTO event_troupe(event_id,category_id,name) VALUES($1,$2,'T')", [event.id, categories[0].id]);
    const { rows: [activeSpecialty] } = await client.query("SELECT id FROM event_specialty WHERE id=$1", [specialties[0].id]);
    await client.query("INSERT INTO night(event_id,name,display_order,kind) VALUES($1,'N',1,'COMPETITION')", [event.id]);
    const { rows: [rubric] } = await client.query("INSERT INTO rubric(event_id,name,code,evaluation_target) VALUES($1,'R','R','TROUPE') RETURNING id", [event.id]);
    await client.query("INSERT INTO evaluation_item(event_id,rubric_id,specialty_id,name,code,display_order) VALUES($1,$2,$3,'I','I',1)", [event.id, rubric.id, activeSpecialty.id]);
    await client.query("COMMIT");
    return { event, categories, specialties };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally { client.release(); }
}

async function flatSnapshot(table, event) {
  const { rows } = await pool.query(`SELECT id, display_order AS "displayOrder" FROM ${table} WHERE event_id=$1 ORDER BY display_order`, [event.id]);
  return rows.map((row) => ({ id: row.id, displayOrder: row.displayOrder }));
}

for (const [entity, table, prefix, notFound] of [["category", "event_category", "/categories", "CATEGORY_NOT_FOUND"], ["specialty", "event_specialty", "/specialties", "SPECIALTY_NOT_FOUND"]]) {
  const actionLabel = entity === "category" ? "CATEGORY" : "SPECIALTY";

  test(`${entity} reorder: auth, validation, adjacency, atomic audit y máxima profundidad`, { skip: !enabled }, async () => {
    const f = await reorderFixture();
    const [first, second, third] = f[entity === "category" ? "categories" : "specialties"];
    const path = `${prefix}/${first.id}/reorder`;
    const body = movement(first, second);
    const before = await flatSnapshot(table, f.event);

    for (const [session, status, code] of [["none", 401, "UNAUTHENTICATED"], ["primary", 403, "TWO_FACTOR_REQUIRED"], ["judge", 403, "ADMIN_REQUIRED"]]) {
      const result = await request(path, body, { session });
      assert.equal(result.status, status);
      assert.equal(result.body.code, code);
    }
    for (const invalid of [null, {}, [], { ...body, direction: "LEFT" }, { ...body, neighborId: "invalid" }, { ...body, neighborId: first.id }, { ...body, expectedOrder: "2" }, { ...body, expectedOrder: 0 }, { ...body, expectedNeighborOrder: 1.5 }, { ...body, expectedNeighborOrder: 2147483648 }]) {
      assert.equal((await request(path, invalid)).status, 400);
    }
    assert.equal((await request(`${prefix}/invalid/reorder`, body)).status, 400);
    const missing = await request(`${prefix}/${randomUUID()}/reorder`, body);
    assert.equal(missing.status, 404);
    assert.equal(missing.body.code, notFound);
    assert.equal((await request(path, { ...body, neighborId: randomUUID() })).status, 404);
    assert.deepEqual(await request(path, movement(first, third)), { status: 409, body: { code: "ORDER_CONFLICT" } });
    assert.deepEqual(await request(path, movement(first, second, "UP")), { status: 409, body: { code: "ORDER_BOUNDARY" } });
    assert.deepEqual(await request(`${prefix}/${third.id}/reorder`, movement(third, second)), { status: 409, body: { code: "ORDER_BOUNDARY" } });
    const other = await reorderFixture();
    const otherRow = other[entity === "category" ? "categories" : "specialties"][0];
    assert.deepEqual(await request(path, movement(first, otherRow)), { status: 409, body: { code: "ORDER_CONFLICT" } });
    assert.deepEqual(await flatSnapshot(table, f.event), before);

    const result = await request(path, { ...body, [entity === "category" ? "categoryId" : "specialtyId"]: third.id, client: {}, actorUserId: "not-the-admin" });
    const changes = [{ id: first.id, displayOrder: second.displayOrder }, { id: second.id, displayOrder: first.displayOrder }];
    assert.deepEqual(result, { status: 200, body: { changes } });
    const after = await flatSnapshot(table, f.event);
    for (const change of changes) assert.deepEqual(after.find((row) => row.id === change.id), change);
    assert.equal(after.find((row) => row.id === third.id).displayOrder, 3);
    const { rows: auditRows } = await pool.query(
      `SELECT action, actor_user_id AS "actorUserId", entity_id AS "entityId", before_data AS before, after_data AS after
         FROM audit_event WHERE action=$1 AND after_data->>'eventId'=$2`,
      [`${actionLabel}_REORDERED`, f.event.id],
    );
    assert.equal(auditRows.length, 1);
    assert.equal(auditRows[0].actorUserId, adminId);
    assert.equal(auditRows[0].entityId, first.id);
    const context = { eventId: f.event.id, direction: "DOWN" };
    assert.deepEqual(auditRows[0].before, { ...context, changes: [{ id: first.id, displayOrder: first.displayOrder }, { id: second.id, displayOrder: second.displayOrder }] });
    assert.deepEqual(auditRows[0].after, { ...context, changes });
    assert.deepEqual(await request(path, body), { status: 409, body: { code: "ORDER_CONFLICT" } });
    assert.equal((await request(path, { ...body, direction: "UP", expectedOrder: second.displayOrder, expectedNeighborOrder: first.displayOrder })).status, 200);
  });

  test(`${entity} reorder concurrente serializa y rechaza stale sin segunda auditoria`, { skip: !enabled }, async () => {
    const f = await reorderFixture();
    const [first, second] = f[entity === "category" ? "categories" : "specialties"];
    const prefix = entity === "category" ? "/categories" : "/specialties";
    const results = await Promise.all([
      request(`${prefix}/${first.id}/reorder`, movement(first, second)),
      request(`${prefix}/${second.id}/reorder`, movement(second, first, "UP")),
    ]);
    assert.deepEqual(results.map((r) => r.status).sort(), [200, 409]);
    assert.equal(results.find((r) => r.status === 409).body.code, "ORDER_CONFLICT");
    const { rows } = await pool.query("SELECT 1 FROM audit_event WHERE action=$1 AND after_data->>'eventId'=$2", [`${actionLabel}_REORDERED`, f.event.id]);
    assert.equal(rows.length, 1);
  });
}

test("reorder de categorias y especialidades queda bloqueado cuando el evento pasa a OPEN", { skip: !enabled }, async () => {
  const f = await reorderFixture();
  const opened = await openEvent({ eventId: f.event.id, actorUserId: adminId });
  assert.equal(opened.status, "OPEN");
  const categoryBody = movement(f.categories[1], f.categories[2], "UP");
  const specialtyBody = movement(f.specialties[1], f.specialties[2], "UP");
  const result = await request(`/categories/${f.categories[1].id}/reorder`, categoryBody);
  assert.deepEqual(result, { status: 409, body: { code: "EVENT_LOCKED" } });
  assert.deepEqual(await request(`/specialties/${f.specialties[1].id}/reorder`, specialtyBody), { status: 409, body: { code: "EVENT_LOCKED" } });
  assert.equal((await request(`/events/${f.event.id}/categories`, { name: "Nueva" })).status, 409);
  assert.equal((await request(`/events/${f.event.id}/specialties`, { name: "Nueva" })).status, 409);
});