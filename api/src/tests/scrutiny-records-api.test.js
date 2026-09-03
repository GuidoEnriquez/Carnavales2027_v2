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

async function setupScrutinyRecordApiFixture(pool) {
  const suffix = Math.random().toString(36).slice(2, 8);
  const { rows: [event] } = await pool.query(
    "INSERT INTO carnival_event(name) VALUES($1) RETURNING id",
    [`Scrutiny Record Event ${suffix}`],
  );
  const { rows: [night] } = await pool.query(
    "INSERT INTO night(event_id, name, display_order, kind, status) VALUES($1,$2,$3,$4,$5) RETURNING id",
    [event.id, "Noche 1", 1, "COMPETITION", "OPEN"],
  );
  await pool.query(
    "INSERT INTO voting_window(event_id, night_id, status, closed_at) VALUES($1,$2,'CLOSED',CURRENT_TIMESTAMP)",
    [event.id, night.id],
  );
  const { rows: [specialty] } = await pool.query(
    "INSERT INTO event_specialty(event_id, name, code, display_order) VALUES($1,$2,$3,$4) RETURNING id",
    [event.id, "Música", "MUSICA", 1],
  );
  const { rows: [rubric] } = await pool.query(
    "INSERT INTO rubric(event_id, name, code, evaluation_target, rubric_kind) VALUES($1,$2,$3,$4,$5) RETURNING id",
    [event.id, "Banda Musical", "BANDA", "TROUPE", "NOMINATIVE"],
  );
  const { rows: [item] } = await pool.query(
    "INSERT INTO evaluation_item(event_id, rubric_id, specialty_id, name, code) VALUES($1,$2,$3,$4,$5) RETURNING id",
    [event.id, rubric.id, specialty.id, "Afinación", "AFINACION"],
  );
  const { rows: [category] } = await pool.query(
    "INSERT INTO event_category(event_id, name, code, display_order) VALUES($1,$2,$3,$4) RETURNING id",
    [event.id, "Cat Oficial", "CAT_OF", 1],
  );
  const { rows: [troupeA] } = await pool.query(
    "INSERT INTO event_troupe(event_id, category_id, name) VALUES($1,$2,$3) RETURNING id",
    [event.id, category.id, "Sapucay"],
  );
  const { rows: [troupeB] } = await pool.query(
    "INSERT INTO event_troupe(event_id, category_id, name) VALUES($1,$2,$3) RETURNING id",
    [event.id, category.id, "Arandú Beleza"],
  );
  const { rows: [scheduleA] } = await pool.query(
    "INSERT INTO night_troupe_schedule(event_id, night_id, event_troupe_id, presentation_order) VALUES($1,$2,$3,$4) RETURNING id",
    [event.id, night.id, troupeA.id, 1],
  );
  const { rows: [scheduleB] } = await pool.query(
    "INSERT INTO night_troupe_schedule(event_id, night_id, event_troupe_id, presentation_order) VALUES($1,$2,$3,$4) RETURNING id",
    [event.id, night.id, troupeB.id, 2],
  );

  const adminId = randomUUID();
  const scrutineerId = randomUUID();
  const escribanoId = randomUUID();
  const comisarioId = randomUUID();
  const judgeId = randomUUID();

  await pool.query(
    `INSERT INTO "user"(id, name, email, "emailVerified")
     VALUES ($1,'Admin',$2,true), ($3,'Scrutineer',$4,true), ($5,'Escribano',$6,true), ($7,'Comisario',$8,true), ($9,'Judge User',$10,true)`,
    [
      adminId, `${adminId}@carnaval.test`,
      scrutineerId, `${scrutineerId}@carnaval.test`,
      escribanoId, `${escribanoId}@carnaval.test`,
      comisarioId, `${comisarioId}@carnaval.test`,
      judgeId, `${judgeId}@carnaval.test`,
    ],
  );

  await pool.query(
    `INSERT INTO user_role(user_id, role_code) VALUES
     ($1,'ADMIN'), ($2,'SCRUTINEER'), ($3,'ESCRIBANO'), ($4,'COMISARIO'), ($5,'JUDGE')`,
    [adminId, scrutineerId, escribanoId, comisarioId, judgeId],
  );

  const { rows: [judgeProfile] } = await pool.query(
    "INSERT INTO judge_profile(name, email, document_number, registration_status, created_by, user_id) VALUES($1,$2,$3,'REGISTERED',$4,$5) RETURNING id",
    [`Jurado ${suffix}`, `jurado${suffix}@carnaval.test`, `DOC${suffix}`, adminId, judgeId],
  );
  await pool.query(
    "INSERT INTO judge_quota(event_id, night_id, specialty_id, max_assignments) VALUES($1,$2,$3,2)",
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
    `INSERT INTO ballot_score(ballot_id, event_id, evaluation_item_id, night_schedule_id, rubric_id, evaluation_state, score, status)
     VALUES ($1,$6,$2,$3,$4,'SCORED',9,'LOCKED'), ($1,$6,$2,$5,$4,'SCORED',8,'LOCKED')`,
    [ballot.id, item.id, scheduleA.id, rubric.id, scheduleB.id, event.id],
  );

  await pool.query("UPDATE ballot SET status = 'SUBMITTED', submitted_at = CURRENT_TIMESTAMP WHERE id = $1", [ballot.id]);

  return {
    eventId: event.id,
    adminId,
    scrutineerId,
    escribanoId,
    comisarioId,
    judgeId,
  };
}

