import assert from "node:assert/strict";
import test from "node:test";
import {
  buildSeed,
  composeAuditEvent,
  selectCeremonialWinner,
} from "./ceremonial-draw-service.js";

test("buildSeed genera un nonce criptográfico hexadecimal", () => {
  const first = buildSeed();
  const second = buildSeed();
  assert.match(first, /^[0-9a-f]{32}$/);
  assert.match(second, /^[0-9a-f]{32}$/);
  assert.notEqual(first, second);
});

test("selectCeremonialWinner rechaza pool vacío", () => {
  assert.throws(() => selectCeremonialWinner({ pool: [] }), { code: "TIE_BREAKER_EMPTY_DRAW_POOL" });
});

test("selectCeremonialWinner usa el índice criptográfico inyectado", () => {
  const result = selectCeremonialWinner({
    pool: ["A", "B", "C"],
    seed: "a".repeat(32),
    randomIntFn: (max) => max - 1,
  });
  assert.deepEqual(result, {
    winnerTroupeId: "C",
    seed: "a".repeat(32),
    randomValue: 2,
    method: "CRYPTO_RANDOM_INT",
  });
});

test("selectCeremonialWinner rechaza un índice fuera del pool", () => {
  assert.throws(
    () => selectCeremonialWinner({ pool: ["A", "B"], randomIntFn: () => 2 }),
    /índice inválido/,
  );
});

test("composeAuditEvent conserva solo datos de auditoría generados por servidor", () => {
  const event = composeAuditEvent({
    eventId: "evt-1",
    tiedTroupeIds: ["A", "B"],
    appliedCriteria: ["WON_NOMINATIVE_RUBRICS_COUNT", "BATTERY_RUBRIC_WINNER"],
    seed: "b".repeat(32),
    randomValue: 1,
    method: "CRYPTO_RANDOM_INT",
    winnerTroupeId: "B",
    actor: { id: "user-1", role: "ESCRIBANO" },
    occurredAt: "2026-09-02T12:00:00.000Z",
    correlationId: "corr-1",
  });
  assert.equal(event.method, "CRYPTO_RANDOM_INT");
  assert.equal(event.actor.role, "ESCRIBANO");
  assert.equal(event.randomValue, 1);
});
