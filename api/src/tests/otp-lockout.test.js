import assert from "node:assert/strict";
import test from "node:test";
import { closePool, getPool } from "../db/pool.js";
import { createCredentialUser } from "../auth/account-service.js";

const originalEnvironment = {
  DATABASE_URL: process.env.DATABASE_URL,
  BETTER_AUTH_SECRET: process.env.BETTER_AUTH_SECRET,
  BETTER_AUTH_URL: process.env.BETTER_AUTH_URL,
  NODE_ENV: process.env.NODE_ENV,
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

test("Better Auth bloquea la cuenta 15 minutos tras 10 intentos fallidos de OTP en login (NIST SP 800-63B)", {
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
  const email = `lockout-${Date.now()}@example.test`;
  await createCredentialUser({
    authInstance: auth,
    name: "Lockout Test",
    email,
    password: "TestPassword-2026!",
  });

  // 1. Iniciar sesión para habilitar 2FA
  const setupSignIn = await auth.api.signInEmail({
    body: { email, password: "TestPassword-2026!" },
    asResponse: true,
  });
  const setupCookie = setupSignIn.headers.get("set-cookie").split(";")[0];

  await auth.api.enableTwoFactor({
    body: { password: "TestPassword-2026!" },
    headers: new Headers({ cookie: setupCookie }),
  });
  await auth.api.sendTwoFactorOTP({
    body: {},
    headers: new Headers({ cookie: setupCookie }),
  });
  await auth.api.verifyTwoFactorOTP({
    body: { code: deliveredOtp },
    headers: new Headers({ cookie: setupCookie }),
  });

  // 2. Ahora iniciar sesión como usuario con 2FA habilitado (flujo real de login)
  const loginResponse = await auth.api.signInEmail({
    body: { email, password: "TestPassword-2026!" },
    asResponse: true,
  });
  const loginBody = await loginResponse.json();
  assert.equal(loginBody.twoFactorRedirect, true);

  // El cookie devuelto incluye better-auth.two_factor
  const twoFactorCookie = loginResponse.headers.getSetCookie().map((c) => c.split(";")[0]).join("; ");

  // 3. Reintentar con código OTP inválido hasta alcanzar el límite
  // Note: cada código OTP tiene su propio allowedAttempts (5 por código),
  // por lo que enviamos un nuevo OTP si expira el intento del código
  let failureCount = 0;
  while (failureCount < 10) {
    await auth.api.sendTwoFactorOTP({
      body: {},
      headers: new Headers({ cookie: twoFactorCookie }),
    });

    for (let attempt = 0; attempt < 5 && failureCount < 10; attempt++) {
      try {
        await auth.api.verifyTwoFactorOTP({
          body: { code: "000000" },
          headers: new Headers({ cookie: twoFactorCookie }),
        });
        assert.fail("Debió fallar con código erróneo");
      } catch (err) {
        failureCount++;
      }
    }
  }

  // 4. Verificar en base de datos que lockedUntil está seteado en el futuro
  const { rows } = await getPool().query(
    `SELECT tf."failedVerificationCount", tf."lockedUntil"
       FROM "twoFactor" tf
       JOIN "user" u ON u.id = tf."userId"
      WHERE u.email = $1`,
    [email],
  );
  assert.equal(rows.length, 1);
  assert.ok(rows[0].failedVerificationCount >= 10);
  assert.ok(rows[0].lockedUntil instanceof Date);
  assert.ok(rows[0].lockedUntil.getTime() > Date.now());

  // 5. El siguiente intento durante el bloqueo debe ser rechazado con 429
  try {
    await auth.api.verifyTwoFactorOTP({
      body: { code: "000000" },
      headers: new Headers({ cookie: twoFactorCookie }),
    });
    assert.fail("Debió lanzar error de cuenta bloqueada");
  } catch (err) {
    assert.ok(err.status === "TOO_MANY_REQUESTS" || err.statusCode === 429);
  }
});
