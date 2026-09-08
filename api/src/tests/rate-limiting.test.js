import test from "node:test";
import assert from "node:assert/strict";
import { createApp } from "../app.js";
import { createAuthRateLimiter, createInvitationRateLimiter } from "../auth/rate-limiter.js";

test("Rate limiter en /api/auth bloquea tras superar el límite con 429 y Retry-After", async () => {
  const customAuthLimiter = createAuthRateLimiter({
    limit: 3,
    windowMs: 60 * 1000,
    skip: () => false,
  });

  const app = createApp({
    authRateLimiter: customAuthLimiter,
    authHandler: (_req, res) => res.json({ ok: true }),
  });
  const server = app.listen(0);
  const { port } = server.address();

  try {
    for (let i = 0; i < 3; i++) {
      const res = await fetch(`http://127.0.0.1:${port}/api/auth/sign-in`);
      assert.equal(res.status, 200);
    }

    const blocked = await fetch(`http://127.0.0.1:${port}/api/auth/sign-in`);
    assert.equal(blocked.status, 429);
    assert.ok(blocked.headers.has("retry-after"));
    const body = await blocked.json();
    assert.equal(body.code, "RATE_LIMIT_EXCEEDED");
  } finally {
    server.close();
  }
});

test("Rate limiter en /api/v1/judge-invitations bloquea solicitudes excesivas con 429", async () => {
  const customInvitationLimiter = createInvitationRateLimiter({
    limit: 3,
    windowMs: 60 * 1000,
    skip: () => false,
  });

  const app = createApp({
    invitationRateLimiter: customInvitationLimiter,
  });
  const server = app.listen(0);
  const { port } = server.address();

  try {
    for (let i = 0; i < 3; i++) {
      const res = await fetch(`http://127.0.0.1:${port}/api/v1/judge-invitations/inspect`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Origin: process.env.FRONTEND_URL || "http://localhost:5173",
        },
        body: JSON.stringify({ secret: "invalid-secret" }),
      });
      // 400 because invalid secret, but not 429
      assert.equal(res.status, 400);
    }

    const blocked = await fetch(`http://127.0.0.1:${port}/api/v1/judge-invitations/inspect`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Origin: process.env.FRONTEND_URL || "http://localhost:5173",
      },
      body: JSON.stringify({ secret: "invalid-secret" }),
    });

    assert.equal(blocked.status, 429);
    assert.ok(blocked.headers.has("retry-after"));
    const body = await blocked.json();
    assert.equal(body.code, "RATE_LIMIT_EXCEEDED");
  } finally {
    server.close();
  }
});
