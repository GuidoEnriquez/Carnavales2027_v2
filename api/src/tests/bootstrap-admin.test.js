import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import {
  bootstrapFirstAdmin,
  getBootstrapConfig,
} from "../scripts/bootstrap-admin.js";
import { closePool, getPool } from "../db/pool.js";
import { migrate } from "../db/migrate.js";

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

test("el bootstrap de producción crea una sola vez el primer ADMIN y lo audita", {
  skip: !process.env.TEST_DATABASE_URL,
}, async (context) => {
  const email = `bootstrap-${randomUUID()}@example.test`;

  context.after(async () => {
    await closePool();
    restoreEnvironment();
  });

  process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;
  process.env.BETTER_AUTH_SECRET = "test-only-secret-that-is-long-enough-for-better-auth";
  process.env.BETTER_AUTH_URL = "http://127.0.0.1";
  process.env.NODE_ENV = "test";
  process.env.EMAIL_PROVIDER = "console";
  await migrate();

  const config = {
    nodeEnv: "production",
    email,
    name: "Initial Administrator",
    password: "BootstrapPassword-2026!",
  };
  const { rows: existingBootstrapRows } = await getPool().query(
    "SELECT initial_admin_user_id FROM bootstrap_state WHERE singleton = true",
  );

  if (existingBootstrapRows.length > 0) {
    await assert.rejects(
      () => bootstrapFirstAdmin({ config }),
      /BOOTSTRAP_ALREADY_COMPLETED/,
    );
    return;
  }

  const result = await bootstrapFirstAdmin({ config });

  assert.equal(result.created, true);
  assert.equal(result.user.email, email);
  const { rows: bootstrapRows } = await getPool().query(
    `SELECT initial_admin_user_id
     FROM bootstrap_state
     WHERE singleton = true`,
  );
  assert.equal(bootstrapRows.length, 1);
  assert.equal(bootstrapRows[0].initial_admin_user_id, result.user.id);

  const { rows: roleRows } = await getPool().query(
    "SELECT role_code FROM user_role WHERE user_id = $1",
    [result.user.id],
  );
  assert.deepEqual(roleRows, [{ role_code: "ADMIN" }]);

  const { rows: auditRows } = await getPool().query(
    `SELECT actor_user_id, action, entity_type, entity_id, after_data
     FROM audit_event
     WHERE entity_type = 'user_role' AND entity_id = $1`,
    [result.user.id],
  );
  assert.deepEqual(auditRows, [{
    actor_user_id: null,
    action: "USER_ROLE_GRANTED",
    entity_type: "user_role",
    entity_id: result.user.id,
    after_data: { roleCode: "ADMIN" },
  }]);

  await assert.rejects(
    () => bootstrapFirstAdmin({ config }),
    /BOOTSTRAP_ALREADY_COMPLETED/,
  );
});

test("el bootstrap falla sin configuración explícita de producción", () => {
  assert.throws(
    () => getBootstrapConfig({ NODE_ENV: "production" }),
    /BOOTSTRAP_ADMIN_EMAIL no está definida/,
  );
  assert.throws(
    () => getBootstrapConfig({
      NODE_ENV: "development",
      BOOTSTRAP_ADMIN_EMAIL: "admin@example.test",
      BOOTSTRAP_ADMIN_NAME: "Admin",
      BOOTSTRAP_ADMIN_PASSWORD: "password",
    }),
    /NODE_ENV=production/,
  );
});
