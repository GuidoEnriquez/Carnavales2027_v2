import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import { createApp } from "../app.js";
import { closePool, getPool } from "../db/pool.js";
import { migrate } from "../db/migrate.js";

const originalDatabaseUrl = process.env.DATABASE_URL;

function restoreDatabaseUrl() {
  if (originalDatabaseUrl === undefined) {
    delete process.env.DATABASE_URL;
    return;
  }

  process.env.DATABASE_URL = originalDatabaseUrl;
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

test("GET /api/v1/me exige sesión 2FA y devuelve roles sin exigir ADMIN", {
  skip: !process.env.TEST_DATABASE_URL,
}, async (context) => {
  context.after(async () => {
    await closePool();
    restoreDatabaseUrl();
  });

  process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;
  await migrate();

  const userId = randomUUID();
  const adminId = randomUUID();
  const pool = getPool();
  await pool.query(
    `INSERT INTO "user" (id, name, email, "emailVerified")
     VALUES ($1, $2, $3, $4), ($5, $6, $7, $8)`,
    [
      userId,
      "User without admin",
      `${userId}@example.test`,
      true,
      adminId,
      "Administrator",
      `${adminId}@example.test`,
      true,
    ],
  );
  await pool.query(
    "INSERT INTO user_role (user_id, role_code) VALUES ($1, 'ADMIN')",
    [adminId],
  );

  const sessions = {
    userWithoutTwoFactor: {
      user: { id: userId, email: `${userId}@example.test`, name: "User without admin", twoFactorEnabled: false },
    },
    userWithoutAdmin: {
      user: { id: userId, email: `${userId}@example.test`, name: "User without admin", twoFactorEnabled: true },
    },
    admin: {
      user: { id: adminId, email: `${adminId}@example.test`, name: "Administrator", twoFactorEnabled: true },
    },
  };
  const app = createApp({
    getSession: async ({ headers }) => sessions[headers.get("x-test-session")] ?? null,
  });

  await withServer(app, async (baseUrl) => {
    const anonymous = await fetch(`${baseUrl}/api/v1/me`);
    assert.equal(anonymous.status, 401);
    assert.deepEqual(await anonymous.json(), { code: "UNAUTHENTICATED" });

    const missingTwoFactor = await fetch(`${baseUrl}/api/v1/me`, {
      headers: { "x-test-session": "userWithoutTwoFactor" },
    });
    assert.equal(missingTwoFactor.status, 403);
    assert.deepEqual(await missingTwoFactor.json(), { code: "TWO_FACTOR_REQUIRED" });

    const missingRole = await fetch(`${baseUrl}/api/v1/me`, {
      headers: { "x-test-session": "userWithoutAdmin" },
    });
    assert.equal(missingRole.status, 200);
    assert.deepEqual(await missingRole.json(), {
      user: {
        id: userId,
        email: `${userId}@example.test`,
        name: "User without admin",
      },
      roles: [],
      judgeProfile: null,
    });

    const admin = await fetch(`${baseUrl}/api/v1/me`, {
      headers: { "x-test-session": "admin" },
    });
    assert.equal(admin.status, 200);
    assert.deepEqual(await admin.json(), {
      user: {
        id: adminId,
        email: `${adminId}@example.test`,
        name: "Administrator",
      },
      roles: ["ADMIN"],
      judgeProfile: null,
    });
  });
});
