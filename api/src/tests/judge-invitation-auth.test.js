import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import { toNodeHandler } from "better-auth/node";
import { createApp } from "../app.js";
import { createOrVerifyCredentialUser } from "../auth/account-service.js";
import { closePool, getPool } from "../db/pool.js";
import { migrate } from "../db/migrate.js";
import { createJudge, reactivateJudge, suspendJudge } from "../modules/judges/judge-service.js";

test("una invitación real crea credenciales, exige OTP y habilita una sesión JUDGE", {
  skip: !process.env.TEST_DATABASE_URL,
}, async (context) => {
  const originalEnvironment = {
    DATABASE_URL: process.env.DATABASE_URL,
    BETTER_AUTH_SECRET: process.env.BETTER_AUTH_SECRET,
    BETTER_AUTH_URL: process.env.BETTER_AUTH_URL,
    NODE_ENV: process.env.NODE_ENV,
    DB_POOL_MAX: process.env.DB_POOL_MAX,
  };
  context.after(async () => {
    await closePool();
    for (const [name, value] of Object.entries(originalEnvironment)) {
      if (value === undefined) delete process.env[name];
      else process.env[name] = value;
    }
  });
  process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;
  process.env.BETTER_AUTH_SECRET = "test-only-secret-that-is-long-enough-for-better-auth";
  process.env.BETTER_AUTH_URL = "http://127.0.0.1";
  process.env.NODE_ENV = "test";
  process.env.DB_POOL_MAX = "1";
  await migrate();

  let otp;
  const { createAuth } = await import("../auth/auth.js");
  const testAuth = createAuth({ sendOtp: async ({ otp: value }) => { otp = value; } });
  const adminId = randomUUID();
  await getPool().query(
    `INSERT INTO "user"(id, name, email, "emailVerified") VALUES ($1, 'Admin real', $2, true)`,
    [adminId, `${adminId}@example.test`],
  );
  await getPool().query("INSERT INTO user_role(user_id, role_code) VALUES($1,'ADMIN')", [adminId]);
  let invitationSecret;
  const email = `real-judge-${randomUUID()}@example.test`;
  await createJudge({
    actorUserId: adminId,
    name: "Jurado Real",
    email,
    documentNumber: randomUUID(),
    sendInvitation: async ({ secret }) => { invitationSecret = secret; },
  });

  const app = createApp({
    authHandler: toNodeHandler(testAuth),
    getSession: testAuth.api.getSession,
    createUser: (input) => createOrVerifyCredentialUser({ ...input, authInstance: testAuth }),
  });
  const server = await new Promise((resolve) => {
    const instance = app.listen(0, "127.0.0.1", () => resolve(instance));
  });
  try {
    const base = `http://127.0.0.1:${server.address().port}`;
    const password = "RealJudgePassword-2026!";
    const accepted = await fetch(`${base}/api/v1/judge-invitations/accept`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ secret: invitationSecret, password }),
    });
    assert.equal(accepted.status, 201);

    const signedIn = await fetch(`${base}/api/auth/sign-in/email`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    assert.equal(signedIn.status, 200);
    let cookie = signedIn.headers.get("set-cookie").split(";")[0];

    const beforeOtp = await fetch(`${base}/api/v1/me`, { headers: { cookie } });
    assert.equal(beforeOtp.status, 403);
    await fetch(`${base}/api/auth/two-factor/enable`, {
      method: "POST",
      headers: { "content-type": "application/json", cookie },
      body: JSON.stringify({ password }),
    });
    await fetch(`${base}/api/auth/two-factor/send-otp`, {
      method: "POST",
      headers: { "content-type": "application/json", cookie },
      body: "{}",
    });
    assert.match(otp, /^\d{6}$/);
    const verified = await fetch(`${base}/api/auth/two-factor/verify-otp`, {
      method: "POST",
      headers: { "content-type": "application/json", cookie },
      body: JSON.stringify({ code: otp }),
    });
    assert.equal(verified.status, 200);
    cookie = verified.headers.get("set-cookie").split(";")[0];

    const me = await fetch(`${base}/api/v1/me`, { headers: { cookie } });
    assert.equal(me.status, 200);
    const body = await me.json();
    assert.deepEqual(body.roles, ["JUDGE"]);
    assert.equal(body.judgeProfile.registrationStatus, "REGISTERED");
    const profile = await fetch(`${base}/api/v1/judge/profile`, { headers: { cookie } });
    assert.equal(profile.status, 200);
    assert.deepEqual((await profile.json()).assignments, []);

    await suspendJudge({ actorUserId: adminId, judgeProfileId: body.judgeProfile.id });
    await reactivateJudge({ actorUserId: adminId, judgeProfileId: body.judgeProfile.id });
    const { rows: profileRows } = await getPool().query(
      "SELECT registration_status FROM judge_profile WHERE id = $1",
      [body.judgeProfile.id],
    );
    assert.equal(profileRows[0].registration_status, "REGISTERED");
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});
