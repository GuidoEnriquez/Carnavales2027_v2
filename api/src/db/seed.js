import "dotenv/config";
import { fileURLToPath } from "node:url";
import { grantRole } from "../auth/role-service.js";
import { closePool, getPool } from "./pool.js";

function requireEnvironment(environment, name) {
  const value = environment[name];

  if (!value) {
    throw new Error(`${name} no está definida.`);
  }

  return value;
}

export function getSeedAdminConfig(environment = process.env) {
  if (environment.NODE_ENV === "production") {
    throw new Error("SEED_ADMIN_FORBIDDEN_IN_PRODUCTION");
  }
  if (environment.NODE_ENV !== "development" && environment.NODE_ENV !== "test") {
    throw new Error("SEED_ADMIN_REQUIRES_DEVELOPMENT_OR_TEST");
  }

  return {
    nodeEnv: environment.NODE_ENV,
    email: requireEnvironment(environment, "SEED_ADMIN_EMAIL"),
    name: requireEnvironment(environment, "SEED_ADMIN_NAME"),
    password: requireEnvironment(environment, "SEED_ADMIN_PASSWORD"),
  };
}

async function createUserWithBetterAuth({ email, name, password }) {
  const { auth } = await import("../auth/auth.js");
  const response = await auth.api.signUpEmail({
    body: { email, name, password },
  });

  if (!response?.user?.id) {
    throw new Error("SEED_ADMIN_USER_CREATION_FAILED");
  }

  return response.user;
}

export async function seedDevelopmentAdmin({
  config = getSeedAdminConfig(),
  createUser = createUserWithBetterAuth,
} = {}) {
  if (config.nodeEnv !== "development" && config.nodeEnv !== "test") {
    throw new Error("SEED_ADMIN_FORBIDDEN_IN_PRODUCTION");
  }

  const pool = getPool();
  const { rows: existingUsers } = await pool.query(
    'SELECT id, email FROM "user" WHERE email = $1',
    [config.email],
  );
  const user = existingUsers[0] ?? await createUser(config);
  const roleResult = await grantRole({
    actorUserId: null,
    userId: user.id,
    roleCode: "ADMIN",
  });

  return {
    user: { id: user.id, email: user.email },
    createdUser: existingUsers.length === 0,
    grantedAdminRole: roleResult.created,
  };
}

async function main() {
  try {
    const result = await seedDevelopmentAdmin();
    console.log(result.createdUser ? "Development ADMIN seeded." : "Development ADMIN reused.");
  } finally {
    await closePool();
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(`Seed failed: ${error.message}`);
    process.exitCode = 1;
  });
}
