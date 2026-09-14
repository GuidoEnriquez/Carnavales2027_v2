import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import test from "node:test";
import { createOrVerifyCredentialUser } from "../../auth/account-service.js";
import { getSeedPassword, seedFixtureUsers } from "../seeds/full-event.users.js";
import { FULL_JUDGES, FULL_AUXILIARIES } from "../seeds/full-event.fixture.js";
import { seedFullCarnivalEvent } from "../seeds/full-event.js";
import { printFullEventSummary } from "../../scripts/seed-full-event.js";
import { migrate } from "../migrate.js";
import { prepareDemoSeedTest } from "./demo-seed-test-environment.js";

const provisionUsers = () => seedFixtureUsers({ judges: FULL_JUDGES, auxiliaries: FULL_AUXILIARIES });

test("seed integral: entorno y contraseña se validan antes de conectar o migrar", async () => {
  const original = process.env.NODE_ENV;
  try {
    for (const nodeEnv of ["production", "staging", undefined]) {
      if (nodeEnv) process.env.NODE_ENV = nodeEnv;
      else delete process.env.NODE_ENV;
      await assert.rejects(seedFullCarnivalEvent, /REQUIRES_DEVELOPMENT_OR_TEST/);
    }
    for (const password of [undefined, "", "123", "x".repeat(129)]) {
      assert.throws(() => getSeedPassword({ NODE_ENV: "test", SEED_DEMO_PASSWORD: password }), /PASSWORD_REQUIRED/);
    }
    const password = randomBytes(10).toString("hex");
    assert.equal(getSeedPassword({ NODE_ENV: "test", SEED_ADMIN_PASSWORD: password }).password, password);
  } finally {
    if (original === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = original;
  }
});

test("seed completo en BD vacía: cuentas, login OTP e idempotencia", {
  skip: !process.env.TEST_DATABASE_URL,
}, async (t) => {
  const { pool, password, createAuth } = await prepareDemoSeedTest(t);
  assert.equal((await pool.query('SELECT count(*)::int AS n FROM "user"')).rows[0].n, 0);

  let first;
  await t.test("arranque vacío crea ADMIN + 9 JUDGE + ESCRIBANO + VEEDOR y toda la configuración", async () => {
    first = await seedFullCarnivalEvent();
    assert.equal(first.users.admin.created, true);
    assert.equal(first.users.judges.length, 9);
    assert.ok(first.users.judges.every((entry) => entry.created));
    assert.equal(first.users.auxiliaries.length, 2);
    assert.ok(first.users.auxiliaries.every((entry) => entry.created));
    assert.equal(first.rubrics, 36);
    assert.equal(first.troupes, 7);
    assert.equal(first.coverage, 175);
    assert.equal((await pool.query("SELECT count(*)::int AS n FROM night")).rows[0].n, 3);
    assert.equal((await pool.query('SELECT count(*)::int AS n FROM "user"')).rows[0].n, 12);
    assert.equal((await pool.query("SELECT count(*)::int AS n FROM judge_profile WHERE registration_status='REGISTERED'")).rows[0].n, 9);
    assert.equal((await pool.query("SELECT count(*)::int AS n FROM operational_profile WHERE registration_status='REGISTERED'")).rows[0].n, 2);
    assert.equal((await pool.query("SELECT count(*)::int AS n FROM judge_invitation WHERE status='USED'")).rows[0].n, 9);
    assert.equal((await pool.query("SELECT count(*)::int AS n FROM operational_invitation WHERE status='USED'")).rows[0].n, 2);
    assert.equal((await pool.query("SELECT count(*)::int AS n FROM ballot")).rows[0].n, 0);
    assert.deepEqual((await migrate()).applied, []);
  });
  if (!first) return;
  await t.test("dos ejecuciones concurrentes conservan IDs, roles, hashes y cantidades", async () => {
    const before = (await pool.query('SELECT id, password FROM account ORDER BY id')).rows;
    const [second, third] = await Promise.all([provisionUsers(), provisionUsers()]);
    for (const result of [second, third]) {
      assert.equal(result.admin.userId, first.users.admin.userId);
      assert.deepEqual(result.judges.map((entry) => entry.userId), first.users.judges.map((entry) => entry.userId));
      assert.deepEqual(result.auxiliaries.map((entry) => entry.userId), first.users.auxiliaries.map((entry) => entry.userId));
      assert.ok(result.judges.every((entry) => !entry.created));
    }
    assert.deepEqual((await pool.query('SELECT id, password FROM account ORDER BY id')).rows, before);
    assert.equal((await pool.query('SELECT count(*)::int AS n FROM "user"')).rows[0].n, 12);
    const lines = [];
    printFullEventSummary(first, (line) => lines.push(line));
    assert.ok(!lines.join("\n").includes(password));
    assert.ok(!JSON.stringify((await pool.query("SELECT * FROM audit_event")).rows).includes(password));
  });
  await t.test("las doce cuentas inician sesión; OTP habilita el rol sin compartir 2FA", async () => {
    let otp;
    const testAuth = createAuth({ sendOtp: async ({ otp: value }) => { otp = value; } });
    const entries = [{ ...first.users.admin, role: "ADMIN" },
      ...first.users.judges.map((entry) => ({ ...entry, role: "JUDGE" })),
      ...first.users.auxiliaries];
    for (const entry of entries) {
      const response = await testAuth.api.signInEmail({ body: { email: entry.email, password }, asResponse: true });
      assert.equal(response.status, 200);
      let headers = new Headers({ cookie: response.headers.getSetCookie().map((cookie) => cookie.split(";")[0]).join("; ") });
      let session = await testAuth.api.getSession({ headers });
      assert.notEqual(session.user.twoFactorEnabled, true);
      await testAuth.api.enableTwoFactor({ headers, body: { password } });
      await testAuth.api.sendTwoFactorOTP({ headers, body: {} });
      assert.match(otp, /^\d{6}$/);
      const verified = await testAuth.api.verifyTwoFactorOTP({ headers, body: { code: otp }, asResponse: true });
      assert.equal(verified.status, 200);
      headers = new Headers({ cookie: verified.headers.getSetCookie().map((cookie) => cookie.split(";")[0]).join("; ") });
      session = await testAuth.api.getSession({ headers });
      assert.equal(session.user.twoFactorEnabled, true);
      assert.equal(session.user.id, entry.userId);
      assert.deepEqual((await pool.query("SELECT role_code FROM user_role WHERE user_id=$1", [entry.userId])).rows,
        [{ role_code: entry.role }]);
    }
    const { rows } = await pool.query('SELECT count(*)::int AS n, count(DISTINCT secret)::int AS secrets FROM "twoFactor"');
    assert.deepEqual(rows, [{ n: 12, secrets: 12 }]);
  });
  await t.test("cambio de contraseña común revoca sesiones y conserva las doce identidades", async () => {
    const nextPassword = randomBytes(12).toString("hex");
    process.env.SEED_DEMO_PASSWORD = nextPassword;
    const result = await provisionUsers();
    assert.equal((await pool.query('SELECT count(*)::int AS n FROM session')).rows[0].n, 0);
    for (const entry of [result.admin, ...result.judges, ...result.auxiliaries]) {
      await assert.rejects(() => createOrVerifyCredentialUser({ email: entry.email, name: "Demo", password }), /ACCOUNT_ALREADY_EXISTS/);
      assert.equal((await createOrVerifyCredentialUser({ email: entry.email, name: "Demo", password: nextPassword })).created, false);
    }
  });
  await t.test("perfil suspendido rechaza antes de modificar credenciales", async () => {
    await pool.query("UPDATE judge_profile SET registration_status='SUSPENDED' WHERE id=$1", [first.users.judges[0].profileId]);
    const before = (await pool.query("SELECT id,password FROM account ORDER BY id")).rows;
    await assert.rejects(provisionUsers, /DEMO_PROFILE_SUSPENDED/);
    assert.deepEqual((await pool.query("SELECT id,password FROM account ORDER BY id")).rows, before);
    await pool.query("UPDATE judge_profile SET registration_status='REGISTERED' WHERE id=$1", [first.users.judges[0].profileId]);
  });
  await t.test("un perfil con DNI ajeno no se adopta ni modifica", async () => {
    const escribano = first.users.auxiliaries.find((entry) => entry.role === "ESCRIBANO");
    await pool.query("UPDATE operational_profile SET document_number='OTHER-DEMO-DOC' WHERE id=$1", [escribano.profileId]);
    await assert.rejects(provisionUsers, /DEMO_PROFILE_IDENTITY_CONFLICT/);
    await pool.query("UPDATE operational_profile SET document_number=$2 WHERE id=$1", [escribano.profileId, FULL_AUXILIARIES.find((entry) => entry.role === "ESCRIBANO").documentNumber]);
  });
});
