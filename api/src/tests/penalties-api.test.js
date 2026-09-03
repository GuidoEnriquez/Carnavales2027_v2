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

async function setupTestEvent(pool) {
  const { rows: [event] } = await pool.query(
    "INSERT INTO carnival_event(name) VALUES($1) RETURNING id",
    ["Penalties Test Event"],
  );
  const { rows: [night] } = await pool.query(
    "INSERT INTO night(event_id, name, display_order, kind, status) VALUES($1,$2,$3,$4,$5) RETURNING id",
    [event.id, "Noche 1", 1, "COMPETITION", "OPEN"],
  );
  const { rows: [awardsNight] } = await pool.query(
    "INSERT INTO night(event_id, name, display_order, kind, status) VALUES($1,$2,$3,$4,$5) RETURNING id",
    [event.id, "Noche Premios", 2, "AWARDS", "OPEN"],
  );
  const { rows: [category] } = await pool.query(
    "INSERT INTO event_category(event_id, name, code, display_order) VALUES($1,$2,$3,$4) RETURNING id",
    [event.id, "Cat A", "CAT_A", 1],
  );
  const { rows: [troupe] } = await pool.query(
    "INSERT INTO event_troupe(event_id, category_id, name) VALUES($1,$2,$3) RETURNING id",
    [event.id, category.id, "Comparsa Penalizable"],
  );

  const adminId = randomUUID();
  const comisarioId = randomUUID();
  const judgeId = randomUUID();
  const veedorId = randomUUID();

  await pool.query(
    `INSERT INTO "user"(id, name, email, "emailVerified")
     VALUES ($1,'Admin',$2,true), ($3,'Comisario',$4,true), ($5,'Judge',$6,true), ($7,'Veedor',$8,true)`,
    [
      adminId, `${adminId}@example.test`,
      comisarioId, `${comisarioId}@example.test`,
      judgeId, `${judgeId}@example.test`,
      veedorId, `${veedorId}@example.test`,
    ],
  );

  await pool.query("INSERT INTO user_role(user_id, role_code) VALUES ($1,'ADMIN'), ($2,'COMISARIO'), ($3,'JUDGE'), ($4,'VEEDOR')", [
    adminId,
    comisarioId,
    judgeId,
    veedorId,
  ]);

  return {
    eventId: event.id,
    nightId: night.id,
    awardsNightId: awardsNight.id,
    troupeId: troupe.id,
    adminId,
    comisarioId,
    judgeId,
    veedorId,
  };
}

