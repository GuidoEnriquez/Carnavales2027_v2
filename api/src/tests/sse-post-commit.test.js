import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import { createApp } from "../app.js";
import { closePool, getPool } from "../db/pool.js";
import { migrate } from "../db/migrate.js";
import { executeCeremonialDraw } from "../modules/results/ceremonial-draw-orchestrator.js";
import { releaseResults, runTransaction } from "../modules/results/results-service.js";
import { getLatestResultsSnapshot } from "../modules/results/snapshot-service.js";
import { certifyScrutinyRecord } from "../modules/scrutiny-records/scrutiny-record-service.js";
import { emitMonitorEvent, subscribeMonitorEvents } from "../modules/monitor/monitor-event-bus.js";

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

function createSseBuffer(response) {
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let done = false;
  let error = null;
  const waiters = [];

  (async function pump() {
    try {
      while (true) {
        const { value, done: streamDone } = await reader.read();
        if (streamDone) break;
        if (value) buffer += decoder.decode(value, { stream: true });
        const pending = waiters.splice(0);
        for (const resolve of pending) resolve();
      }
      done = true;
    } catch (cause) {
      error = cause;
    } finally {
      const pending = waiters.splice(0);
      for (const resolve of pending) resolve();
    }
  })();

  return {
    text() {
      return buffer;
    },
    async waitFor(marker, { timeoutMs = 6000 } = {}) {
      const deadline = Date.now() + timeoutMs;
      while (!buffer.includes(marker)) {
        if (done || error) break;
        if (Date.now() > deadline) {
          throw new Error(`SSE timeout esperando: ${marker}`);
        }
        await new Promise((resolve) => waiters.push(resolve));
      }
      return buffer;
    },
  };
}

