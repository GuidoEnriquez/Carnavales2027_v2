import "dotenv/config";
import { createHash } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { closePool, getPool } from "./pool.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const migrationsDirectory = path.join(__dirname, "migrations");
const migrationLockKey = "carnavales2027_v2_migrations";

function checksum(content) {
  return createHash("sha256").update(content).digest("hex");
}

async function loadMigrations() {
  const filenames = (await readdir(migrationsDirectory))
    .filter((filename) => /^\d+_.+\.sql$/.test(filename))
    .sort();

  return Promise.all(filenames.map(async (filename) => {
    const content = await readFile(path.join(migrationsDirectory, filename), "utf8");
    const [version] = filename.split("_");

    return {
      filename,
      version,
      content,
      checksum: checksum(content),
    };
  }));
}

async function ensureMigrationTable(client) {
  await client.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version TEXT PRIMARY KEY,
      filename TEXT NOT NULL UNIQUE,
      checksum TEXT NOT NULL,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);
}

export async function migrate() {
  const client = await getPool().connect();

  try {
    await client.query("SELECT pg_advisory_lock(hashtext($1))", [migrationLockKey]);
    await ensureMigrationTable(client);

    const migrations = await loadMigrations();
    const { rows: appliedRows } = await client.query(
      "SELECT version, checksum FROM schema_migrations",
    );
    const appliedByVersion = new Map(appliedRows.map((row) => [row.version, row]));
    const applied = [];

    for (const migration of migrations) {
      const existing = appliedByVersion.get(migration.version);

      if (existing) {
        if (existing.checksum !== migration.checksum) {
          throw new Error(`MIGRATION_CHECKSUM_MISMATCH: ${migration.filename}`);
        }
        continue;
      }

      await client.query("BEGIN");
      try {
        await client.query(migration.content);
        await client.query(
          `INSERT INTO schema_migrations (version, filename, checksum)
           VALUES ($1, $2, $3)`,
          [migration.version, migration.filename, migration.checksum],
        );
        await client.query("COMMIT");
        applied.push(migration.filename);
      } catch (error) {
        await client.query("ROLLBACK");
        throw error;
      }
    }

    return { applied };
  } finally {
    await client.query("SELECT pg_advisory_unlock(hashtext($1))", [migrationLockKey]);
    client.release();
  }
}

export async function getMigrationStatus() {
  const migrations = await loadMigrations();
  const client = await getPool().connect();

  try {
    const { rows: tableRows } = await client.query(
      "SELECT to_regclass('public.schema_migrations') AS table_name",
    );
    const appliedByVersion = new Map();

    if (tableRows[0].table_name) {
      const { rows } = await client.query("SELECT version, checksum FROM schema_migrations");
      for (const row of rows) {
        appliedByVersion.set(row.version, row);
      }
    }

    return migrations.map((migration) => {
      const applied = appliedByVersion.get(migration.version);

      if (applied && applied.checksum !== migration.checksum) {
        throw new Error(`MIGRATION_CHECKSUM_MISMATCH: ${migration.filename}`);
      }

      return {
        filename: migration.filename,
        version: migration.version,
        applied: Boolean(applied),
      };
    });
  } finally {
    client.release();
  }
}

async function main() {
  try {
    if (process.argv.includes("--status")) {
      const status = await getMigrationStatus();
      for (const migration of status) {
        console.log(`${migration.applied ? "applied" : "pending"} ${migration.filename}`);
      }
      return;
    }

    const { applied } = await migrate();
    console.log(applied.length === 0 ? "No pending migrations" : `Applied: ${applied.join(", ")}`);
  } finally {
    await closePool();
  }
}

const isMainModule = process.argv[1]
  && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isMainModule) {
  main().catch((error) => {
    console.error("Migration failed:", error.message);
    process.exitCode = 1;
  });
}
