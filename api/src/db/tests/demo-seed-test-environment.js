import { randomBytes, randomUUID } from "node:crypto";
import pg from "pg";
import { getMigrations } from "better-auth/db/migration";
import { closePool, getPool } from "../pool.js";

export async function prepareDemoSeedTest(t) {
  const keys = ["DATABASE_URL", "NODE_ENV", "BETTER_AUTH_SECRET", "BETTER_AUTH_URL", "EMAIL_PROVIDER",
    "DB_POOL_MAX", "SEED_ADMIN_EMAIL", "SEED_ADMIN_NAME", "SEED_ADMIN_PASSWORD", "SEED_DEMO_PASSWORD"];
  const original = Object.fromEntries(keys.map((key) => [key, process.env[key]]));
  const control = new pg.Client({ connectionString: process.env.TEST_DATABASE_URL });
  await control.connect();
  t.after(async () => {
    await closePool();
    await control.end();
    for (const [key, value] of Object.entries(original)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  });
  // Migration 031 searches constraint names database-wide, so use a fresh DB.
  // No DROP or deletion of historical fixtures; retain the DB as evidence.
  const database = `demo_seed_test_${randomUUID().replaceAll("-", "")}`;
  await control.query(`CREATE DATABASE ${database}`);
  t.diagnostic(`Base de evidencia conservada: ${database}`);
  const url = new URL(process.env.TEST_DATABASE_URL);
  url.pathname = `/${database}`;
  url.searchParams.delete("options");
  process.env.DATABASE_URL = url.toString();
  process.env.NODE_ENV = "test";
  process.env.DB_POOL_MAX = "1";
  process.env.BETTER_AUTH_SECRET = randomBytes(32).toString("hex");
  process.env.BETTER_AUTH_URL = "http://localhost:3000";
  process.env.EMAIL_PROVIDER = "console";
  process.env.SEED_ADMIN_EMAIL = "demo.admin@example.test";
  process.env.SEED_ADMIN_NAME = "Admin Demo";
  const password = randomBytes(12).toString("hex");
  process.env.SEED_DEMO_PASSWORD = password;
  delete process.env.SEED_ADMIN_PASSWORD;
  const { auth, createAuth } = await import("../../auth/auth.js");
  await (await getMigrations(auth.options)).runMigrations();
  return { pool: getPool(), password, createAuth };
}
