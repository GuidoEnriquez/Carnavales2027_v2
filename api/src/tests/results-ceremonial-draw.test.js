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

async function createPersistentTie(pool) {
  const { rows: [event] } = await pool.query(
    "INSERT INTO carnival_event(name) VALUES($1) RETURNING id",
    [`Ceremonial draw ${randomUUID()}`],
  );
  const nights = [];
  for (const [name, order] of [["Noche 1", 1], ["Noche 2", 2]]) {
    const { rows: [night] } = await pool.query(
      "INSERT INTO night(event_id, name, display_order, kind, status) VALUES($1,$2,$3,'COMPETITION','OPEN') RETURNING id",
      [event.id, name, order],
    );
    nights.push(night);
  }
  const { rows: [specialty] } = await pool.query(
    "INSERT INTO event_specialty(event_id, name, code, display_order) VALUES($1,'Baile','BAILE',1) RETURNING id",
    [event.id],
  );
  const rubrics = [];
  for (const [name, code] of [["Coreografía", "COREOGRAFIA"], ["Diseño", "DISENO"]]) {
    const { rows: [rubric] } = await pool.query(
      "INSERT INTO rubric(event_id, name, code, evaluation_target, rubric_type) VALUES($1,$2,$3,'TROUPE','NOMINATIVE') RETURNING id",
      [event.id, name, code],
    );
    const { rows: [item] } = await pool.query(
      "INSERT INTO evaluation_item(event_id, rubric_id, specialty_id, name, code) VALUES($1,$2,$3,$4,$5) RETURNING id",
      [event.id, rubric.id, specialty.id, `${name} item`, `${code}_ITEM`],
    );
    rubrics.push({ ...rubric, itemId: item.id });
  }
  const { rows: [category] } = await pool.query(
    "INSERT INTO event_category(event_id, name, code, display_order) VALUES($1,'Primera','PRIMERA',1) RETURNING id",
    [event.id],
  );
  const troupes = [];
  for (const name of ["Comparsa A", "Comparsa B"]) {
    const { rows: [troupe] } = await pool.query(
      "INSERT INTO event_troupe(event_id, category_id, name) VALUES($1,$2,$3) RETURNING id",
      [event.id, category.id, name],
    );
    troupes.push(troupe);
  }
  const adminId = randomUUID();
  const scrutineerId = `scrutineer-${randomUUID()}`;
  const escribanoId = `escribano-${randomUUID()}`;
  const veedorId = randomUUID();
  const judgeUserId = randomUUID();
  await pool.query(
    `INSERT INTO "user"(id,name,email,"emailVerified") VALUES
      ($1,'Admin',$6,true),($2,'Scrutineer',$7,true),($3,'Escribano',$8,true),($4,'Veedor',$9,true),($5,'Judge',$10,true)`,
    [adminId, scrutineerId, escribanoId, veedorId, judgeUserId,
      `${adminId}@test.local`, `${scrutineerId}@test.local`, `${escribanoId}@test.local`, `${veedorId}@test.local`, `${judgeUserId}@test.local`],
  );
  for (const [id, role] of [[adminId, "ADMIN"], [scrutineerId, "SCRUTINEER"], [escribanoId, "ESCRIBANO"], [veedorId, "VEEDOR"]]) {
    await pool.query("INSERT INTO user_role(user_id, role_code) VALUES($1,$2)", [id, role]);
  }
  const { rows: [profile] } = await pool.query(
    "INSERT INTO judge_profile(name,email,document_number,registration_status,created_by,user_id) VALUES('Judge', $1, $2,'REGISTERED',$3,$4) RETURNING id",
    [`${randomUUID()}@test.local`, `DOC-${randomUUID()}`, adminId, judgeUserId],
  );
  // El user_id no se usa en el cálculo; el perfil solo satisface la FK de asignación.
  const { rows: [quota] } = await pool.query(
    "INSERT INTO judge_quota(event_id,night_id,specialty_id,max_assignments) VALUES($1,$2,$3,2) RETURNING id",
    [event.id, nights[0].id, specialty.id],
  );
  await pool.query(
    "INSERT INTO judge_quota(event_id,night_id,specialty_id,max_assignments) VALUES($1,$2,$3,2)",
    [event.id, nights[1].id, specialty.id],
  );
  const assignments = [];
  for (const night of nights) {
    const { rows: [assignment] } = await pool.query(
      "INSERT INTO judge_assignment(event_id,night_id,specialty_id,judge_profile_id,assignment_type) VALUES($1,$2,$3,$4,'PRIMARY') RETURNING id",
      [event.id, night.id, specialty.id, profile.id],
    );
    assignments.push(assignment);
  }
  for (let n = 0; n < nights.length; n += 1) {
    const { rows: [ballot] } = await pool.query(
      "INSERT INTO ballot(event_id,night_id,judge_assignment_id,judge_profile_id,specialty_id,status) VALUES($1,$2,$3,$4,$5,'OPEN') RETURNING id",
      [event.id, nights[n].id, assignments[n].id, profile.id, specialty.id],
    );
    for (const troupe of troupes) {
      const { rows: [schedule] } = await pool.query(
        "INSERT INTO night_troupe_schedule(event_id,night_id,event_troupe_id,presentation_order,status) VALUES($1,$2,$3,$4,'SCHEDULED') RETURNING id",
        [event.id, nights[n].id, troupe.id, troupes.indexOf(troupe) + 1],
      );
      for (const rubric of rubrics) {
        await pool.query(
          `INSERT INTO ballot_score(ballot_id,event_id,evaluation_item_id,rubric_id,night_schedule_id,score,evaluation_state,status)
           VALUES($1,$2,$3,$4,$5,8,'SCORED','DRAFT')`,
          [ballot.id, event.id, rubric.itemId, rubric.id, schedule.id],
        );
      }
    }
    await pool.query("UPDATE ballot SET status='SUBMITTED', submitted_at=CURRENT_TIMESTAMP WHERE id=$1", [ballot.id]);
    await pool.query("UPDATE ballot_score SET status='LOCKED', locked_at=CURRENT_TIMESTAMP WHERE ballot_id=$1", [ballot.id]);
  }
  await pool.query("INSERT INTO results_release(event_id,released_by) VALUES($1,$2)", [event.id, adminId]);
  return { eventId: event.id, adminId, scrutineerId, escribanoId, veedorId, troupeIds: troupes.map((t) => t.id) };
}

