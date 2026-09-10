import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import { createApp } from "../app.js";
import { closePool, getPool } from "../db/pool.js";
import { migrate } from "../db/migrate.js";
import { releaseResults } from "../modules/results/results-service.js";
import { certifyScrutinyRecord } from "../modules/scrutiny-records/scrutiny-record-service.js";
import { emitMonitorEvent } from "../modules/monitor/monitor-event-bus.js";

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

async function setupReleasedFixtures(pool) {
  const { rows: [event] } = await pool.query(
    "INSERT INTO carnival_event(name) VALUES($1) RETURNING id, name",
    ["Carnaval Público 2027"],
  );

  const { rows: [night] } = await pool.query(
    "INSERT INTO night(event_id, name, display_order, kind, status) VALUES($1,$2,$3,$4,$5) RETURNING id",
    [event.id, "Noche 1", 1, "COMPETITION", "OPEN"],
  );

  const { rows: [specialty] } = await pool.query(
    "INSERT INTO event_specialty(event_id, name, code, display_order) VALUES($1,$2,$3,$4) RETURNING id",
    [event.id, "Baile", "BAILE", 1],
  );

  const { rows: [rubric] } = await pool.query(
    "INSERT INTO rubric(event_id, name, code, evaluation_target, rubric_type) VALUES($1,$2,$3,$4,$5) RETURNING id, name, code",
    [event.id, "Coreografía", "COREO", "TROUPE", "NOMINATIVE"],
  );

  const { rows: [item] } = await pool.query(
    "INSERT INTO evaluation_item(event_id, rubric_id, specialty_id, name, code) VALUES($1,$2,$3,$4,$5) RETURNING id",
    [event.id, rubric.id, specialty.id, "Ejecución", "EJECUCION"],
  );

  const { rows: [category] } = await pool.query(
    "INSERT INTO event_category(event_id, name, code, display_order) VALUES($1,$2,$3,$4) RETURNING id",
    [event.id, "Primera", "PRIMERA", 1],
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
    "INSERT INTO night_troupe_schedule(event_id, night_id, event_troupe_id, presentation_order, status) VALUES($1,$2,$3,$4,$5) RETURNING id",
    [event.id, night.id, troupeA.id, 1, "SCHEDULED"],
  );
  const { rows: [scheduleB] } = await pool.query(
    "INSERT INTO night_troupe_schedule(event_id, night_id, event_troupe_id, presentation_order, status) VALUES($1,$2,$3,$4,$5) RETURNING id",
    [event.id, night.id, troupeB.id, 2, "SCHEDULED"],
  );

  const adminId = randomUUID();
  const judgeUserId = randomUUID();
  const scrutineerId = randomUUID();

  await pool.query(
    `INSERT INTO "user"(id, name, email, "emailVerified")
     VALUES ($1,'Admin PR',$2,true), ($3,'Judge PR',$4,true), ($5,'Scrutineer PR',$6,true)`,
    [
      adminId, `${adminId}@example.test`,
      judgeUserId, `${judgeUserId}@example.test`,
      scrutineerId, `${scrutineerId}@example.test`,
    ],
  );
  await pool.query("INSERT INTO user_role (user_id, role_code) VALUES ($1,'ADMIN')", [adminId]);
  await pool.query("INSERT INTO user_role (user_id, role_code) VALUES ($1,'JUDGE')", [judgeUserId]);
  await pool.query("INSERT INTO user_role (user_id, role_code) VALUES ($1,'SCRUTINEER')", [scrutineerId]);

  const { rows: [scrutineerProfile] } = await pool.query(
    `INSERT INTO operational_profile(name, email, document_number, user_id, registration_status, created_by)
     VALUES ($1, $2, $3, $4, 'REGISTERED', $5) RETURNING id`,
    ["Scrutineer PR", `${scrutineerId}@example.test`, `DOC-PR-${randomUUID()}`, scrutineerId, adminId],
  );
  await pool.query(
    "INSERT INTO operational_profile_role (operational_profile_id, role_code) VALUES ($1, 'SCRUTINEER')",
    [scrutineerProfile.id],
  );

  const { rows: [judgeProfile] } = await pool.query(
    "INSERT INTO judge_profile(name, email, document_number, registration_status, created_by) VALUES($1,$2,$3,'INVITED',$4) RETURNING id",
    ["Judge PR", `${judgeUserId}@test.test`, `DOC-${judgeUserId}`, adminId],
  );
  await pool.query("UPDATE judge_profile SET user_id = $1, registration_status = 'REGISTERED' WHERE id = $2", [judgeUserId, judgeProfile.id]);
  await pool.query("INSERT INTO judge_quota(event_id, night_id, specialty_id, max_assignments) VALUES($1,$2,$3,1)", [event.id, night.id, specialty.id]);

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

  return {
    event,
    troupeA,
    troupeB,
    adminId,
    scrutineerId,
    judgeId: judgeUserId,
  };
}