test("API penalizaciones: autorización, ciclo de vida, auditoría y bloqueo post-liberación", async (context) => {
  context.after(async () => {
    await closePool();
    if (originalDatabaseUrl === undefined) delete process.env.DATABASE_URL;
    else process.env.DATABASE_URL = originalDatabaseUrl;
  });

  process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;
  await migrate();
  const pool = getPool();
  const fixture = await setupTestEvent(pool);

  const getSession = async ({ headers }) => {
    const caller = headers.get("x-test-caller");
    if (caller === "admin") return { user: { id: fixture.adminId, twoFactorEnabled: true } };
    if (caller === "comisario") return { user: { id: fixture.comisarioId, twoFactorEnabled: true } };
    if (caller === "comisario-no-2fa") return { user: { id: fixture.comisarioId, twoFactorEnabled: false } };
    if (caller === "judge") return { user: { id: fixture.judgeId, twoFactorEnabled: true } };
    if (caller === "veedor") return { user: { id: fixture.veedorId, twoFactorEnabled: true } };
    return null;
  };

  const app = createApp({ getSession });

  await withServer(app, async (baseUrl) => {
    const postPenalty = async (caller, payload) =>
      fetch(`${baseUrl}/api/v1/events/${fixture.eventId}/penalties`, {
        method: "POST",
        headers: { "content-type": "application/json", "x-test-caller": caller },
        body: JSON.stringify(payload),
      });

    const getPenalties = async (caller, query = "") =>
      fetch(`${baseUrl}/api/v1/events/${fixture.eventId}/penalties${query}`, {
        headers: { "x-test-caller": caller },
      });

    const revokePenalty = async (caller, penaltyId, payload) =>
      fetch(`${baseUrl}/api/v1/events/${fixture.eventId}/penalties/${penaltyId}/revoke`, {
        method: "POST",
        headers: { "content-type": "application/json", "x-test-caller": caller },
        body: JSON.stringify(payload),
      });

    // 1. Rechazo sin autenticación (401)
    const unauth = await fetch(`${baseUrl}/api/v1/events/${fixture.eventId}/penalties`);
    assert.equal(unauth.status, 401);

    // 2. Rechazo sin 2FA (403 TWO_FACTOR_REQUIRED)
    const no2fa = await postPenalty("comisario-no-2fa", {
      nightId: fixture.nightId,
      eventTroupeId: fixture.troupeId,
      reason: "Demora en largada",
      penaltyPoints: 2,
    });
    assert.equal(no2fa.status, 403);
    assert.equal((await no2fa.json()).code, "TWO_FACTOR_REQUIRED");

    // 3. Rechazo a JUDGE y VEEDOR (403 PENALTIES_ACCESS_DENIED)
    const judgeRes = await postPenalty("judge", {
      nightId: fixture.nightId,
      eventTroupeId: fixture.troupeId,
      reason: "Demora",
      penaltyPoints: 1,
    });
    assert.equal(judgeRes.status, 403);
    assert.equal((await judgeRes.json()).code, "PENALTIES_ACCESS_DENIED");

    const veedorRes = await getPenalties("veedor");
    assert.equal(veedorRes.status, 403);
    assert.equal((await veedorRes.json()).code, "PENALTIES_ACCESS_DENIED");

    // 4. Rechazo si los puntos son <= 0 o inválidos (400)
    const invalidPts = await postPenalty("comisario", {
      nightId: fixture.nightId,
      eventTroupeId: fixture.troupeId,
      reason: "Demora",
      penaltyPoints: -5,
    });
    assert.equal(invalidPts.status, 400);

    // 5. Rechazo en noche no competitiva (409 PENALTY_REQUIRES_COMPETITION_NIGHT)
    const awardsRes = await postPenalty("comisario", {
      nightId: fixture.awardsNightId,
      eventTroupeId: fixture.troupeId,
      reason: "Falta en desfile",
      penaltyPoints: 3,
    });
    assert.equal(awardsRes.status, 409);
    assert.equal((await awardsRes.json()).code, "PENALTY_REQUIRES_COMPETITION_NIGHT");

    // 6. Alta exitosa por COMISARIO (201)
    const createRes = await postPenalty("comisario", {
      nightId: fixture.nightId,
      eventTroupeId: fixture.troupeId,
      reason: "Demora de 8 minutos en salida",
      penaltyPoints: 5,
    });
    assert.equal(createRes.status, 201);
    const penalty = await createRes.json();
    assert.ok(penalty.id);
    assert.equal(penalty.status, "APPLIED");
    assert.equal(penalty.penaltyPoints, 5);
    assert.equal(penalty.reason, "Demora de 8 minutos en salida");

    // Verificar auditoría TROUPE_PENALTY_APPLIED
    const { rows: auditApplied } = await pool.query(
      "SELECT * FROM audit_event WHERE action = 'TROUPE_PENALTY_APPLIED' AND entity_id = $1",
      [penalty.id],
    );
    assert.equal(auditApplied.length, 1);
    assert.equal(auditApplied[0].actor_user_id, fixture.comisarioId);

    // 7. Listado por ADMIN (200)
    const listRes = await getPenalties("admin");
    assert.equal(listRes.status, 200);
    const list = await listRes.json();
    assert.equal(list.length, 1);
    assert.equal(list[0].id, penalty.id);
    assert.equal(list[0].troupeName, "Comparsa Penalizable");

    // 8. Revocación sin motivo (400)
    const emptyRevoke = await revokePenalty("admin", penalty.id, { revocationReason: "" });
    assert.equal(emptyRevoke.status, 400);

    // 9. Revocación exitosa por ADMIN (200)
    const revokeRes = await revokePenalty("admin", penalty.id, {
      revocationReason: "Falla técnica en semáforo de largada constatada",
    });
    assert.equal(revokeRes.status, 200);
    const revoked = await revokeRes.json();
    assert.equal(revoked.status, "REVOKED");
    assert.equal(revoked.revocationReason, "Falla técnica en semáforo de largada constatada");

    // Verificar auditoría TROUPE_PENALTY_REVOKED
    const { rows: auditRevoked } = await pool.query(
      "SELECT * FROM audit_event WHERE action = 'TROUPE_PENALTY_REVOKED' AND entity_id = $1",
      [penalty.id],
    );
    assert.equal(auditRevoked.length, 1);
    assert.equal(auditRevoked[0].actor_user_id, fixture.adminId);

    // 10. No se puede revocar nuevamente (409 CANNOT_MUTATE_REVOKED_PENALTY)
    const secondRevoke = await revokePenalty("comisario", penalty.id, {
      revocationReason: "Segundo intento",
    });
    assert.equal(secondRevoke.status, 409);
    assert.equal((await secondRevoke.json()).code, "CANNOT_MUTATE_REVOKED_PENALTY");

    // 11. Cargar una nueva penalización activa y luego liberar resultados
    const secondPenaltyRes = await postPenalty("comisario", {
      nightId: fixture.nightId,
      eventTroupeId: fixture.troupeId,
      reason: "Menos integrantes que el mínimo reglamentario",
      penaltyPoints: 10,
    });
    assert.equal(secondPenaltyRes.status, 201);
    const secondPenalty = await secondPenaltyRes.json();

    // Liberar resultados del evento
    await pool.query(
      "INSERT INTO results_release(event_id, released_by) VALUES ($1, $2)",
      [fixture.eventId, fixture.adminId],
    );

    // 12. Intentar crear o revocar tras liberación (409 RESULTS_ALREADY_RELEASED)
    const postPostRelease = await postPenalty("comisario", {
      nightId: fixture.nightId,
      eventTroupeId: fixture.troupeId,
      reason: "Falta posterior",
      penaltyPoints: 2,
    });
    assert.equal(postPostRelease.status, 409);
    assert.equal((await postPostRelease.json()).code, "RESULTS_ALREADY_RELEASED");

    const revokePostRelease = await revokePenalty("admin", secondPenalty.id, {
      revocationReason: "Descargo tardío",
    });
    assert.equal(revokePostRelease.status, 409);
    assert.equal((await revokePostRelease.json()).code, "RESULTS_ALREADY_RELEASED");
  });
});