test("API sorteo ceremonial: autoriza, sortea y audita; impide duplicado y pool inválido", {
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
  const data = await createPersistentTie(pool);
  const app = createApp({
    getSession: async ({ headers }) => {
      const session = headers.get("x-test-session");
      const ids = {
        admin: data.adminId,
        scrutineer: data.scrutineerId,
        escribano: data.escribanoId,
        veedor: data.veedorId,
      };
      return ids[session] ? { user: { id: ids[session], twoFactorEnabled: true } } : null;
    },
  });
  await withServer(app, async (base) => {
    const path = `${base}/api/v1/events/${data.eventId}/tie-breaker/ceremonial-draw`;
    const jsonHeaders = (role) => ({ "content-type": "application/json", "x-test-session": role });
    const listedEvents = await fetch(`${base}/api/v1/results/events`, { headers: jsonHeaders("scrutineer") });
    assert.equal(listedEvents.status, 200);
    assert.ok((await listedEvents.json()).some((item) => item.id === data.eventId));
    const listedTroupes = await fetch(`${base}/api/v1/results/events/${data.eventId}/troupes`, { headers: jsonHeaders("scrutineer") });
    assert.equal(listedTroupes.status, 200);
    assert.equal((await listedTroupes.json()).length, 2);

    const body = { remainingTroupeIds: data.troupeIds };
    const beforeDraw = await fetch(path, { headers: jsonHeaders("scrutineer") });
    assert.equal(beforeDraw.status, 404);
    assert.equal((await beforeDraw.json()).code, "TIE_BREAKER_DRAW_NOT_FOUND");

    const denied = await fetch(path, { method: "POST", headers: jsonHeaders("veedor"), body: JSON.stringify(body) });
    assert.equal(denied.status, 403);
    assert.equal((await denied.json()).code, "RESULTS_ACCESS_DENIED");

    const emptyPool = await fetch(path, { method: "POST", headers: jsonHeaders("scrutineer"), body: JSON.stringify({ ...body, remainingTroupeIds: [] }) });
    assert.equal(emptyPool.status, 422);
    assert.equal((await emptyPool.json()).code, "TIE_BREAKER_EMPTY_DRAW_POOL");

    const malformed = await fetch(path, { method: "POST", headers: jsonHeaders("scrutineer"), body: JSON.stringify({ ...body, remainingTroupeIds: ["no-es-un-uuid", data.troupeIds[1]] }) });
    assert.equal(malformed.status, 422);
    assert.equal((await malformed.json()).code, "TIE_BREAKER_INVALID_DRAW_INPUT");

    const invalid = await fetch(path, { method: "POST", headers: jsonHeaders("scrutineer"), body: JSON.stringify({ ...body, remainingTroupeIds: [randomUUID(), data.troupeIds[1]] }) });
    assert.equal(invalid.status, 409);
    assert.equal((await invalid.json()).code, "TIE_BREAKER_STALE");

    const success = await fetch(path, { method: "POST", headers: jsonHeaders("escribano"), body: JSON.stringify(body) });
    assert.equal(success.status, 201);
    const result = await success.json();
    assert.ok(data.troupeIds.includes(result.winnerTroupeId));
    assert.equal(result.method, "CRYPTO_RANDOM_INT");
    assert.ok(result.auditEventId);

    const recorded = await fetch(path, { headers: jsonHeaders("escribano") });
    assert.equal(recorded.status, 200);
    const recordedResult = await recorded.json();
    assert.equal(recordedResult.eventId, data.eventId);
    assert.equal(recordedResult.winnerTroupeId, result.winnerTroupeId);
    assert.equal(recordedResult.method, result.method);
    assert.equal(recordedResult.auditEventId, result.auditEventId);
    assert.ok(recordedResult.recordedAt);

    // RF-103 / clarifications.md: ADMIN queda excluido del sorteo ceremonial
    // por separación de funciones, igual que de liberar resultados y
    // certificar el acta. Corregido 2026-09-07: el middleware admitía ADMIN
    // por error (ver require-ceremonial-draw-access.js).
    const adminPost = await fetch(path, { method: "POST", headers: jsonHeaders("admin"), body: JSON.stringify(body) });
    assert.equal(adminPost.status, 403);
    assert.equal((await adminPost.json()).code, "RESULTS_ACCESS_DENIED");

    const adminGet = await fetch(path, { headers: jsonHeaders("admin") });
    assert.equal(adminGet.status, 403);
    assert.equal((await adminGet.json()).code, "RESULTS_ACCESS_DENIED");

    const duplicate = await fetch(path, { method: "POST", headers: jsonHeaders("scrutineer"), body: JSON.stringify(body) });
    assert.equal(duplicate.status, 409);
    assert.equal((await duplicate.json()).code, "TIE_BREAKER_ALREADY_DRAWN");

    const { rows: [audit] } = await pool.query(
      "SELECT action, after_data->>'winnerTroupeId' AS winner, previous_hash, event_hash FROM audit_event WHERE id = $1",
      [result.auditEventId],
    );
    assert.equal(audit.action, "RESULTS_TIE_BREAKER_CEREMONIAL_DRAW");
    assert.equal(audit.winner, result.winnerTroupeId);
    assert.match(audit.previous_hash.trim(), /^[0-9a-f]{64}$/);
    assert.match(audit.event_hash.trim(), /^[0-9a-f]{64}$/);
  });
});