async function setupReleaseFixtures(pool) {
  const { rows: [event] } = await pool.query(
    "INSERT INTO carnival_event(name) VALUES($1) RETURNING id, name",
    ["Carnaval SSE Post-Commit"],
  );

  const { rows: [night] } = await pool.query(
    "INSERT INTO night(event_id, name, display_order, kind, status) VALUES($1,$2,$3,'COMPETITION','OPEN') RETURNING id",
    [event.id, "Noche 1", 1],
  );

  const { rows: [specialty] } = await pool.query(
    "INSERT INTO event_specialty(event_id, name, code, display_order) VALUES($1,'Baile','BAILE',1) RETURNING id",
    [event.id],
  );

  const { rows: [rubric] } = await pool.query(
    "INSERT INTO rubric(event_id, name, code, evaluation_target, rubric_type) VALUES($1,$2,$3,'TROUPE','NOMINATIVE') RETURNING id",
    [event.id, "Coreografía", "COREO"],
  );

  const { rows: [item] } = await pool.query(
    "INSERT INTO evaluation_item(event_id, rubric_id, specialty_id, name, code) VALUES($1,$2,$3,$4,$5) RETURNING id",
    [event.id, rubric.id, specialty.id, "Ejecución", "EJECUCION"],
  );

  const { rows: [category] } = await pool.query(
    "INSERT INTO event_category(event_id, name, code, display_order) VALUES($1,'Primera','PRIMERA',1) RETURNING id",
    [event.id],
  );

  const { rows: [troupeA] } = await pool.query(
    "INSERT INTO event_troupe(event_id, category_id, name) VALUES($1,$2,$3) RETURNING id, name",
    [event.id, category.id, "Comparsa Sol"],
  );
  const { rows: [troupeB] } = await pool.query(
    "INSERT INTO event_troupe(event_id, category_id, name) VALUES($1,$2,$3) RETURNING id, name",
    [event.id, category.id, "Comparsa Luna"],
  );

  const { rows: [scheduleA] } = await pool.query(
    "INSERT INTO night_troupe_schedule(event_id, night_id, event_troupe_id, presentation_order, status) VALUES($1,$2,$3,$4,'SCHEDULED') RETURNING id",
    [event.id, night.id, troupeA.id, 1],
  );
  const { rows: [scheduleB] } = await pool.query(
    "INSERT INTO night_troupe_schedule(event_id, night_id, event_troupe_id, presentation_order, status) VALUES($1,$2,$3,$4,'SCHEDULED') RETURNING id",
    [event.id, night.id, troupeB.id, 2],
  );

  const adminId = randomUUID();
  const scrutineerId = randomUUID();
  const judgeUserId = randomUUID();

  await pool.query(
    `INSERT INTO "user"(id, name, email, "emailVerified")
     VALUES ($1,'Admin SSE2',$2,true), ($3,'Judge SSE2',$4,true), ($5,'Scrutineer SSE2',$6,true)`,
    [
      adminId, `${adminId}@example.test`,
      judgeUserId, `${judgeUserId}@example.test`,
      scrutineerId, `${scrutineerId}@example.test`,
    ],
  );
  await pool.query("INSERT INTO user_role (user_id, role_code) VALUES ($1,'ADMIN')", [adminId]);
  await pool.query("INSERT INTO user_role (user_id, role_code) VALUES ($1,'JUDGE')", [judgeUserId]);
  await pool.query("INSERT INTO user_role (user_id, role_code) VALUES ($1,'SCRUTINEER')", [scrutineerId]);

  const { rows: [judgeProfile] } = await pool.query(
    "INSERT INTO judge_profile(name, email, document_number, registration_status, created_by) VALUES($1,$2,$3,'INVITED',$4) RETURNING id",
    ["Judge SSE2", `${judgeUserId}@test.test`, `DOC-${judgeUserId}`, adminId],
  );
  await pool.query("UPDATE judge_profile SET user_id = $1, registration_status = 'REGISTERED' WHERE id = $2", [judgeUserId, judgeProfile.id]);
  await pool.query(
    "INSERT INTO judge_quota(event_id, night_id, specialty_id, max_assignments) VALUES($1,$2,$3,1)",
    [event.id, night.id, specialty.id],
  );

  const { rows: [assignment] } = await pool.query(
    "INSERT INTO judge_assignment(event_id, night_id, specialty_id, judge_profile_id, assignment_type) VALUES($1,$2,$3,$4,'PRIMARY') RETURNING id",
    [event.id, night.id, specialty.id, judgeProfile.id],
  );

  const { rows: [ballot] } = await pool.query(
    "INSERT INTO ballot(event_id, night_id, judge_assignment_id, judge_profile_id, specialty_id, status) VALUES($1,$2,$3,$4,$5,'OPEN') RETURNING id",
    [event.id, night.id, assignment.id, judgeProfile.id, specialty.id],
  );

  await pool.query(
    `INSERT INTO ballot_score(ballot_id, event_id, evaluation_item_id, rubric_id, night_schedule_id, score, evaluation_state, status)
     VALUES ($1,$2,$3,$4,$5,10,'SCORED','DRAFT'),
            ($1,$2,$3,$4,$6,8,'SCORED','DRAFT')`,
    [ballot.id, event.id, item.id, rubric.id, scheduleA.id, scheduleB.id],
  );

  await pool.query("UPDATE ballot SET status='SUBMITTED', submitted_at=CURRENT_TIMESTAMP WHERE id=$1", [ballot.id]);
  await pool.query("UPDATE ballot_score SET status='LOCKED', locked_at=CURRENT_TIMESTAMP WHERE ballot_id=$1", [ballot.id]);
  await pool.query("UPDATE night SET status='CLOSED' WHERE id=$1", [night.id]);
  await pool.query(
    "INSERT INTO voting_window(event_id, night_id, status, closed_at) VALUES($1,$2,'CLOSED',CURRENT_TIMESTAMP)",
    [event.id, night.id],
  );

  return { event, scrutineerId };
}

