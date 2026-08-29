import { betterAuth } from "better-auth";
import { getPool } from "../db/pool.js";

function requireEnvironment(name) {
  const value = process.env[name];

  if (!value) {
    throw new Error(`${name} no está definida.`);
  }

  return value;
}

export function createAuth() {
  return betterAuth({
    database: getPool(),
    baseURL: requireEnvironment("BETTER_AUTH_URL"),
    secret: requireEnvironment("BETTER_AUTH_SECRET"),
    emailAndPassword: {
      enabled: true,
    },
  });
}

export const auth = createAuth();
