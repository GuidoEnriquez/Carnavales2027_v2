import assert from "node:assert/strict";
import { once } from "node:events";
import test from "node:test";
import { createApp } from "../app.js";
import {
  createAuthGeneralRateLimiter,
  createAuthRateLimiter,
  createGeneralApiRateLimiter,
  createInvitationRateLimiter,
} from "../auth/rate-limiter.js";

async function startAuthApp(context, options = {}) {
  const previous = {
    TRUST_PROXY: process.env.TRUST_PROXY,
    ENABLE_RATE_LIMIT_TESTS: process.env.ENABLE_RATE_LIMIT_TESTS,
  };
  process.env.TRUST_PROXY = "1"; // Test server represents one trusted proxy hop.
  process.env.ENABLE_RATE_LIMIT_TESTS = "true";
  context.after(() => {
    for (const [name, value] of Object.entries(previous)) {
      if (value === undefined) delete process.env[name];
      else process.env[name] = value;
    }
  });
  const app = createApp({ authHandler: (_req, res) => res.json({ ok: true }), ...options });
  const server = app.listen(0, "127.0.0.1");
  await once(server, "listening");
  context.after(() => new Promise((resolve) => server.close(resolve)));
  const baseUrl = `http://127.0.0.1:${server.address().port}`;
  return (path, options) => fetch(`${baseUrl}${path}`, options);
}

test("GET/HEAD de sesión no consumen el cupo sensible, incluso después de agotarlo", async (context) => {
  const request = await startAuthApp(context);
  for (const method of ["GET", "HEAD"]) {
    for (let index = 0; index < 11; index++) {
      const response = await request("/api/auth/get-session?fresh=1", { method });
      assert.equal(response.status, 200);
      assert.equal(response.headers.get("ratelimit-limit"), "300");
    }
  }
  for (let index = 0; index < 10; index++) {
    const path = index % 2 ? "/api/auth/two-factor/send-otp" : "/api/auth/sign-in/email";
    assert.equal((await request(path, { method: "POST" })).status, 200);
  }
  const blocked = await request("/api/auth/two-factor/verify-otp", { method: "POST" });
  assert.equal(blocked.status, 429);
  assert.equal((await blocked.json()).code, "RATE_LIMIT_EXCEEDED");
  assert.equal(blocked.headers.get("ratelimit-limit"), "10");
  assert.ok(Number(blocked.headers.get("retry-after")) > 0);
  for (const method of ["GET", "HEAD"]) {
    assert.equal((await request("/api/auth/get-session", { method })).status, 200);
  }
});

test("solo el pathname y métodos exactos de lectura reciben la excepción", async (context) => {
  const request = await startAuthApp(context, {
    authRateLimiter: createAuthRateLimiter({ limit: 1, skip: () => false }),
  });
  assert.equal((await request("/api/auth/sign-in/email", { method: "POST" })).status, 200);
  for (const [path, method] of [
    ["/api/auth/get-session", "POST"],
    ["/api/auth/get-session", "OPTIONS"],
    ["/api/auth/get-session/extra", "GET"],
    ["/api/auth/get-session/", "GET"],
    ["/api/auth/GET-SESSION", "GET"],
    ["/api/auth/%67et-session", "GET"],
    ["/api/auth/sign-out", "POST"],
  ]) {
    assert.equal((await request(path, { method })).status, 429, `${method} ${path}`);
  }
  assert.equal((await request("/api/auth/get-session?refresh=true")).status, 200);
});

test("el límite general de auth bloquea la lectura número 301 con 429", async (context) => {
  const request = await startAuthApp(context);
  for (let index = 0; index < 300; index++) {
    assert.equal((await request("/api/auth/get-session")).status, 200);
  }
  const blocked = await request("/api/auth/get-session");
  assert.equal(blocked.status, 429);
  assert.equal(blocked.headers.get("ratelimit-limit"), "300");
  assert.ok(blocked.headers.has("retry-after"));
  assert.equal((await blocked.json()).code, "RATE_LIMIT_EXCEEDED");
});

test("los contadores sensible y general distinguen IP a través del proxy confiable", async (context) => {
  const request = await startAuthApp(context, {
    authRateLimiter: createAuthRateLimiter({ limit: 1, skip: () => false }),
    authGeneralRateLimiter: createAuthGeneralRateLimiter({ limit: 3, skip: () => false }),
  });
  const first = { headers: { "X-Forwarded-For": "192.0.2.10" } };
  const second = { headers: { "X-Forwarded-For": "192.0.2.20" } };
  assert.equal((await request("/api/auth/sign-in/email", first)).status, 200);
  assert.equal((await request("/api/auth/sign-in/email", first)).status, 429);
  assert.equal((await request("/api/auth/sign-in/email", second)).status, 200);
  assert.equal((await request("/api/auth/get-session", first)).status, 200);
  assert.equal((await request("/api/auth/get-session", first)).status, 429);
  assert.equal((await request("/api/auth/get-session", second)).status, 200);
});

test("auth, API general e invitaciones mantienen contadores independientes", async (context) => {
  const request = await startAuthApp(context, {
    authGeneralRateLimiter: createAuthGeneralRateLimiter({ limit: 1, skip: () => false }),
    generalApiRateLimiter: createGeneralApiRateLimiter({ limit: 3, skip: () => false }),
    invitationRateLimiter: createInvitationRateLimiter({ limit: 1, skip: () => false }),
  });
  assert.equal((await request("/api/auth/get-session")).status, 200);
  assert.equal((await request("/api/auth/get-session")).status, 429);
  // Unmatched routes exercise middleware without invoking a database handler.
  assert.equal((await request("/api/v1/judge-invitations/rate-limit-probe")).status, 404);
  assert.equal((await request("/api/v1/judge-invitations/rate-limit-probe")).status, 429);
  assert.equal((await request("/api/v1/rate-limit-probe")).status, 404);
  assert.equal((await request("/api/v1/rate-limit-probe")).status, 429);
});
