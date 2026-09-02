/**
 * Servicio de sorteo ceremonial — Spec 011.
 *
 * Funciones puras sin acceso a BD ni a HTTP. Se compone en T02 (endpoint HTTP)
 * y se audita en T01d (audit_event) usando el payload que retorna composeAuditEvent.
 *
 * RF cubiertos por este archivo:
 *   RF-99  Validación del pool de comparsas empatadas.
 *   RF-101 Selección aleatoria (`Math.random`, con seed de trazabilidad; migrable a `crypto.randomInt`).
 *   RF-102 Estructura del evento de auditoría (sin persistir aquí).
 */

import { randomBytes } from "node:crypto";

/**
 * Construye un seed determinístico a partir de Date.now() mezclado con bytes
 * aleatorios criptográficos. Devuelve un entero que cabe en 64 bits con signo.
 *
 * Esto NO se usa para "alimentar" Math.random (que no acepta seed en Node),
 * sino para registrar en auditoría la "fuente" del sorteo y permitir
 * reproducibilidad si migramos a un PRNG seedeable en el futuro.
 */
export function buildSeed() {
  const now = BigInt(Date.now());
  const rand = randomBytes(8).readBigUInt64BE();
  // Mezcla y reduce a 53 bits (Number.MAX_SAFE_INTEGER) para mantener precisión.
  const mixed = Number((now ^ rand) & BigInt("0x1FFFFFFFFFFFFF"));
  return mixed;
}

/**
 * Selecciona un ganador entre las comparsas empatadas.
 *
 * Reglas:
 *   - pool.length === 0 → tira TIE_BREAKER_EMPTY_DRAW_POOL.
 *   - pool.length === 1 → devuelve ese elemento con method POOL_SINGLETON.
 *   - resto → Math.random() clásico, con seed y randomValue registrados.
 *
 * @param {{pool: string[], seed?: number, random?: () => number}} params
 * @returns {{winnerTroupeId: string, seed: number, randomValue: number, method: string}}
 */
export function selectCeremonialWinner({ pool, seed, random = Math.random } = {}) {
  if (!Array.isArray(pool)) {
    throw new TypeError("selectCeremonialWinner: pool debe ser un arreglo.");
  }
  if (pool.length === 0) {
    const error = new Error("TIE_BREAKER_EMPTY_DRAW_POOL");
    error.code = "TIE_BREAKER_EMPTY_DRAW_POOL";
    throw error;
  }
  if (pool.length === 1) {
    const effectiveSeed = typeof seed === "number" ? seed : buildSeed();
    return {
      winnerTroupeId: pool[0],
      seed: effectiveSeed,
      randomValue: 0,
      method: "POOL_SINGLETON",
    };
  }

  const effectiveSeed = typeof seed === "number" ? seed : buildSeed();
  const randomValue = random();
  const index = Math.floor(randomValue * pool.length);
  return {
    winnerTroupeId: pool[index],
    seed: effectiveSeed,
    randomValue,
    method: "MATH_RANDOM_TRACEABLE",
  };
}

/**
 * Compone el payload listo para persistir en audit_event.
 *
 * No toca la BD: eso lo hace quien invoca (T02 endpoint HTTP o T01d test de DB).
 * Mantener esta función pura facilita los tests y la migración a
 * crypto.randomInt() cuando el reglamento lo exija.
 */
export function composeAuditEvent({
  eventId,
  tiedTroupeIds,
  appliedCriteria = [],
  seed,
  randomValue,
  method,
  winnerTroupeId,
  actor,
  occurredAt,
  correlationId,
} = {}) {
  if (!Array.isArray(tiedTroupeIds) || tiedTroupeIds.length < 1) {
    throw new TypeError("composeAuditEvent: tiedTroupeIds debe tener al menos 1 elemento.");
  }
  // POOL_SINGLETON es el caso degenerado de un pool de 1 elemento (sin empate real).
  // Para los demás métodos se exige al menos 2 elementos (un empate real).
  if (method !== "POOL_SINGLETON" && tiedTroupeIds.length < 2) {
    throw new TypeError(
      "composeAuditEvent: con method distinto de POOL_SINGLETON, tiedTroupeIds debe tener al menos 2 elementos.",
    );
  }
  if (typeof eventId !== "string" || eventId.trim().length === 0) {
    throw new TypeError("composeAuditEvent: eventId es obligatorio.");
  }
  if (typeof winnerTroupeId !== "string" || winnerTroupeId.trim().length === 0) {
    throw new TypeError("composeAuditEvent: winnerTroupeId es obligatorio.");
  }
  if (!tiedTroupeIds.includes(winnerTroupeId)) {
    throw new TypeError("composeAuditEvent: winnerTroupeId debe pertenecer a tiedTroupeIds.");
  }
  if (typeof seed !== "number" || !Number.isFinite(seed)) {
    throw new TypeError("composeAuditEvent: seed debe ser un número finito.");
  }
  if (typeof randomValue !== "number" || !Number.isFinite(randomValue)) {
    throw new TypeError("composeAuditEvent: randomValue debe ser un número finito.");
  }
  if (!["MATH_RANDOM_TRACEABLE", "POOL_SINGLETON", "CRYPTO_RANDOM_INT"].includes(method)) {
    throw new TypeError(
      "composeAuditEvent: method debe ser MATH_RANDOM_TRACEABLE, POOL_SINGLETON o CRYPTO_RANDOM_INT.",
    );
  }

  return {
    eventType: "RESULTS_TIE_BREAKER_CEREMONIAL_DRAW",
    eventId,
    tiedTroupeIds: [...tiedTroupeIds],
    appliedCriteria: [...appliedCriteria],
    seed,
    randomValue,
    method,
    winnerTroupeId,
    actor: actor ?? null,
    occurredAt: occurredAt ?? new Date().toISOString(),
    correlationId: correlationId ?? null,
  };
}
