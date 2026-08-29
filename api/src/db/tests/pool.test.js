import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import { closePool, getPool } from "../pool.js";

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

test("getPool rechaza una configuración sin DATABASE_URL", async () => {
  delete process.env.DATABASE_URL;

  assert.throws(
    () => getPool(),
    /DATABASE_URL no está definida/,
  );
});

test("getPool conecta usando TEST_DATABASE_URL", {
  skip: !process.env.TEST_DATABASE_URL,
}, async () => {
  process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;

  const { rows } = await getPool().query("SELECT current_database() AS name");

  assert.equal(rows[0].name, new URL(process.env.TEST_DATABASE_URL).pathname.slice(1));
});
