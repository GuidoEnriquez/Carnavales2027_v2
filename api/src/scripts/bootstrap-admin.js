import "dotenv/config";
import { fileURLToPath } from "node:url";
import { grantRole } from "../auth/role-service.js";
import { createCredentialUser } from "../auth/account-service.js";
import { closePool, getPool } from "../db/pool.js";

const bootstrapLockKey = "carnavales2027_v2_bootstrap_admin";

function requireEnvironment(environment, name) {
  const value = environment[name];

  if (!value) {
    throw new Error(`${name} no está definida.`);
  }

  return value;
}

export function getBootstrapConfig(environment = process.env) {
  if (environment.NODE_ENV !== "production") {
    throw new Error("BOOTSTRAP_REQUIRES_NODE_ENV=production");
  }

  return {
    nodeEnv: environment.NODE_ENV,
    email: requireEnvironment(environment, "BOOTSTRAP_ADMIN_EMAIL"),
    name: requireEnvironment(environment, "BOOTSTRAP_ADMIN_NAME"),
    password: requireEnvironment(environment, "BOOTSTRAP_ADMIN_PASSWORD"),
  };
}

export async function bootstrapFirstAdmin({
  config = getBootstrapConfig(),
  createUser = createCredentialUser,
} = {}) {
  if (config.nodeEnv !== "production") {
    throw new Error("BOOTSTRAP_REQUIRES_NODE_ENV=production");
  }

  const client = await getPool().connect();

  try {
    await client.query("SELECT pg_advisory_lock(hashtext($1))", [bootstrapLockKey]);
    const { rows: bootstrapRows } = await client.query(
      "SELECT initial_admin_user_id FROM bootstrap_state WHERE singleton = true",
    );
    if (bootstrapRows.length > 0) {
      throw new Error("BOOTSTRAP_ALREADY_COMPLETED");
    }

    const { rows: existingUsers } = await client.query(
      'SELECT id FROM "user" WHERE email = $1',
      [config.email],
    );
    if (existingUsers.length > 0) {
      throw new Error("BOOTSTRAP_EMAIL_ALREADY_EXISTS");
    }

    const user = await createUser(config);

    await client.query("BEGIN");
    try {
      await grantRole({
        client,
        actorUserId: null,
        userId: user.id,
        roleCode: "ADMIN",
      });
      await client.query(
        `INSERT INTO bootstrap_state (singleton, initial_admin_user_id)
         VALUES (true, $1)`,
        [user.id],
      );
      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    }

    return { created: true, user: { id: user.id, email: user.email } };
  } finally {
    await client.query("SELECT pg_advisory_unlock(hashtext($1))", [bootstrapLockKey]);
    client.release();
  }
}

async function main() {
  try {
    await bootstrapFirstAdmin();
    console.log("Initial administrator bootstrap completed.");
  } finally {
    await closePool();
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(`Bootstrap failed: ${error.message}`);
    process.exitCode = 1;
  });
}
