import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { after, before, test } from "node:test";
import { setTimeout as delay } from "node:timers/promises";
import { createApp } from "../app.js";
import { migrate } from "../db/migrate.js";
import { closePool, getPool } from "../db/pool.js";
import { openEvent } from "../modules/events/event-readiness.service.js";
import { createItem, createCriterion, reorderItem, reorderCriterion, updateItem, updateCriterion } from "../modules/rubrics/rubric-service.js";

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
    body: JSON.stringify(body),
  });
  return { status: response.status, body: await response.json() };
}

async function fixture() {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const { rows: [event] } = await client.query("INSERT INTO carnival_event(name) VALUES('Reorder') RETURNING id");
    const { rows: [category] } = await client.query("INSERT INTO event_category(event_id,name,code,display_order) VALUES($1,'C','C',1) RETURNING id", [event.id]);
    await client.query("INSERT INTO event_troupe(event_id,category_id,name) VALUES($1,$2,'T')", [event.id, category.id]);
    await client.query("INSERT INTO night(event_id,name,display_order,kind) VALUES($1,'N',1,'COMPETITION')", [event.id]);
    const { rows: [specialty] } = await client.query("INSERT INTO event_specialty(event_id,name,code,display_order) VALUES($1,'S','S',1) RETURNING id", [event.id]);
    const { rows: [rubric] } = await client.query("INSERT INTO rubric(event_id,name,code,evaluation_target) VALUES($1,'R','R','TROUPE') RETURNING id", [event.id]);
    const items = [];
    for (const displayOrder of [2, 5, 11]) items.push(await createItem({ client, rubricId: rubric.id, specialtyId: specialty.id, name: `I${displayOrder}`, code: `I${displayOrder}`, displayOrder }));
    await updateItem({ client, itemId: items[1].id, active: false });
    const criteria = [];
    for (const [displayOrder, itemIndex] of [[3, 0], [8, 1], [15, 0], [22, 0]]) {
      criteria.push(await createCriterion({ client, rubricId: rubric.id, scoringItemId: items[itemIndex].id, description: `C${displayOrder}`, displayOrder }));
    }
    await updateCriterion({ client, criterionId: criteria[2].id, active: false });
    await client.query("COMMIT");
    return { event, rubric, specialty, items, criteria };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally { client.release(); }
}

function movement(first, second, direction = "DOWN") {
  return { direction, neighborId: second.id, expectedOrder: first.displayOrder, expectedNeighborOrder: second.displayOrder };
}

async function snapshot(f) {
  return {
    items: (await pool.query("SELECT * FROM evaluation_item WHERE rubric_id=$1 ORDER BY id", [f.rubric.id])).rows,
    criteria: (await pool.query("SELECT * FROM rubric_criterion WHERE rubric_id=$1 ORDER BY id", [f.rubric.id])).rows,
    audit: (await pool.query("SELECT * FROM audit_event WHERE after_data->>'rubricId'=$1 ORDER BY id", [f.rubric.id])).rows,
  };
}

