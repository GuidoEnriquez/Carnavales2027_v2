import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import { closePool } from "../pool.js";
import { getMigrationStatus, migrate } from "../migrate.js";

const originalDatabaseUrl = process.env.DATABASE_URL;

function restoreDatabaseUrl() {
  if (originalDatabaseUrl === undefined) {
    delete process.env.DATABASE_URL;
    return;
  }

  process.env.DATABASE_URL = originalDatabaseUrl;
}

afterEach(async () => {
  await closePool();
  restoreDatabaseUrl();
});

test("aplica migraciones pendientes una vez y conserva su estado", {
  skip: !process.env.TEST_DATABASE_URL,
}, async () => {
  process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;

  const firstRun = await migrate();
  assert.ok(firstRun.applied.every((filename) => (
    filename === "001_extensions.sql"
    || filename === "002_authorization.sql"
    || filename === "003_audit.sql"
    || filename === "004_bootstrap.sql"
    || filename === "005_last_admin_guard.sql"
    || filename === "006_last_admin_update_guard.sql"
  )));

  const status = await getMigrationStatus();
  assert.deepEqual(status, [
    {
      filename: "001_extensions.sql",
      version: "001",
      applied: true,
    },
    {
      filename: "002_authorization.sql",
      version: "002",
      applied: true,
    },
    {
      filename: "003_audit.sql",
      version: "003",
      applied: true,
    },
    {
      filename: "004_bootstrap.sql",
      version: "004",
      applied: true,
    },
    {
      filename: "005_last_admin_guard.sql",
      version: "005",
      applied: true,
    },
    {
      filename: "006_last_admin_update_guard.sql",
      version: "006",
      applied: true,
    },
  ]);

  const secondRun = await migrate();
  assert.deepEqual(secondRun.applied, []);
});
