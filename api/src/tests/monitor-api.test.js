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

test("API monitor: supervisión VEEDOR de eventos y noches (Spec 016)", {
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
  const adminId = randomUUID();
  const veedorId = randomUUID();
  const suspendedVeedorId = randomUUID();
  const judgeUserId = randomUUID();
  const comisarioId = randomUUID();
  const scrutineerId = randomUUID();
  await pool.query(
     `INSERT INTO "user"(id, name, email, "emailVerified")
      VALUES ($1, 'Admin', $2, true), ($3, 'Veedor', $4, true),
             ($5, 'Veedor suspendido', $6, true), ($7, 'Judge', $8, true),
             ($9, 'Comisario', $10, true), ($11, 'Scrutineer', $12, true)`,
     [
       adminId, `${adminId}@example.test`,
       veedorId, `${veedorId}@example.test`,
       suspendedVeedorId, `${suspendedVeedorId}@example.test`,
       judgeUserId, `${judgeUserId}@example.test`,
       comisarioId, `${comisarioId}@example.test`,
       scrutineerId, `${scrutineerId}@example.test`,
     ],
  );
  await pool.query("INSERT INTO user_role (user_id, role_code) VALUES ($1, 'ADMIN')", [adminId]);
  await pool.query("INSERT INTO user_role (user_id, role_code) VALUES ($1, 'VEEDOR')", [veedorId]);
  await pool.query("INSERT INTO user_role (user_id, role_code) VALUES ($1, 'VEEDOR')", [suspendedVeedorId]);
  await pool.query("INSERT INTO user_role (user_id, role_code) VALUES ($1, 'JUDGE')", [judgeUserId]);
  await pool.query("INSERT INTO user_role (user_id, role_code) VALUES ($1, 'COMISARIO')", [comisarioId]);
  await pool.query("INSERT INTO user_role (user_id, role_code) VALUES ($1, 'SCRUTINEER')", [scrutineerId]);

  const { rows: [event] } = await pool.query(
    "INSERT INTO carnival_event(name) VALUES($1) RETURNING id", ["Monitor Event"],
  );
  const { rows: [night] } = await pool.query(
    "INSERT INTO night(event_id, name, display_order, kind, status) VALUES($1,$2,$3,$4,$5) RETURNING id",
    [event.id, "Noche 1", 1, "COMPETITION", "OPEN"],
  );
  await pool.query(
    "INSERT INTO night(event_id, name, display_order, kind, status) VALUES($1,$2,$3,$4,$5)",
    [event.id, "Noche de Premiación", 2, "AWARDS", "OPEN"],
  );
  const { rows: [specialty] } = await pool.query(
    "INSERT INTO event_specialty(event_id, name, code, display_order) VALUES($1,$2,$3,$4) RETURNING id",
    [event.id, "Baile", "BAILE", 1],
  );

  await pool.query(
    "INSERT INTO judge_quota(event_id, night_id, specialty_id, max_assignments) VALUES($1,$2,$3,$4)",
    [event.id, night.id, specialty.id, 3],
  );
  const { rows: [judgeProfile] } = await pool.query(
    "INSERT INTO judge_profile(name, email, document_number, registration_status, created_by) VALUES($1,$2,$3,$4,$5) RETURNING id",
    ["Judge Monitor", `judge-monitor-${randomUUID()}@test.test`, `DOC-MON-${randomUUID()}`, "INVITED", adminId],
  );
  await pool.query(
    "UPDATE judge_profile SET user_id = $2, registration_status = 'REGISTERED' WHERE id = $1",
    [judgeProfile.id, judgeUserId],
  );
  const { rows: [veedorProfile] } = await pool.query(
    `INSERT INTO operational_profile(name, email, document_number, user_id, registration_status, created_by)
     VALUES ($1, $2, $3, $4, 'REGISTERED', $5) RETURNING id`,
    ["Veedor Monitor", `${veedorId}@example.test`, `DOC-V-${randomUUID()}`, veedorId, adminId],
  );
  await pool.query(
    "INSERT INTO operational_profile_role (operational_profile_id, role_code) VALUES ($1, 'VEEDOR')",
    [veedorProfile.id],
  );
  const { rows: [suspendedProfile] } = await pool.query(
    `INSERT INTO operational_profile(name, email, document_number, user_id, registration_status, created_by)
     VALUES ($1, $2, $3, $4, 'SUSPENDED', $5) RETURNING id`,
    ["Veedor Suspendido", `${suspendedVeedorId}@example.test`, `DOC-SV-${randomUUID()}`, suspendedVeedorId, adminId],
  );
  await pool.query(
    "INSERT INTO operational_profile_role (operational_profile_id, role_code) VALUES ($1, 'VEEDOR')",
    [suspendedProfile.id],
  );
  const { rows: [assignment] } = await pool.query(
    `INSERT INTO judge_assignment(event_id, night_id, specialty_id, judge_profile_id, assignment_type)
     VALUES($1,$2,$3,$4,$5) RETURNING id`,
    [event.id, night.id, specialty.id, judgeProfile.id, "PRIMARY"],
  );
  await pool.query(
    `INSERT INTO ballot (event_id, night_id, judge_assignment_id, judge_profile_id, specialty_id, status)
     VALUES ($1,$2,$3,$4,$5,'OPEN')`,
    [event.id, night.id, assignment.id, judgeProfile.id, specialty.id],
  );
  await pool.query(
    "INSERT INTO voting_window (night_id, event_id, status) VALUES ($1, $2, 'OPEN')",
    [night.id, event.id],
  );

  const app = createApp({
    getSession: async ({ headers }) => {
      const role = headers.get("x-test-session");
      if (role === "admin") return { user: { id: adminId, twoFactorEnabled: true } };
      if (role === "veedor") return { user: { id: veedorId, twoFactorEnabled: true } };
      if (role === "suspended-veedor") return { user: { id: suspendedVeedorId, twoFactorEnabled: true } };
      if (role === "judge") return { user: { id: judgeUserId, twoFactorEnabled: true } };
      if (role === "comisario") return { user: { id: comisarioId, twoFactorEnabled: true } };
      if (role === "scrutineer") return { user: { id: scrutineerId, twoFactorEnabled: true } };
      if (role === "no-2fa") return { user: { id: veedorId, twoFactorEnabled: false } };
      return null;
    },
  });

  await withServer(app, async (baseUrl) => {
    // 1. Sin sesión → 401
    const unauth = await fetch(`${baseUrl}/api/v1/monitor/events`);
    assert.equal(unauth.status, 401);

    // 2. Sin 2FA → 403
    const noTwoFactor = await fetch(`${baseUrl}/api/v1/monitor/events`, { headers: { "x-test-session": "no-2fa" } });
    assert.equal(noTwoFactor.status, 403);

    // 3. Un VEEDOR suspendido no conserva acceso aunque mantenga el rol histórico.
    const suspended = await fetch(`${baseUrl}/api/v1/monitor/events`, { headers: { "x-test-session": "suspended-veedor" } });
    assert.equal(suspended.status, 403);
    assert.equal((await suspended.json()).code, "VEEDOR_REQUIRED");

    // 4. Roles no autorizados → 403 VEEDOR_REQUIRED
    const judgeRes = await fetch(`${baseUrl}/api/v1/monitor/events`, { headers: { "x-test-session": "judge" } });
    const judgeBody = await judgeRes.json();
    assert.equal(judgeRes.status, 403);
    assert.equal(judgeBody.code, "VEEDOR_REQUIRED");

    const comisarioRes = await fetch(`${baseUrl}/api/v1/monitor/events`, { headers: { "x-test-session": "comisario" } });
    assert.equal(comisarioRes.status, 403);
    assert.equal((await comisarioRes.json()).code, "VEEDOR_REQUIRED");

    const scrutineerRes = await fetch(`${baseUrl}/api/v1/monitor/events`, { headers: { "x-test-session": "scrutineer" } });
    assert.equal(scrutineerRes.status, 403);
    assert.equal((await scrutineerRes.json()).code, "VEEDOR_REQUIRED");

    // 5. VEEDOR accede → 200 con agregados, sin datos sensibles
    const veedorRes = await fetch(`${baseUrl}/api/v1/monitor/events`, { headers: { "x-test-session": "veedor" } });
    assert.equal(veedorRes.status, 200);
    const events = await veedorRes.json();
    const monitorEvent = events.find((item) => item.id === event.id);
    assert.ok(monitorEvent, "el evento con actividad debe aparecer");
    assert.equal(monitorEvent.name, "Monitor Event");
    assert.equal(monitorEvent.nights.length, 1);
    const monitorNight = monitorEvent.nights[0];
    assert.equal(monitorNight.id, night.id);
    assert.equal(monitorNight.votingStatus, "OPEN");
    assert.deepEqual(monitorNight.counts, { OPEN: 1, SUBMITTED: 0, REOPENED: 0, REPLACED: 0 });
    assert.equal(monitorNight.total, 1);

    // 6. El payload no expone puntajes, jurados ni comparsas (mínimo privilegio)
    const raw = JSON.stringify(events);
    for (const forbidden of ["judgeName", "judgeEmail", "score", "troupeName", "rubricName", "judgeProfileId"]) {
      assert.ok(!raw.includes(forbidden), `el payload no debe contener ${forbidden}`);
    }

    // 7. ADMIN también puede supervisar
    const adminRes = await fetch(`${baseUrl}/api/v1/monitor/events`, { headers: { "x-test-session": "admin" } });
    assert.equal(adminRes.status, 200);

    // 8. Detalle por noche para VEEDOR
    const nightRes = await fetch(`${baseUrl}/api/v1/monitor/events/${event.id}/nights/${night.id}`, {
      headers: { "x-test-session": "veedor" },
    });
    assert.equal(nightRes.status, 200);
    const nightData = await nightRes.json();
    assert.equal(nightData.id, night.id);
    assert.equal(nightData.total, 1);

    // 9. Noche inexistente → 404
    const missing = await fetch(`${baseUrl}/api/v1/monitor/events/${event.id}/nights/${randomUUID()}`, {
      headers: { "x-test-session": "veedor" },
    });
    assert.equal(missing.status, 404);

    // 10. Evento inexistente → 404
    const missingEvent = await fetch(`${baseUrl}/api/v1/monitor/events/${randomUUID()}/nights/${night.id}`, {
      headers: { "x-test-session": "veedor" },
    });
    assert.equal(missingEvent.status, 404);
  });
});
