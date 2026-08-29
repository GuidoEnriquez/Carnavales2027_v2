import pg from "pg";

const poolsByConnectionString = new Map();

function getConnectionString() {
  const connectionString = process.env.DATABASE_URL;

  if (!connectionString) {
    throw new Error("DATABASE_URL no está definida.");
  }

  return connectionString;
}

function getPoolMax() {
  const configuredMax = Number(process.env.DB_POOL_MAX ?? 10);

  return Number.isInteger(configuredMax) && configuredMax > 0 ? configuredMax : 10;
}

export function getPool() {
  const connectionString = getConnectionString();
  let pool = poolsByConnectionString.get(connectionString);

  if (!pool) {
    pool = new pg.Pool({
      connectionString,
      max: getPoolMax(),
    });
    poolsByConnectionString.set(connectionString, pool);
  }

  return pool;
}

export async function closePool() {
  const pools = [...poolsByConnectionString.values()];
  poolsByConnectionString.clear();

  await Promise.all(pools.map((pool) => pool.end()));
}