for (const kind of ["item", "criterion"]) {
  test(`${kind} reorder: auth, validation, adjacency, atomic audit and stale replay`, { skip: !enabled }, async () => {
    const f = await fixture();
    const [first, second, third] = kind === "item" ? f.items : [f.criteria[0], f.criteria[2], f.criteria[3]];
    const prefix = kind === "item" ? "/evaluation-items" : "/rubric-criteria";
    const path = `${prefix}/${first.id}/reorder`;
    const body = movement(first, second);
    const initial = await snapshot(f);
    for (const [session, status, code] of [["none", 401, "UNAUTHENTICATED"], ["primary", 403, "TWO_FACTOR_REQUIRED"], ["judge", 403, "ADMIN_REQUIRED"]]) {
      const result = await request(path, body, { session });
      assert.equal(result.status, status);
      assert.equal(result.body.code, code);
    }
    for (const invalid of [null, {}, [], { ...body, direction: "LEFT" }, { ...body, neighborId: "invalid" }, { ...body, neighborId: first.id }, { ...body, expectedOrder: "2" }, { ...body, expectedOrder: 0 }, { ...body, expectedNeighborOrder: 1.5 }, { ...body, expectedNeighborOrder: 2147483648 }]) {
      assert.equal((await request(path, invalid)).status, 400);
    }
    assert.equal((await request(`${prefix}/invalid/reorder`, body)).status, 400);
    assert.equal((await request(`${prefix}/${randomUUID()}/reorder`, body)).status, 404);
    assert.equal((await request(path, { ...body, neighborId: randomUUID() })).status, 404);
    assert.deepEqual(await request(path, movement(first, third)), { status: 409, body: { code: "ORDER_CONFLICT" } });
    assert.deepEqual(await request(path, movement(first, second, "UP")), { status: 409, body: { code: "ORDER_BOUNDARY" } });
    assert.deepEqual(await request(`${prefix}/${third.id}/reorder`, movement(third, second)), { status: 409, body: { code: "ORDER_BOUNDARY" } });
    if (kind === "criterion") assert.deepEqual(await request(path, movement(first, f.criteria[1])), { status: 409, body: { code: "ORDER_CONFLICT" } });
    const other = await fixture();
    assert.deepEqual(await request(path, movement(first, kind === "item" ? other.items[0] : other.criteria[0])), { status: 409, body: { code: "ORDER_CONFLICT" } });
    assert.deepEqual(await snapshot(f), initial);

    // Body cannot replace the path ID, transaction client or authenticated actor.
    const result = await request(path, { ...body, itemId: third.id, criterionId: third.id, client: {}, actorUserId: "not-the-admin" });
    const changes = [{ id: first.id, displayOrder: second.displayOrder }, { id: second.id, displayOrder: first.displayOrder }];
    assert.deepEqual(result, { status: 200, body: { changes } });
    const current = await snapshot(f);
    const changedRows = kind === "item" ? current.items : current.criteria;
    for (const change of changes) assert.equal(changedRows.find((row) => row.id === change.id).display_order, change.displayOrder);
    assert.equal(changedRows.find((row) => row.id === second.id).active, false);
    assert.equal(changedRows.find((row) => row.id === third.id).display_order, third.displayOrder);
    assert.equal(current.audit.length, 1);
    const audit = current.audit[0];
    assert.equal(audit.actor_user_id, adminId);
    assert.equal(audit.entity_id, first.id);
    assert.equal(audit.action, kind === "item" ? "EVALUATION_ITEM_REORDERED" : "RUBRIC_CRITERION_REORDERED");
    const context = { eventId: f.event.id, rubricId: f.rubric.id, direction: "DOWN", ...(kind === "criterion" ? { scoringItemId: first.scoringItemId } : {}) };
    assert.deepEqual(audit.before_data, { ...context, changes: [{ id: first.id, displayOrder: first.displayOrder }, { id: second.id, displayOrder: second.displayOrder }] });
    assert.deepEqual(audit.after_data, { ...context, changes });
    assert.deepEqual(await request(path, body), { status: 409, body: { code: "ORDER_CONFLICT" } });
    assert.deepEqual(await snapshot(f), current);
    assert.equal((await request(path, { ...body, direction: "UP", expectedOrder: second.displayOrder, expectedNeighborOrder: first.displayOrder })).status, 200);
  });
}

