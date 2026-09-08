import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import { createApp } from "../app.js";
import { closePool, getPool } from "../db/pool.js";
import { migrate } from "../db/migrate.js";
import { emitMonitorEvent, sanitizeMonitorEvent } from "../modules/monitor/monitor-event-bus.js";

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

test("API monitor SSE: canal en tiempo real y secreto estricto de voto (Spec 022)", {
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
  const judgeUserId = randomUUID();

  await pool.query(
    `INSERT INTO "user"(id, name, email, "emailVerified")
     VALUES ($1, 'Admin SSE', $2, true),
            ($3, 'Veedor SSE', $4, true),
            ($5, 'Judge SSE', $6, true)`,
    [
      adminId, `${adminId}@example.test`,
      veedorId, `${veedorId}@example.test`,
      judgeUserId, `${judgeUserId}@example.test`,
    ],
  );
  await pool.query("INSERT INTO user_role (user_id, role_code) VALUES ($1, 'ADMIN')", [adminId]);
  await pool.query("INSERT INTO user_role (user_id, role_code) VALUES ($1, 'VEEDOR')", [veedorId]);
  await pool.query("INSERT INTO user_role (user_id, role_code) VALUES ($1, 'JUDGE')", [judgeUserId]);

  const { rows: [veedorProfile] } = await pool.query(
    `INSERT INTO operational_profile(name, email, document_number, user_id, registration_status, created_by)
     VALUES ($1, $2, $3, $4, 'REGISTERED', $5) RETURNING id`,
    ["Veedor SSE", `${veedorId}@example.test`, `DOC-SSE-${randomUUID()}`, veedorId, adminId],
  );
  await pool.query(
    "INSERT INTO operational_profile_role (operational_profile_id, role_code) VALUES ($1, 'VEEDOR')",
    [veedorProfile.id],
  );

  const app = createApp({
    getSession: async ({ headers }) => {
      const role = headers.get("x-test-session");
      if (role === "admin") return { user: { id: adminId, twoFactorEnabled: true } };
      if (role === "veedor") return { user: { id: veedorId, twoFactorEnabled: true } };
      if (role === "judge") return { user: { id: judgeUserId, twoFactorEnabled: true } };
      if (role === "no-2fa") return { user: { id: veedorId, twoFactorEnabled: false } };
      return null;
    },
  });

  await withServer(app, async (baseUrl) => {
    // 1. Sin sesión -> 401
    const unauth = await fetch(`${baseUrl}/api/v1/monitor/stream`);
    assert.equal(unauth.status, 401);

    // 2. Sin 2FA -> 403
    const noTwoFactor = await fetch(`${baseUrl}/api/v1/monitor/stream`, {
      headers: { "x-test-session": "no-2fa" },
    });
    assert.equal(noTwoFactor.status, 403);

    // 3. Rol no autorizado (JUDGE) -> 403
    const judgeRes = await fetch(`${baseUrl}/api/v1/monitor/stream`, {
      headers: { "x-test-session": "judge" },
    });
    assert.equal(judgeRes.status, 403);

    // 4. Conexión autorizada (VEEDOR) -> 200 text/event-stream
    const controller = new AbortController();
    const streamRes = await fetch(`${baseUrl}/api/v1/monitor/stream`, {
      headers: { "x-test-session": "veedor" },
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
    assert.ok(text1.includes('"status":"connected"'));

    // 5. Emitir un evento operativo y leer el stream
    const testEventId = randomUUID();
    emitMonitorEvent("BALLOT_SUBMITTED", {
      eventId: testEventId,
      nightId: randomUUID(),
      ballotId: randomUUID(),
      // Intentar inyectar campos prohibidos (RF-190)
      score: 10,
      scores: [10, 9],
      judgeName: "Jurado Encubierto",
      judgeEmail: "secreto@jurado.test",
      documentNumber: "30123456",
      voterId: "secret-voter",
    });

    const { value: chunk2 } = await reader.read();
    const text2 = decoder.decode(chunk2);
    assert.ok(text2.includes("event: monitor_update"));
    assert.ok(text2.includes("BALLOT_SUBMITTED"));
    assert.ok(text2.includes(testEventId));

    // RF-190: Verificar que los campos confidenciales NUNCA aparecen en el stream
    assert.ok(!text2.includes("Jurado Encubierto"), "judgeName debe ser sanitizado");
    assert.ok(!text2.includes("secreto@jurado.test"), "judgeEmail debe ser sanitizado");
    assert.ok(!text2.includes("30123456"), "documentNumber debe ser sanitizado");
    assert.ok(!text2.includes("secret-voter"), "voterId debe ser sanitizado");
    assert.ok(!text2.includes('"score":'), "score individual debe ser sanitizado");
    assert.ok(!text2.includes('"scores":'), "scores individuales deben ser sanitizados");

    controller.abort();
  });

  // Test directo de sanitización (RF-190)
  const dirtyPayload = {
    type: "TEST",
    eventId: "ev-1",
    score: 9.5,
    scores: [10, 8],
    judgeName: "Maria",
    judgeEmail: "m@test.com",
    documentNumber: "123",
    voterId: "v-1",
    nested: {
      safe: true,
      score: 8,
      voterId: "nested-v",
    },
    array: [
      { ok: 1, judgeName: "Pedro" },
      "simple-string",
    ],
  };
  const sanitized = sanitizeMonitorEvent(dirtyPayload);
  assert.equal(sanitized.type, "TEST");
  assert.equal(sanitized.eventId, "ev-1");
  assert.equal(sanitized.score, undefined);
  assert.equal(sanitized.scores, undefined);
  assert.equal(sanitized.judgeName, undefined);
  assert.equal(sanitized.nested.safe, true);
  assert.equal(sanitized.nested.score, undefined);
  assert.equal(sanitized.nested.voterId, undefined);
  assert.equal(sanitized.array[0].ok, 1);
  assert.equal(sanitized.array[0].judgeName, undefined);
  assert.equal(sanitized.array[1], "simple-string");
});
