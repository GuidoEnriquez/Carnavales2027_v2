import assert from "node:assert/strict";
import test from "node:test";
import { toNodeHandler } from "better-auth/node";
import { createApp } from "../app.js";
import { closePool, getPool } from "../db/pool.js";
import { createCredentialUser } from "../auth/account-service.js";
import { createOtpDelivery, requireTwoFactor } from "../auth/two-factor.js";

const originalEnvironment = {
  DATABASE_URL: process.env.DATABASE_URL,
  BETTER_AUTH_SECRET: process.env.BETTER_AUTH_SECRET,
  BETTER_AUTH_URL: process.env.BETTER_AUTH_URL,
  NODE_ENV: process.env.NODE_ENV,
  EMAIL_PROVIDER: process.env.EMAIL_PROVIDER,
};

function restoreEnvironment() {
  for (const [name, value] of Object.entries(originalEnvironment)) {
    if (value === undefined) {
      delete process.env[name];
    } else {
      process.env[name] = value;
    }
  }
}

async function withServer(app, run) {
  const server = await new Promise((resolve) => {
    const instance = app.listen(0, "127.0.0.1", () => resolve(instance));
  });

  try {
    const address = server.address();
    await run(`http://127.0.0.1:${address.port}`);
  } finally {
    await new Promise((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
  }
}

test("requireTwoFactor rechaza una sesión sin 2FA verificado", () => {
  const response = {
    statusCode: null,
    payload: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.payload = payload;
      return this;
    },
  };

  let nextCalled = false;
  requireTwoFactor({ user: { twoFactorEnabled: false } }, response, () => {
    nextCalled = true;
  });

  assert.equal(nextCalled, false);
  assert.equal(response.statusCode, 403);
  assert.deepEqual(response.payload, { code: "TWO_FACTOR_REQUIRED" });
});

test("requireTwoFactor permite una sesión con 2FA verificado", () => {
  let nextCalled = false;

  requireTwoFactor({ user: { twoFactorEnabled: true } }, {}, () => {
    nextCalled = true;
  });

  assert.equal(nextCalled, true);
});

test("Better Auth monta el endpoint oficial para enviar OTP", {
  skip: !process.env.TEST_DATABASE_URL,
}, async (context) => {
  context.after(async () => {
    await closePool();
    restoreEnvironment();
  });

  process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;
  process.env.BETTER_AUTH_SECRET = "test-only-secret-that-is-long-enough-for-better-auth";
  process.env.BETTER_AUTH_URL = "http://127.0.0.1";
  process.env.NODE_ENV = "test";

  const { auth } = await import("../auth/auth.js");
  const app = createApp({ authHandler: toNodeHandler(auth) });

  await withServer(app, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/auth/two-factor/send-otp`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "{}",
    });

    assert.notEqual(response.status, 404);
  });
});

test("la entrega de OTP falla cerrada en producción sin SMTP", async () => {
  process.env.NODE_ENV = "production";
  delete process.env.EMAIL_PROVIDER;

  await assert.rejects(
    () => createOtpDelivery()({ user: { email: "admin@example.test" }, otp: "123456" }),
    /EMAIL_PROVIDER=smtp/,
  );

  restoreEnvironment();
});

test("verifica OTP cifrado, habilita 2FA y rota la sesión", {
  skip: !process.env.TEST_DATABASE_URL,
}, async (context) => {
  context.after(async () => {
    await closePool();
    restoreEnvironment();
  });

  process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;
  process.env.BETTER_AUTH_SECRET = "test-only-secret-that-is-long-enough-for-better-auth";
  process.env.BETTER_AUTH_URL = "http://127.0.0.1";
  process.env.NODE_ENV = "test";

  let deliveredOtp;
  const { createAuth } = await import("../auth/auth.js");
  const auth = createAuth({
    sendOtp: async ({ otp }) => {
      deliveredOtp = otp;
    },
  });
  const email = `otp-${Date.now()}@example.test`;
  await createCredentialUser({
    authInstance: auth,
    name: "OTP Test",
    email,
    password: "TestPassword-2026!",
  });
  const signInResponse = await auth.api.signInEmail({
    body: { email, password: "TestPassword-2026!" },
    asResponse: true,
  });
  const cookie = signInResponse.headers.get("set-cookie").split(";")[0];
  const session = await auth.api.getSession({ headers: new Headers({ cookie }) });

  await auth.api.enableTwoFactor({
    body: { password: "TestPassword-2026!" },
    headers: new Headers({ cookie }),
  });
  await auth.api.sendTwoFactorOTP({
    body: {},
    headers: new Headers({ cookie }),
  });

  assert.match(deliveredOtp, /^\d{6}$/);

  const { rows: verificationRows } = await getPool().query(
    `SELECT value FROM verification WHERE identifier LIKE '2fa-otp-%' ORDER BY "createdAt" DESC LIMIT 1`,
  );
  assert.equal(verificationRows.length, 1);
  assert.doesNotMatch(verificationRows[0].value, new RegExp(deliveredOtp));

  await auth.api.verifyTwoFactorOTP({
    body: { code: deliveredOtp },
    headers: new Headers({ cookie }),
  });

  const { rows: userRows } = await getPool().query(
    `SELECT "twoFactorEnabled" FROM "user" WHERE id = $1`,
    [session.user.id],
  );
  const { rows: sessionRows } = await getPool().query(
    `SELECT id FROM session WHERE "userId" = $1`,
    [session.user.id],
  );
  const { rows: twoFactorRows } = await getPool().query(
    `SELECT id FROM "twoFactor" WHERE "userId" = $1`,
    [session.user.id],
  );

  assert.equal(userRows[0].twoFactorEnabled, true);
  assert.equal(twoFactorRows.length, 1);
  assert.equal(sessionRows.length, 1);
});
