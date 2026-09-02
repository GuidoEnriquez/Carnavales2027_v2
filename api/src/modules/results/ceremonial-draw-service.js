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

import { randomBytes, randomInt } from "node:crypto";

/**
 * Construye un nonce criptográfico de trazabilidad. No pretende reproducir la
 * selección: el índice se obtiene con crypto.randomInt().
 */
export function buildSeed() {
  return randomBytes(16).toString("hex");
}

/**
 * Selecciona un ganador entre las comparsas empatadas.
 *
 * Reglas:
 *   - pool.length === 0 → tira TIE_BREAKER_EMPTY_DRAW_POOL.
 *   - pool.length === 1 → devuelve ese elemento con method POOL_SINGLETON.
 *   - resto → crypto.randomInt(), con nonce e índice registrados.
 *
 * @param {{pool: string[], seed?: string, randomIntFn?: (max: number) => number}} params
 * @returns {{winnerTroupeId: string, seed: number, randomValue: number, method: string}}
 */
export function selectCeremonialWinner({ pool, seed, randomIntFn = randomInt } = {}) {
  if (!Array.isArray(pool)) {
    throw new TypeError("selectCeremonialWinner: pool debe ser un arreglo.");
  }
  if (pool.length === 0) {
    const error = new Error("TIE_BREAKER_EMPTY_DRAW_POOL");
    error.code = "TIE_BREAKER_EMPTY_DRAW_POOL";
    throw error;
  }
  if (pool.length === 1) {
    const effectiveSeed = typeof seed === "string" ? seed : buildSeed();
    return {
      winnerTroupeId: pool[0],
      seed: effectiveSeed,
      randomValue: 0,
      method: "POOL_SINGLETON",
    };
  }

  const effectiveSeed = typeof seed === "string" ? seed : buildSeed();
  const randomValue = randomIntFn(pool.length);
  if (!Number.isInteger(randomValue) || randomValue < 0 || randomValue >= pool.length) {
    throw new RangeError("randomIntFn devolvió un índice inválido.");
  }
  return {
    winnerTroupeId: pool[randomValue],
    seed: effectiveSeed,
    randomValue,
    method: "CRYPTO_RANDOM_INT",
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
  if (typeof seed !== "string" || !/^[0-9a-f]{32}$/i.test(seed)) {
    throw new TypeError("composeAuditEvent: seed debe ser un nonce hexadecimal de 32 caracteres.");
  }
  if (typeof randomValue !== "number" || !Number.isFinite(randomValue)) {
    throw new TypeError("composeAuditEvent: randomValue debe ser un número finito.");
  }
  if (!["POOL_SINGLETON", "CRYPTO_RANDOM_INT"].includes(method)) {
    throw new TypeError(
      "composeAuditEvent: method debe ser POOL_SINGLETON o CRYPTO_RANDOM_INT.",
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
