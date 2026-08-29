import assert from "node:assert/strict";
import test from "node:test";
import { toNodeHandler } from "better-auth/node";
import { createApp } from "../app.js";
import { closePool } from "../db/pool.js";

const originalEnvironment = {
  DATABASE_URL: process.env.DATABASE_URL,
  BETTER_AUTH_SECRET: process.env.BETTER_AUTH_SECRET,
  BETTER_AUTH_URL: process.env.BETTER_AUTH_URL,
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

test("monta la consulta de sesión de Better Auth sin exponer secretos", {
  skip: !process.env.TEST_DATABASE_URL,
}, async (context) => {
  context.after(async () => {
    await closePool();
    restoreEnvironment();
  });

  process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;
  process.env.BETTER_AUTH_SECRET = "test-only-secret-that-is-long-enough-for-better-auth";
  process.env.BETTER_AUTH_URL = "http://127.0.0.1";

  const { auth } = await import("../auth/auth.js");
  const app = createApp({ authHandler: toNodeHandler(auth) });

  await withServer(app, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/auth/get-session`);
    const body = await response.text();

    assert.equal(response.status, 200);
    assert.doesNotMatch(body, /test-only-secret/);
  });
});
