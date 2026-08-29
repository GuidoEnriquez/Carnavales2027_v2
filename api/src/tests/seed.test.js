import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import { seedDevelopmentAdmin } from "../db/seed.js";
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

test("el seed de desarrollo crea o reutiliza un ADMIN y registra auditoría", {
  skip: !process.env.TEST_DATABASE_URL,
}, async (context) => {
  const email = `seed-${randomUUID()}@example.test`;

  context.after(async () => {
    if (process.env.DATABASE_URL) {
      await getPool().query('DELETE FROM "user" WHERE email = $1', [email]);
    }
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
    nodeEnv: "test",
    email,
    name: "Seed Administrator",
    password: "SeedPassword-2026!",
  };
  const firstRun = await seedDevelopmentAdmin({ config });
  const secondRun = await seedDevelopmentAdmin({ config });

  assert.equal(firstRun.createdUser, true);
  assert.equal(firstRun.grantedAdminRole, true);
  assert.equal(secondRun.createdUser, false);
  assert.equal(secondRun.grantedAdminRole, false);
  assert.equal(secondRun.user.id, firstRun.user.id);

  const { rows: roleRows } = await getPool().query(
    "SELECT role_code FROM user_role WHERE user_id = $1",
    [firstRun.user.id],
  );
  assert.deepEqual(roleRows, [{ role_code: "ADMIN" }]);

  const { rows: auditRows } = await getPool().query(
    `SELECT action, entity_type, entity_id, after_data
     FROM audit_event
     WHERE entity_type = 'user_role' AND entity_id = $1`,
    [firstRun.user.id],
  );
  assert.deepEqual(auditRows, [{
    action: "USER_ROLE_GRANTED",
    entity_type: "user_role",
    entity_id: firstRun.user.id,
    after_data: { roleCode: "ADMIN" },
  }]);
});

test("el seed de ADMIN rechaza producción", () => {
  assert.rejects(
    () => seedDevelopmentAdmin({
      config: {
        nodeEnv: "production",
        email: "admin@example.test",
        name: "Admin",
        password: "password",
      },
    }),
    /SEED_ADMIN_FORBIDDEN_IN_PRODUCTION/,
  );
});