test("API Actas Oficiales: segregación de funciones, emisión 2FA, inmutabilidad e integridad", async (context) => {
  context.after(async () => {
    await closePool();
    if (originalDatabaseUrl === undefined) delete process.env.DATABASE_URL;
    else process.env.DATABASE_URL = originalDatabaseUrl;
  });

  process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;
  await migrate();
  const pool = getPool();
  const fixture = await setupScrutinyRecordApiFixture(pool);

  const getSession = async ({ headers }) => {
    const caller = headers.get("x-test-caller");
    if (caller === "admin") return { user: { id: fixture.adminId, twoFactorEnabled: true } };
    if (caller === "admin-no-2fa") return { user: { id: fixture.adminId, twoFactorEnabled: false } };
    if (caller === "scrutineer") return { user: { id: fixture.scrutineerId, twoFactorEnabled: true } };
    if (caller === "scrutineer-no-2fa") return { user: { id: fixture.scrutineerId, twoFactorEnabled: false } };
    if (caller === "escribano") return { user: { id: fixture.escribanoId, twoFactorEnabled: true } };
    if (caller === "comisario") return { user: { id: fixture.comisarioId, twoFactorEnabled: true } };
    if (caller === "judge") return { user: { id: fixture.judgeId, twoFactorEnabled: true } };
    return null;
  };

  const app = createApp({ getSession });

  await withServer(app, async (baseUrl) => {
    // 1. Sin autenticación -> 401
    const unauthRes = await fetch(`${baseUrl}/api/v1/events/${fixture.eventId}/scrutiny-record`, {
      method: "POST",
    });
    assert.equal(unauthRes.status, 401);

    // 2. Sin 2FA -> 403 TWO_FACTOR_REQUIRED
    const no2faRes = await fetch(`${baseUrl}/api/v1/events/${fixture.eventId}/scrutiny-record`, {
      method: "POST",
      headers: { "x-test-caller": "scrutineer-no-2fa" },
    });
    assert.equal(no2faRes.status, 403);
    const no2faBody = await no2faRes.json();
    assert.equal(no2faBody.code, "TWO_FACTOR_REQUIRED");

    // 3. ADMIN con 2FA intenta emitir acta -> 403 OFFICIAL_RECORD_EMISSION_FORBIDDEN_FOR_ADMIN
    const adminRes = await fetch(`${baseUrl}/api/v1/events/${fixture.eventId}/scrutiny-record`, {
      method: "POST",
      headers: { "x-test-caller": "admin" },
    });
    assert.equal(adminRes.status, 403);
    const adminBody = await adminRes.json();
    assert.equal(adminBody.code, "OFFICIAL_RECORD_EMISSION_FORBIDDEN_FOR_ADMIN");

    // 4. JUDGE / COMISARIO -> 403 RESULTS_ACCESS_DENIED
    const comisarioRes = await fetch(`${baseUrl}/api/v1/events/${fixture.eventId}/scrutiny-record`, {
      method: "POST",
      headers: { "x-test-caller": "comisario" },
    });
    assert.equal(comisarioRes.status, 403);
    const comisarioBody = await comisarioRes.json();
    assert.equal(comisarioBody.code, "RESULTS_ACCESS_DENIED");

    // 5. SCRUTINEER con 2FA pero resultados NO liberados aún -> 403 RESULTS_NOT_RELEASED
    const notReleasedRes = await fetch(`${baseUrl}/api/v1/events/${fixture.eventId}/scrutiny-record`, {
      method: "POST",
      headers: { "x-test-caller": "scrutineer" },
    });
    assert.equal(notReleasedRes.status, 403);
    const notReleasedBody = await notReleasedRes.json();
    assert.equal(notReleasedBody.code, "RESULTS_NOT_RELEASED");

    // 6. Consulta de acta antes de existir -> 404 OFFICIAL_RECORD_NOT_FOUND
    const notFoundRes = await fetch(`${baseUrl}/api/v1/events/${fixture.eventId}/scrutiny-record`, {
      method: "GET",
      headers: { "x-test-caller": "admin" },
    });
    assert.equal(notFoundRes.status, 404);
    const notFoundBody = await notFoundRes.json();
    assert.equal(notFoundBody.code, "OFFICIAL_RECORD_NOT_FOUND");

    // Liberar resultados como SCRUTINEER
    const releaseRes = await fetch(`${baseUrl}/api/v1/events/${fixture.eventId}/results/release`, {
      method: "POST",
      headers: { "x-test-caller": "scrutineer" },
    });
    assert.equal(releaseRes.status, 201);

    // 7. ESCRIBANO emite y certifica el Acta Oficial -> 201 Created
    const certifyRes = await fetch(`${baseUrl}/api/v1/events/${fixture.eventId}/scrutiny-record`, {
      method: "POST",
      headers: { "x-test-caller": "escribano" },
    });
    const certifyBody = await certifyRes.json();
    if (certifyRes.status !== 201) console.log("CERTIFY BODY:", certifyBody);
    assert.equal(certifyRes.status, 201);
    assert.equal(certifyBody.alreadyCertified, false);
    assert.equal(certifyBody.integrityVerified, true);
    assert.equal(certifyBody.record.certified_role, "ESCRIBANO");
    assert.equal(certifyBody.record.record_hash.length, 64);
    assert.ok(certifyBody.record.payload.recordNumber);
    assert.equal(certifyBody.record.payload.overallRanking[0].troupeName, "Sapucay");
    assert.equal(certifyBody.record.payload.overallRanking[0].netScore, 9);

    // 8. Idempotencia: segunda llamada por SCRUTINEER devuelve 200 con el acta existente
    const secondRes = await fetch(`${baseUrl}/api/v1/events/${fixture.eventId}/scrutiny-record`, {
      method: "POST",
      headers: { "x-test-caller": "scrutineer" },
    });
    assert.equal(secondRes.status, 200);
    const secondBody = await secondRes.json();
    assert.equal(secondBody.alreadyCertified, true);
    assert.equal(secondBody.record.id, certifyBody.record.id);
    assert.equal(secondBody.record.record_hash, certifyBody.record.record_hash);

    // 9. Consulta por ADMIN -> 200 OK con integrityVerified: true
    const adminGetRes = await fetch(`${baseUrl}/api/v1/events/${fixture.eventId}/scrutiny-record`, {
      method: "GET",
      headers: { "x-test-caller": "admin" },
    });
    assert.equal(adminGetRes.status, 200);
    const adminGetBody = await adminGetRes.json();
    assert.equal(adminGetBody.id, certifyBody.record.id);
    assert.equal(adminGetBody.integrityVerified, true);
    assert.equal(adminGetBody.certified_role, "ESCRIBANO");
  });
});