async function createPersistentTie(pool) {
  const { rows: [event] } = await pool.query(
    "INSERT INTO carnival_event(name) VALUES($1) RETURNING id",
    [`Ceremonial draw post-commit ${randomUUID()}`],
  );
  const { rows: [night] } = await pool.query(
    "INSERT INTO night(event_id, name, display_order, kind, status) VALUES($1,$2,$3,'COMPETITION','OPEN') RETURNING id",
    [event.id, "Noche 1", 1],
  );
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
  const escribanoId = randomUUID();
  const judgeUserId = randomUUID();
  await pool.query(
    `INSERT INTO "user"(id,name,email,"emailVerified") VALUES
      ($1,'Admin',$4,true),($2,'Escribano',$5,true),($3,'Judge',$6,true)`,
    [adminId, escribanoId, judgeUserId,
      `${adminId}@test.local`, `${escribanoId}@test.local`, `${judgeUserId}@test.local`],
  );
  await pool.query("INSERT INTO user_role(user_id, role_code) VALUES($1,$2)", [adminId, "ADMIN"]);
  await pool.query("INSERT INTO user_role(user_id, role_code) VALUES($1,$2)", [escribanoId, "ESCRIBANO"]);
  const { rows: [profile] } = await pool.query(
    "INSERT INTO judge_profile(name,email,document_number,registration_status,created_by,user_id) VALUES('Judge', $1, $2,'REGISTERED',$3,$4) RETURNING id",
    [`${randomUUID()}@test.local`, `DOC-${randomUUID()}`, adminId, judgeUserId],
  );
  await pool.query(
    "INSERT INTO judge_quota(event_id,night_id,specialty_id,max_assignments) VALUES($1,$2,$3,2)",
    [event.id, night.id, specialty.id],
  );
  const { rows: [scheduleA] } = await pool.query(
    "INSERT INTO night_troupe_schedule(event_id,night_id,event_troupe_id,presentation_order,status) VALUES($1,$2,$3,$4,'SCHEDULED') RETURNING id",
    [event.id, night.id, troupes[0].id, 1],
  );
  const { rows: [scheduleB] } = await pool.query(
    "INSERT INTO night_troupe_schedule(event_id,night_id,event_troupe_id,presentation_order,status) VALUES($1,$2,$3,$4,'SCHEDULED') RETURNING id",
    [event.id, night.id, troupes[1].id, 2],
  );
  const { rows: [assignment] } = await pool.query(
    "INSERT INTO judge_assignment(event_id,night_id,specialty_id,judge_profile_id,assignment_type) VALUES($1,$2,$3,$4,'PRIMARY') RETURNING id",
    [event.id, night.id, specialty.id, profile.id],
  );
  const { rows: [ballot] } = await pool.query(
    "INSERT INTO ballot(event_id,night_id,judge_assignment_id,judge_profile_id,specialty_id,status) VALUES($1,$2,$3,$4,$5,'OPEN') RETURNING id",
    [event.id, night.id, assignment.id, profile.id, specialty.id],
  );
  for (const schedule of [scheduleA, scheduleB]) {
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
  await pool.query("INSERT INTO results_release(event_id,released_by) VALUES($1,$2)", [event.id, adminId]);
  return { eventId: event.id, escribanoId, troupeIds: troupes.map((t) => t.id) };
}

test("recorrido completo: liberación y acta generan snapshot y notificación SSE solo post-commit", {
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
  const data = await setupReleaseFixtures(pool);
  const app = createApp();

  await withServer(app, async (baseUrl) => {
    const collected = [];
    const unsubscribe = subscribeMonitorEvents((event) => collected.push(event));

    const controller = new AbortController();
    const streamRes = await fetch(`${baseUrl}/api/v1/public/stream`, { signal: controller.signal });
    assert.equal(streamRes.status, 200);
    const sse = createSseBuffer(streamRes);

    try {
      // v1 — Liberación de resultados (transacción propia, sin cliente inyectado).
      await releaseResults({ eventId: data.event.id, actorUserId: data.scrutineerId });

      const textV1 = await sse.waitFor('"version":1');
      assert.ok(textV1.includes("event: results_updated"), "debe llegar results_updated con version 1");
      assert.ok(textV1.includes(data.event.id), "debe llegar el eventId del evento liberado");

      // Prueba post-commit: al recibir el evento, el snapshot YA es legible.
      const resV1 = await fetch(`${baseUrl}/api/v1/public/events/${data.event.id}/results`);
      assert.equal(resV1.status, 200);
      assert.equal((await resV1.json()).version, 1);

      // Orden interno post-commit: el evento de dominio precede al de materialización.
      assert.deepEqual(
        collected.filter((e) => e.type === "RESULTS_RELEASED" || e.type === "RESULTS_SNAPSHOT_UPDATED").map((e) => e.type),
        ["RESULTS_RELEASED", "RESULTS_SNAPSHOT_UPDATED"],
      );

      // v2 — Certificación de acta oficial (transacción propia).
      await certifyScrutinyRecord({
        eventId: data.event.id,
        actorUserId: data.scrutineerId,
        actorRole: "SCRUTINEER",
      });

      const textV2 = await sse.waitFor('"version":2');
      assert.ok(textV2.includes("event: results_updated"), "debe llegar results_updated con version 2");

      const resV2 = await fetch(`${baseUrl}/api/v1/public/events/${data.event.id}/results`);
      assert.equal(resV2.status, 200);
      assert.equal((await resV2.json()).version, 2);
    } finally {
      controller.abort();
      unsubscribe();
    }
  });
});

test("sorteo ceremonial materializa snapshot y notifica (evento de dominio + versión pública)", {
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
  const app = createApp();

  await withServer(app, async (baseUrl) => {
    const collected = [];
    const unsubscribe = subscribeMonitorEvents((event) => collected.push(event));

    const controller = new AbortController();
    const streamRes = await fetch(`${baseUrl}/api/v1/public/stream`, { signal: controller.signal });
    assert.equal(streamRes.status, 200);
    const sse = createSseBuffer(streamRes);

    try {
      const result = await executeCeremonialDraw({
        eventId: data.eventId,
        remainingTroupeIds: data.troupeIds,
        actorUserId: data.escribanoId,
        actorRole: "ESCRIBANO",
      });

      // Evento de dominio del sorteo en el bus interno, post-commit.
      const drawEvent = collected.find((e) => e.type === "RESULTS_TIE_BREAKER_CEREMONIAL_DRAW");
      assert.ok(drawEvent, "el bus interno debe recibir RESULTS_TIE_BREAKER_CEREMONIAL_DRAW");
      assert.equal(drawEvent.eventId, data.eventId);
      assert.equal(drawEvent.winnerTroupeId, result.winnerTroupeId);
      assert.equal(drawEvent.method, result.method);
      assert.equal(drawEvent.auditEventId, result.auditEventId);

      // El evento del sorteo precede a la materialización del snapshot (mismo flush).
      const drawIndex = collected.findIndex((e) => e.type === "RESULTS_TIE_BREAKER_CEREMONIAL_DRAW");
      const snapshotIndex = collected.findIndex((e) => e.type === "RESULTS_SNAPSHOT_UPDATED" && e.eventId === data.eventId);
      assert.ok(drawIndex >= 0 && snapshotIndex > drawIndex, "el snapshot debe materializarse después del sorteo");

      // Notificación pública ante la materialización del sorteo.
      const textV1 = await sse.waitFor('"version":1');
      assert.ok(textV1.includes("event: results_updated"));
      assert.ok(textV1.includes(data.eventId));

      const snapshot = await getLatestResultsSnapshot(data.eventId);
      assert.ok(snapshot, "el sorteo debe haber materializado el snapshot");
      assert.equal(snapshot.version, 1);
    } finally {
      controller.abort();
      unsubscribe();
    }
  });
});

test("rollback de transacción NO difunde eventos encolados", {
  skip: !process.env.TEST_DATABASE_URL,
}, async (context) => {
  context.after(async () => {
    await closePool();
    if (originalDatabaseUrl === undefined) delete process.env.DATABASE_URL;
    else process.env.DATABASE_URL = originalDatabaseUrl;
  });
  process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;
  await migrate();

  const received = [];
  const unsubscribe = subscribeMonitorEvents((event) => received.push(event));

  const eventId = randomUUID();
  await assert.rejects(
    () => runTransaction(null, async (client) => {
      emitMonitorEvent("RESULTS_SNAPSHOT_UPDATED", { eventId, version: 99 });
      await client.query("SELECT 1/0");
    }),
  );

  assert.equal(received.length, 0, "un rollback no debe notificar la operación fallida");
  unsubscribe();
});