test("API portal público de resultados (Spec 024)", {
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
  const data = await setupReleasedFixtures(pool);
  const app = createApp();

  await withServer(app, async (baseUrl) => {
    // 1. GET /api/v1/public/events/:eventId/results antes de liberar -> 404 RESULTS_NOT_RELEASED
    const unreleasedRes = await fetch(`${baseUrl}/api/v1/public/events/${data.event.id}/results`);
    assert.equal(unreleasedRes.status, 404);
    const unreleasedBody = await unreleasedRes.json();
    assert.equal(unreleasedBody.code, "RESULTS_NOT_RELEASED");

    // 2. ID inválido -> 400 INVALID_UUID
    const invalidIdRes = await fetch(`${baseUrl}/api/v1/public/events/not-a-uuid/results`);
    assert.equal(invalidIdRes.status, 400);
    const invalidIdBody = await invalidIdRes.json();
    assert.equal(invalidIdBody.code, "INVALID_UUID");

    // 3. Liberar resultados con rol SCRUTINEER (materializa snapshot v1 automáticamente)
    await releaseResults({
      eventId: data.event.id,
      actorUserId: data.scrutineerId,
      actorRole: "SCRUTINEER",
      client: pool,
    });

    // 4. GET /api/v1/public/events lista el evento
    const listRes = await fetch(`${baseUrl}/api/v1/public/events`);
    assert.equal(listRes.status, 200);
    const listBody = await listRes.json();
    assert.ok(Array.isArray(listBody.events));
    const listedEvent = listBody.events.find((e) => e.id === data.event.id);
    assert.ok(listedEvent, "El evento liberado debe figurar en la lista pública");
    assert.equal(listedEvent.name, data.event.name);
    assert.equal(listedEvent.latestVersion, 1);

    // 5. GET /api/v1/public/events/:eventId/results tras liberar -> 200 OK
    const resultsRes = await fetch(`${baseUrl}/api/v1/public/events/${data.event.id}/results`);
    assert.equal(resultsRes.status, 200);

    // Cabeceras HTTP de caché (RF-212)
    const eTag = resultsRes.headers.get("etag");
    assert.ok(eTag, "Debe incluir cabecera ETag");
    const cacheControl = resultsRes.headers.get("cache-control");
    assert.ok(cacheControl?.includes("public"), "Cache-Control debe ser public");
    assert.ok(cacheControl?.includes("max-age=30"), "Cache-Control debe incluir max-age=30");

    const payload = await resultsRes.json();
    assert.equal(payload.version, 1);
    assert.ok(payload.snapshotHash);
    assert.equal(payload.event.id, data.event.id);
    assert.equal(payload.bestTroupe.winnerTroupeId, data.troupeA.id);
    assert.equal(payload.bestTroupe.winnerTroupeName, data.troupeA.name);
    assert.equal(payload.overallRanking.length, 2);
    assert.equal(payload.overallRanking[0].troupeId, data.troupeA.id);
    assert.equal(payload.overallRanking[0].netScore, 10);
    assert.equal(payload.officialRecord, null);

    // RF-214: SECRETO ESTRICTO DEL VOTO
    // Verificar que NINGÚN campo de jurado individual o puntuación parcial privada aparece
    const rawPayloadText = JSON.stringify(payload);
    assert.ok(!rawPayloadText.includes("judge"), "El payload no debe contener menciones a jurados");
    assert.ok(!rawPayloadText.includes(data.judgeId), "El payload no debe contener el ID del jurado");
    assert.ok(!rawPayloadText.includes("ballot"), "El payload no debe contener referencias a ballot");
    assert.ok(!rawPayloadText.includes("evaluationItem"), "El payload no debe contener desglose de items individuales");

    // 6. Validación de caché HTTP 304 Not Modified (RF-212)
    const notModifiedRes = await fetch(`${baseUrl}/api/v1/public/events/${data.event.id}/results`, {
      headers: { "If-None-Match": eTag },
    });
    assert.equal(notModifiedRes.status, 304);
    assert.equal(await notModifiedRes.text(), "");

    // 7. Certificar Acta Oficial (SCRUTINEER) -> genera snapshot v2 automáticamente
    await certifyScrutinyRecord({
      eventId: data.event.id,
      recordNumber: "ACTA-PR-001/2027",
      actorUserId: data.scrutineerId,
      actorRole: "SCRUTINEER",
      client: pool,
    });

    const v2Res = await fetch(`${baseUrl}/api/v1/public/events/${data.event.id}/results`);
    assert.equal(v2Res.status, 200);
    const v2Payload = await v2Res.json();
    assert.equal(v2Payload.version, 2);
    assert.ok(v2Payload.officialRecord);
    assert.ok(v2Payload.officialRecord.recordNumber.startsWith("ACTA-"));
    assert.equal(v2Payload.officialRecord.certifiedRole, "SCRUTINEER");
    assert.ok(v2Payload.officialRecord.recordHash);
    assert.notEqual(v2Payload.snapshotHash, payload.snapshotHash);

    // 8. Canal SSE público (RF-213)
    const controller = new AbortController();
    const streamRes = await fetch(`${baseUrl}/api/v1/public/stream`, {
      signal: controller.signal,
    });
    assert.equal(streamRes.status, 200);
    assert.ok(streamRes.headers.get("content-type")?.includes("text/event-stream"));

    const reader = streamRes.body.getReader();
    const decoder = new TextDecoder();

    // Leer primer chunk -> conectado
    const { value: chunk1 } = await reader.read();
    const text1 = decoder.decode(chunk1);
    assert.ok(text1.includes("event: connected"));

    // Emitir nueva materialización de snapshot (notificación pública; RF-213).
    // El canal público reenvía únicamente RESULTS_SNAPSHOT_UPDATED con { eventId, version }.
    emitMonitorEvent("RESULTS_SNAPSHOT_UPDATED", {
      eventId: data.event.id,
      version: 2,
      snapshotHash: randomUUID(),
    });

    const { value: chunk2 } = await reader.read();
    const text2 = decoder.decode(chunk2);
    assert.ok(text2.includes("event: results_updated"));
    assert.ok(text2.includes(data.event.id));
    assert.ok(text2.includes('"version":2'));

    controller.abort();
  });
});
