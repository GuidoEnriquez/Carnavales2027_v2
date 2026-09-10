import { getPool } from "./pool.js";
import {
  createEventScope,
  discardEventScope,
  flushEventScope,
  runInEventScope,
} from "../modules/monitor/monitor-event-bus.js";

const MAX_DEADLOCK_RETRIES = 2;

/**
 * Executes an operation inside a PostgreSQL transaction.
 * Automatically retries up to 2 times if a deadlock (error 40P01) occurs,
 * using exponential backoff with jitter.
 */
export async function withTransaction(operation, {
  pool = getPool(),
  maxRetries = MAX_DEADLOCK_RETRIES,
  sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
} = {}) {
  let attempt = 0;

  while (true) {
    const client = await pool.connect();
    const store = createEventScope();
    try {
      await client.query("BEGIN");
      const result = await runInEventScope(store, () => operation(client));
      await client.query("COMMIT");
      // Notificación post-commit: los clientes solo ven la operación ya
      // durable y persistida (Spec 022/024 corrección).
      flushEventScope(store);
      return result;
    } catch (error) {
      try {
        await client.query("ROLLBACK");
      } catch {
        /* Preserve the original failure. */
      }
      discardEventScope(store);

      if (error.code === "40P01" && attempt < maxRetries) {
        attempt++;
        const jitter = Math.random() * 25;
        const delay = Math.pow(2, attempt) * 25 + jitter;
        await sleep(delay);
        continue;
      }

      throw error;
    } finally {
      client.release();
    }
  }
}