test("concurrent item and criterion swaps serialize, rejecting stale requests without a second audit", { skip: !enabled }, async () => {
  for (const kind of ["item", "criterion"]) {
    const f = await fixture();
    const [first, second] = kind === "item" ? f.items : [f.criteria[0], f.criteria[2]];
    const prefix = kind === "item" ? "/evaluation-items" : "/rubric-criteria";
    const results = await Promise.all([
      request(`${prefix}/${first.id}/reorder`, movement(first, second)),
      request(`${prefix}/${second.id}/reorder`, movement(second, first, "UP")),
    ]);
    assert.deepEqual(results.map((r) => r.status).sort(), [200, 409]);
    assert.equal(results.find((r) => r.status === 409).body.code, "ORDER_CONFLICT");
    assert.equal((await snapshot(f)).audit.length, 1);
  }
});

test("related create/PATCH routes keep path IDs and transaction clients authoritative", { skip: !enabled }, async () => {
  const f = await fixture();
  const other = await fixture();
  const initialOther = await snapshot(other);
  const item = await request(`/rubrics/${f.rubric.id}/items`, {
    rubricId: other.rubric.id, client: null, name: "Path item", code: "PATH_ITEM", specialtyId: f.specialty.id,
  });
  assert.equal(item.status, 201);
  assert.equal(item.body.rubricId, f.rubric.id);
  const criterion = await request(`/rubrics/${f.rubric.id}/criteria`, {
    rubricId: other.rubric.id, client: {}, scoringItemId: item.body.id, description: "Path criterion", displayOrder: 31,
  });
  assert.equal(criterion.status, 201);
  assert.equal(criterion.body.rubricId, f.rubric.id);
  const itemPatch = await request(`/evaluation-items/${item.body.id}`, { itemId: other.items[0].id, client: {}, name: "Path edit" }, { method: "PATCH" });
  assert.equal(itemPatch.status, 200);
  assert.equal(itemPatch.body.id, item.body.id);
  const criterionPatch = await request(`/rubric-criteria/${criterion.body.id}`, { criterionId: other.criteria[0].id, client: null, description: "Path edit" }, { method: "PATCH" });
  assert.equal(criterionPatch.status, 200);
  assert.equal(criterionPatch.body.id, criterion.body.id);
  const beforeInvalid = await snapshot(f);
  assert.equal((await request(`/rubric-criteria/${criterion.body.id}`, { scoringItemId: null }, { method: "PATCH" })).status, 400);
  assert.deepEqual(await snapshot(f), beforeInvalid);
  assert.deepEqual(await snapshot(other), initialOther);
});

async function waitForBlocked(client) {
  const { rows: [{ pid }] } = await client.query("SELECT pg_backend_pid() AS pid");
  for (let attempt = 0; attempt < 200; attempt++) {
    const { rows: [{ waiting }] } = await pool.query("SELECT count(*)::integer AS waiting FROM pg_stat_activity WHERE $1=ANY(pg_blocking_pids(pid))", [pid]);
    if (waiting > 0) return;
    await delay(10);
  }
  assert.fail("Expected a real concurrent operation waiting for the event lock");
}

test("opening and reorder serialize in both directions without changing OPEN rules", { skip: !enabled }, async () => {
  for (const opensFirst of [true, false]) {
    const f = await fixture();
    const client = await pool.connect();
    let waiting;
    try {
      await client.query("BEGIN");
      if (opensFirst) {
        await openEvent({ client, eventId: f.event.id, actorUserId: adminId });
        waiting = request(`/evaluation-items/${f.items[0].id}/reorder`, movement(f.items[0], f.items[1]));
      } else {
        await reorderItem({ client, actorUserId: adminId, itemId: f.items[0].id, ...movement(f.items[0], f.items[1]) });
        waiting = request(`/events/${f.event.id}/open`, {});
      }
      await waitForBlocked(client);
      await client.query("COMMIT");
      const result = await waiting;
      assert.equal(result.status, opensFirst ? 409 : 200);
      if (opensFirst) assert.equal(result.body.code, "EVENT_LOCKED");
      const current = await snapshot(f);
      assert.equal(current.audit.length, opensFirst ? 0 : 1);
      assert.equal(current.items.find((row) => row.id === f.items[0].id).display_order, opensFirst ? 2 : 5);
      assert.deepEqual(await request(`/rubric-criteria/${f.criteria[0].id}/reorder`, movement(f.criteria[0], f.criteria[2])), { status: 409, body: { code: "EVENT_LOCKED" } });
    } finally {
      await client.query("ROLLBACK"); client.release();
      if (waiting) await waiting;
    }
  }
});

