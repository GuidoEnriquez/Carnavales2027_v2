/**
 * Tests unitarios del servicio de sorteo ceremonial — Spec 011 T01.
 *
 * Sin DB. Cubre RF-99 (validación), RF-101 (selección aleatoria), RF-102 (estructura de auditoría).
 */

import assert from "node:assert/strict";
import test from "node:test";
import {
  buildSeed,
  composeAuditEvent,
  selectCeremonialWinner,
} from "./ceremonial-draw-service.js";

test("buildSeed: devuelve un entero finito y reproducible en rango seguro", () => {
  const s1 = buildSeed();
  const s2 = buildSeed();
  assert.ok(Number.isInteger(s1));
  assert.ok(Number.isFinite(s1));
  assert.ok(Number.isInteger(s2));
  assert.ok(Number.isFinite(s2));
  assert.ok(s1 >= 0);
  assert.ok(s1 <= Number.MAX_SAFE_INTEGER);
  // Dos llamadas seguidas no tienen por qué coincidir (incluye crypto random).
  // Verificamos solo que son plausibles, no iguales.
  assert.notEqual(s1, s2);
});

test("selectCeremonialWinner: pool vacío → TIE_BREAKER_EMPTY_DRAW_POOL", () => {
  assert.throws(
    () => selectCeremonialWinner({ pool: [] }),
    (err) => err.code === "TIE_BREAKER_EMPTY_DRAW_POOL" && err.message === "TIE_BREAKER_EMPTY_DRAW_POOL",
  );
});

test("selectCeremonialWinner: pool no es arreglo → TypeError", () => {
  assert.throws(
    () => selectCeremonialWinner({ pool: "no es array" }),
    TypeError,
  );
});

test("selectCeremonialWinner: pool de un elemento → POOL_SINGLETON", () => {
  const result = selectCeremonialWinner({ pool: ["comparsa-A"], seed: 42 });
  assert.deepEqual(result, {
    winnerTroupeId: "comparsa-A",
    seed: 42,
    randomValue: 0,
    method: "POOL_SINGLETON",
  });
});

test("selectCeremonialWinner: pool de un elemento sin seed → genera seed automático", () => {
  const result = selectCeremonialWinner({ pool: ["X"] });
  assert.equal(result.winnerTroupeId, "X");
  assert.equal(result.method, "POOL_SINGLETON");
  assert.equal(result.randomValue, 0);
  assert.ok(Number.isInteger(result.seed));
});

test("selectCeremonialWinner: con random stub determinístico devuelve índice esperado", () => {
  // random() devuelve 0.5 → index = floor(0.5 * 3) = 1
  const fixedRandom = () => 0.5;
  const pool = ["A", "B", "C"];
  const result = selectCeremonialWinner({ pool, seed: 999, random: fixedRandom });
  assert.equal(result.winnerTroupeId, "B");
  assert.equal(result.method, "MATH_RANDOM_TRACEABLE");
  assert.equal(result.randomValue, 0.5);
  assert.equal(result.seed, 999);
});

test("selectCeremonialWinner: random stub = 0 → primer elemento", () => {
  const result = selectCeremonialWinner({
    pool: ["primero", "segundo", "tercero"],
    seed: 1,
    random: () => 0,
  });
  assert.equal(result.winnerTroupeId, "primero");
  assert.equal(result.randomValue, 0);
});

test("selectCeremonialWinner: random stub cercano a 1 → último elemento", () => {
  const result = selectCeremonialWinner({
    pool: ["primero", "segundo", "tercero"],
    seed: 1,
    random: () => 0.9999,
  });
  assert.equal(result.winnerTroupeId, "tercero");
});

test("selectCeremonialWinner: reproducibilidad — mismo random stub + mismo seed = mismo ganador", () => {
  const pool = ["alpha", "beta", "gamma", "delta"];
  const fixedRandom = () => 0.42;
  const a = selectCeremonialWinner({ pool, seed: 12345, random: fixedRandom });
  const b = selectCeremonialWinner({ pool, seed: 12345, random: fixedRandom });
  assert.equal(a.winnerTroupeId, b.winnerTroupeId);
  assert.equal(a.randomValue, b.randomValue);
});

test("selectCeremonialWinner: distintos random stubs pueden producir distintos ganadores (probabilístico)", () => {
  const pool = ["A", "B", "C", "D", "E"];
  const winners = new Set();
  // Muestreo: cada stub random devuelve un valor fijo distinto.
  for (const v of [0.1, 0.3, 0.5, 0.7, 0.9]) {
    const r = selectCeremonialWinner({ pool, seed: v * 1000, random: () => v });
    winners.add(r.winnerTroupeId);
  }
  // Con 5 muestras en pool de 5, esperamos al menos 2 ganadores distintos.
  // (probabilidad de que sean todos iguales con valores 0.1,0.3,0.5,0.7,0.9 es ~0).
  assert.ok(winners.size >= 2, `esperaba >=2 ganadores distintos, obtuve ${winners.size}`);
});

