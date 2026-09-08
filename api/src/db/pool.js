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

function getStatementTimeout() {
  const timeout = Number(process.env.DB_STATEMENT_TIMEOUT ?? 5000);
  return Number.isInteger(timeout) && timeout >= 0 ? timeout : 5000;
}

function getConnectionTimeout() {
  const timeout = Number(process.env.DB_CONNECTION_TIMEOUT_MS ?? 3000);
  return Number.isInteger(timeout) && timeout >= 0 ? timeout : 3000;
}

function getIdleInTransactionTimeout() {
  const timeout = Number(process.env.DB_IDLE_IN_TRANSACTION_TIMEOUT ?? 10000);
  return Number.isInteger(timeout) && timeout >= 0 ? timeout : 10000;
}

export function getPool() {
  const connectionString = getConnectionString();
  let pool = poolsByConnectionString.get(connectionString);

  if (!pool) {
    pool = new pg.Pool({
      connectionString,
      max: getPoolMax(),
      statement_timeout: getStatementTimeout(),
      connectionTimeoutMillis: getConnectionTimeout(),
      idle_in_transaction_session_timeout: getIdleInTransactionTimeout(),
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