test("item/criterion PATCH and reorder use event-first locks and preserve independent edits", { skip: !enabled }, async () => {
  for (const kind of ["item", "criterion"]) {
    for (const patchFirst of [true, false]) {
      const f = await fixture();
      const [first, second] = kind === "item" ? f.items : [f.criteria[0], f.criteria[2]];
      const prefix = kind === "item" ? "/evaluation-items" : "/rubric-criteria";
      const client = await pool.connect();
      let waiting;
      try {
        await client.query("BEGIN");
        if (patchFirst) {
          if (kind === "item") await updateItem({ client, itemId: first.id, displayOrder: 1 });
          else await updateCriterion({ client, criterionId: first.id, scoringItemId: f.items[1].id });
          waiting = request(`${prefix}/${first.id}/reorder`, movement(first, second));
        } else {
          const operation = kind === "item" ? reorderItem : reorderCriterion;
          await operation({ client, itemId: first.id, criterionId: first.id, actorUserId: adminId, ...movement(first, second) });
          waiting = request(`${prefix}/${first.id}`, kind === "item" ? { name: "Edited" } : { description: "Edited" }, { method: "PATCH" });
        }
        await waitForBlocked(client);
        await client.query("COMMIT");
        const result = await waiting;
        assert.equal(result.status, patchFirst ? 409 : 200);
        if (patchFirst) assert.equal(result.body.code, "ORDER_CONFLICT");
        else {
          assert.equal(result.body.displayOrder, second.displayOrder);
          assert.equal(kind === "item" ? result.body.name : result.body.description, "Edited");
        }
        assert.equal((await snapshot(f)).audit.length, patchFirst ? 0 : 2);
      } finally {
        await client.query("ROLLBACK"); client.release();
        if (waiting) await waiting;
      }
    }
  }
});

test("direct-service defaults own transactions, serialize automatic order allocation and roll back failed audits", { skip: !enabled }, async (t) => {
  const f = await fixture();
  const created = await Promise.all(["A", "B"].map((code) => createItem({ rubricId: f.rubric.id, specialtyId: f.specialty.id, name: code, code })));
  assert.deepEqual(created.map((row) => row.displayOrder).sort((a, b) => a - b), [12, 13]);
  const criterion = await createCriterion({ rubricId: f.rubric.id, scoringItemId: created[0].id, description: "Direct", displayOrder: 30 });
  assert.equal((await updateCriterion({ criterionId: criterion.id, scoringItemId: created[1].id })).displayOrder, 30);
  assert.equal((await updateItem({ itemId: created[0].id, name: "Direct edit" })).name, "Direct edit");
  const initial = await snapshot(f);
  const connect = pool.connect.bind(pool);
  const mocked = t.mock.method(pool, "connect", async () => {
    const client = await connect();
    return {
      query: (sql, parameters) => {
        if (sql.includes("INSERT INTO audit_event")) throw new Error("TEST_AUDIT_FAILURE");
        return client.query(sql, parameters);
      },
      release: () => client.release(),
    };
  });
  for (const [operation, id] of [[reorderItem, f.items[0].id], [reorderCriterion, f.criteria[0].id]]) {
    const [first, second] = operation === reorderItem ? f.items : [f.criteria[0], f.criteria[2]];
    await assert.rejects(operation({ itemId: id, criterionId: id, actorUserId: adminId, ...movement(first, second) }), /TEST_AUDIT_FAILURE/);
  }
  mocked.mock.restore();
  assert.deepEqual(await snapshot(f), initial);
});