test("composeAuditEvent: payload válido con método MATH_RANDOM_TRACEABLE", () => {
  const event = composeAuditEvent({
    eventId: "evt-1",
    tiedTroupeIds: ["X", "Y", "Z"],
    appliedCriteria: ["WON_NOMINATIVE_RUBRICS_COUNT", "BATTERY_RUBRIC_WINNER"],
    seed: 12345,
    randomValue: 0.42,
    method: "MATH_RANDOM_TRACEABLE",
    winnerTroupeId: "Y",
    actor: { id: "user-1", role: "SCRUTINEER" },
    correlationId: "corr-1",
  });
  assert.equal(event.eventType, "RESULTS_TIE_BREAKER_CEREMONIAL_DRAW");
  assert.equal(event.eventId, "evt-1");
  assert.deepEqual(event.tiedTroupeIds, ["X", "Y", "Z"]);
  assert.deepEqual(event.appliedCriteria, ["WON_NOMINATIVE_RUBRICS_COUNT", "BATTERY_RUBRIC_WINNER"]);
  assert.equal(event.winnerTroupeId, "Y");
  assert.equal(event.method, "MATH_RANDOM_TRACEABLE");
  assert.equal(event.seed, 12345);
  assert.equal(event.randomValue, 0.42);
  assert.equal(event.actor.id, "user-1");
  assert.equal(event.correlationId, "corr-1");
  assert.ok(typeof event.occurredAt === "string" && event.occurredAt.length > 0);
});

test("composeAuditEvent: acepta método POOL_SINGLETON (caso degenerado, no debería dispararse desde T02)", () => {
  // Si el pool tiene 1 solo elemento no hay empate real: la ruta HTTP de T02
  // debe detectar este caso y NO invocar composeAuditEvent. Este test verifica
  // la robustez del builder por si alguien lo llama igual.
  const event = composeAuditEvent({
    eventId: "evt-2",
    tiedTroupeIds: ["solo-esta"],
    seed: 1,
    randomValue: 0,
    method: "POOL_SINGLETON",
    winnerTroupeId: "solo-esta",
  });
  assert.equal(event.method, "POOL_SINGLETON");
  assert.equal(event.winnerTroupeId, "solo-esta");
});

test("composeAuditEvent: ocurreAt custom se respeta", () => {
  const ts = "2026-09-01T12:00:00.000Z";
  const event = composeAuditEvent({
    eventId: "evt-3",
    tiedTroupeIds: ["A", "B"],
    seed: 1,
    randomValue: 0.5,
    method: "MATH_RANDOM_TRACEABLE",
    winnerTroupeId: "A",
    occurredAt: ts,
  });
  assert.equal(event.occurredAt, ts);
});

test("composeAuditEvent: tiedTroupeIds con 1 elemento y method no-POOL_SINGLETON → TypeError", () => {
  // El único caso donde se acepta length 1 es method POOL_SINGLETON.
  assert.throws(
    () =>
      composeAuditEvent({
        eventId: "e",
        tiedTroupeIds: ["solo"],
        seed: 1,
        randomValue: 0,
        method: "MATH_RANDOM_TRACEABLE",
        winnerTroupeId: "solo",
      }),
    /tiedTroupeIds debe tener al menos 2 elementos/,
  );
});

test("composeAuditEvent: tiedTroupeIds vacío → TypeError", () => {
  assert.throws(
    () =>
      composeAuditEvent({
        eventId: "e",
        tiedTroupeIds: [],
        seed: 1,
        randomValue: 0,
        method: "POOL_SINGLETON",
        winnerTroupeId: "x",
      }),
    /tiedTroupeIds debe tener al menos 1 elemento/,
  );
});

test("composeAuditEvent: winnerTroupeId debe pertenecer a tiedTroupeIds", () => {
  assert.throws(
    () =>
      composeAuditEvent({
        eventId: "e",
        tiedTroupeIds: ["A", "B"],
        seed: 1,
        randomValue: 0,
        method: "MATH_RANDOM_TRACEABLE",
        winnerTroupeId: "C",
      }),
    /winnerTroupeId debe pertenecer a tiedTroupeIds/,
  );
});

test("composeAuditEvent: rechaza método desconocido (futuro valor de method no soportado)", () => {
  assert.throws(
    () =>
      composeAuditEvent({
        eventId: "e",
        tiedTroupeIds: ["A", "B"],
        seed: 1,
        randomValue: 0,
        method: "RANDOM_NO_VALIDO",
        winnerTroupeId: "A",
      }),
    /method debe ser/,
  );
});

test("composeAuditEvent: eventId es obligatorio", () => {
  assert.throws(
    () =>
      composeAuditEvent({
        tiedTroupeIds: ["A", "B"],
        seed: 1,
        randomValue: 0,
        method: "MATH_RANDOM_TRACEABLE",
        winnerTroupeId: "A",
      }),
    /eventId es obligatorio/,
  );
});
