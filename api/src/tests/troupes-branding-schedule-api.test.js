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

test("Spec 017 T09a/T09b: brandColor de comparsa y orden de pasada por jornada", { skip: !process.env.TEST_DATABASE_URL }, async (context) => {
  const original = process.env.DATABASE_URL;
  context.after(async () => { await closePool(); if (original === undefined) delete process.env.DATABASE_URL; else process.env.DATABASE_URL = original; });
  process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;
  await migrate();
  const adminId = randomUUID();
  const judgeId = randomUUID();
  const pool = getPool();
  for (const [id, role] of [[adminId, "ADMIN"], [judgeId, "JUDGE"]]) {
    await pool.query(`INSERT INTO "user" (id, name, email, "emailVerified") VALUES ($1, $2, $3, true)`, [id, role, `${id}@example.test`]);
    await pool.query("INSERT INTO user_role (user_id, role_code) VALUES ($1, $2)", [id, role]);
  }
  const app = createApp({ getSession: async ({ headers }) => {
    const session = headers.get("x-test-session");
    if (session === "admin") return { user: { id: adminId, twoFactorEnabled: true } };
    if (session === "judge") return { user: { id: judgeId, twoFactorEnabled: true } };
    if (session === "primary") return { user: { id: adminId, twoFactorEnabled: false } };
    return null;
  } });
  await withServer(app, async (baseUrl) => {
    const admin = { "content-type": "application/json", "x-test-session": "admin" };
    const post = async (path, body, headers = admin) => {
      const response = await fetch(`${baseUrl}${path}`, { method: "POST", headers, body: JSON.stringify(body) });
      return { status: response.status, body: await response.json() };
    };
    const patch = async (path, body) => {
      const response = await fetch(`${baseUrl}${path}`, { method: "PATCH", headers: admin, body: JSON.stringify(body) });
      return { status: response.status, body: await response.json() };
    };

    const event = (await post("/api/v1/events", { name: "Evento comparsas T09" })).body;
    const category = (await post(`/api/v1/events/${event.id}/categories`, { name: "Comparsa", displayOrder: 1 })).body;
    const night = (await post(`/api/v1/events/${event.id}/nights`, { name: "Noche 1", displayOrder: 1, kind: "COMPETITION" })).body;

    // ---- T09a: brandColor ----
    const colored = await post(`/api/v1/events/${event.id}/troupes`, { name: "Ara Bera", categoryId: category.id, brandColor: "#3B82F6" });
    assert.equal(colored.status, 201);
    assert.equal(colored.body.brandColor, "#3B82F6");

    const plain = await post(`/api/v1/events/${event.id}/troupes`, { name: "Sin color", categoryId: category.id });
    assert.equal(plain.status, 201);
    assert.equal(plain.body.brandColor, null);

    for (const invalid of ["red", "#FFF", "#GGGGGG", "3B82F6", 123]) {
      const result = await post(`/api/v1/events/${event.id}/troupes`, { name: `Mala ${String(invalid)}`, categoryId: category.id, brandColor: invalid });
      assert.equal(result.status, 400, `color invalido ${String(invalid)} debe dar 400`);
    }

    const updated = await patch(`/api/v1/troupes/${plain.body.id}`, { brandColor: "#22C55E" });
    assert.equal(updated.status, 200);
    assert.equal(updated.body.brandColor, "#22C55E");

    const cleared = await patch(`/api/v1/troupes/${plain.body.id}`, { brandColor: "" });
    assert.equal(cleared.status, 200);
    assert.equal(cleared.body.brandColor, null);

    const preserved = await patch(`/api/v1/troupes/${colored.body.id}`, { name: "Ara Bera editada" });
    assert.equal(preserved.status, 200);
    assert.equal(preserved.body.brandColor, "#3B82F6");

    const badPatch = await patch(`/api/v1/troupes/${colored.body.id}`, { brandColor: "azul" });
    assert.equal(badPatch.status, 400);

    const listed = await (await fetch(`${baseUrl}/api/v1/events/${event.id}/troupes`, { headers: admin })).json();
    assert.ok(listed.find((t) => t.id === colored.body.id && t.brandColor === "#3B82F6"));

    // Tercera comparsa para el schedule (tres filas: orden 1, 2, 3).
    const third = await post(`/api/v1/events/${event.id}/troupes`, { name: "Tercera", categoryId: category.id, brandColor: "#F59E0B" });
    assert.equal(third.status, 201);

    // ---- T09b: schedule ----
    for (const [troupeId, presentationOrder] of [[colored.body.id, 1], [plain.body.id, 2], [third.body.id, 3]]) {
      await pool.query(
        "INSERT INTO night_troupe_schedule(event_id, night_id, event_troupe_id, presentation_order) VALUES($1,$2,$3,$4)",
        [event.id, night.id, troupeId, presentationOrder],
      );
    }
    const scheduleResponse = await fetch(`${baseUrl}/api/v1/events/${event.id}/schedule?nightId=${night.id}`, { headers: admin });
    assert.equal(scheduleResponse.status, 200);
    const schedule = await scheduleResponse.json();
    assert.deepEqual(schedule.map((s) => s.presentationOrder), [1, 2, 3]);
    assert.equal(schedule[0].troupeBrandColor, "#3B82F6");

    const allNights = await (await fetch(`${baseUrl}/api/v1/events/${event.id}/schedule`, { headers: admin })).json();
    assert.equal(allNights.length, 3);

    // Auth: sin sesion 401, sin 2FA 403, juez 403.
    const moveBody = { direction: "DOWN", neighborId: schedule[1].id, expectedOrder: 1, expectedNeighborOrder: 2 };
    const unauth = await post(`/api/v1/schedule/${schedule[0].id}/reorder`, moveBody, { "content-type": "application/json" });
    assert.equal(unauth.status, 401);
    const no2fa = await post(`/api/v1/schedule/${schedule[0].id}/reorder`, moveBody, { "content-type": "application/json", "x-test-session": "primary" });
    assert.equal(no2fa.status, 403);
    const judge = await post(`/api/v1/schedule/${schedule[0].id}/reorder`, moveBody, { "content-type": "application/json", "x-test-session": "judge" });
    assert.equal(judge.status, 403);

    // Validacion.
    for (const invalid of [null, {}, { ...moveBody, direction: "LEFT" }, { ...moveBody, neighborId: "x" }, { ...moveBody, expectedOrder: 0 }]) {
      assert.equal((await post(`/api/v1/schedule/${schedule[0].id}/reorder`, invalid)).status, 400);
    }

    // Reorder real DOWN: 1 <-> 2.
    const moved = await post(`/api/v1/schedule/${schedule[0].id}/reorder`, moveBody);
    assert.equal(moved.status, 200);
    assert.deepEqual(moved.body.changes, [
      { id: schedule[0].id, presentationOrder: 2 },
      { id: schedule[1].id, presentationOrder: 1 },
    ]);
    const after = await (await fetch(`${baseUrl}/api/v1/events/${event.id}/schedule?nightId=${night.id}`, { headers: admin })).json();
    assert.deepEqual(after.map((s) => s.presentationOrder), [1, 2, 3]);
    assert.equal(after[0].troupeId, plain.body.id);
    assert.equal(after[1].troupeId, colored.body.id);

    // Replay obsoleto -> 409 ORDER_CONFLICT.
    const stale = await post(`/api/v1/schedule/${schedule[0].id}/reorder`, moveBody);
    assert.equal(stale.status, 409);
    assert.equal(stale.body.code, "ORDER_CONFLICT");

    // Borde: la ultima no puede bajar.
    const last = after[2];
    const before = after[1];
    const boundary = await post(`/api/v1/schedule/${last.id}/reorder`, {
      direction: "DOWN", neighborId: before.id, expectedOrder: 3, expectedNeighborOrder: 2,
    });
    assert.equal(boundary.status, 409);
    assert.equal(boundary.body.code, "ORDER_BOUNDARY");

    // Evento OPEN bloquea (se completa la configuracion minima exigida por el trigger).
    const specialty = (await post(`/api/v1/events/${event.id}/specialties`, { name: "Danza", displayOrder: 1 })).body;
    assert.equal(specialty.code, "DANZA");
    const rubric = (await post(`/api/v1/events/${event.id}/rubrics`, { name: "Coreografia", code: "COREO", evaluationTarget: "TROUPE" })).body;
    const rubricItem = await post(`/api/v1/rubrics/${rubric.id}/items`, { name: "Interpretacion", code: "INTERP", specialtyId: specialty.id });
    assert.equal(rubricItem.status, 201);
    const opened = await post(`/api/v1/events/${event.id}/open`, {});
    assert.equal(opened.status, 200);
    const locked = await post(`/api/v1/schedule/${last.id}/reorder`, {
      direction: "UP", neighborId: before.id, expectedOrder: 3, expectedNeighborOrder: 2,
    });
    assert.equal(locked.status, 409);
    assert.equal(locked.body.code, "EVENT_LOCKED");
  });
});
