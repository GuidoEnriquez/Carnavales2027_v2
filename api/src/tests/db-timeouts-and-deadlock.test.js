import test from "node:test";
import assert from "node:assert/strict";
import { withTransaction } from "../db/transaction.js";

test("withTransaction reintenta automáticamente ante error de deadlock 40P01", async () => {
  let attempts = 0;
  const sleeps = [];

  const mockClient = {
    query: async (sql) => {
      if (sql === "BEGIN" || sql === "COMMIT" || sql === "ROLLBACK") return;
    },
    release: () => {},
  };

  const mockPool = {
    connect: async () => mockClient,
  };

  const result = await withTransaction(
    async () => {
      attempts++;
      if (attempts === 1) {
        const deadlockError = new Error("deadlock detected");
        deadlockError.code = "40P01";
        throw deadlockError;
      }
      return "SUCCESS_AFTER_RETRY";
    },
    {
      pool: mockPool,
      sleep: async (ms) => {
        sleeps.push(ms);
      },
    },
  );

  assert.equal(result, "SUCCESS_AFTER_RETRY");
  assert.equal(attempts, 2);
  assert.equal(sleeps.length, 1);
  assert.ok(sleeps[0] >= 50); // 25 * 2^1 + jitter
});

test("withTransaction falla tras superar el máximo de reintentos por deadlock (2)", async () => {
  let attempts = 0;

  const mockClient = {
    query: async () => {},
    release: () => {},
  };

  const mockPool = {
    connect: async () => mockClient,
  };

  await assert.rejects(
    () =>
      withTransaction(
        async () => {
          attempts++;
          const deadlockError = new Error("persistent deadlock");
          deadlockError.code = "40P01";
          throw deadlockError;
        },
        {
          pool: mockPool,
          maxRetries: 2,
          sleep: async () => {},
        },
      ),
    (err) => err.code === "40P01",
  );

  assert.equal(attempts, 3); // intento inicial + 2 reintentos
});

test("withTransaction no reintenta otros errores distintos de 40P01", async () => {
  let attempts = 0;

  const mockClient = {
    query: async () => {},
    release: () => {},
  };

  const mockPool = {
    connect: async () => mockClient,
  };

  await assert.rejects(
    () =>
      withTransaction(
        async () => {
          attempts++;
          const conflictError = new Error("unique conflict");
          conflictError.code = "23505";
          throw conflictError;
        },
        {
          pool: mockPool,
          sleep: async () => {},
        },
      ),
    (err) => err.code === "23505",
  );

  assert.equal(attempts, 1);
});
