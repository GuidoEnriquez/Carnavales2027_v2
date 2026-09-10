import { EventEmitter } from "node:events";
import { AsyncLocalStorage } from "node:async_hooks";

const emitter = new EventEmitter();
emitter.setMaxListeners(100);

const eventScope = new AsyncLocalStorage();

const FORBIDDEN_FIELDS = new Set([
  "score",
  "scores",
  "evaluationState",
  "judgeName",
  "judgeEmail",
  "documentNumber",
  "voterId",
]);

/**
 * Sanitiza cualquier evento eliminando recursivamente campos que puedan
 * violar el secreto del voto o exponer identidades individuales de jurados (RF-190).
 */
export function sanitizeMonitorEvent(payload) {
  if (!payload || typeof payload !== "object") return {};

  const clean = {};
  for (const [key, value] of Object.entries(payload)) {
    if (FORBIDDEN_FIELDS.has(key)) {
      continue; // RF-190: Eliminar campos confidenciales de jurados/votos
    }
    if (value && typeof value === "object" && !Array.isArray(value)) {
      clean[key] = sanitizeMonitorEvent(value);
    } else if (Array.isArray(value)) {
      clean[key] = value.map((item) =>
        item && typeof item === "object" ? sanitizeMonitorEvent(item) : item,
      );
    } else {
      clean[key] = value;
    }
  }

  if (!clean.timestamp) {
    clean.timestamp = new Date().toISOString();
  }

  return clean;
}

/**
 * Emite un evento operativo a todos los suscriptores SSE activos.
 *
 * Post-commit (Spec 022/024 corrección): mientras existe una transacción activa
 * (ver runInEventScope) el evento se ENCOLA y solo se difunde al hacer COMMIT,
 * preservando el orden de emisión. Ante ROLLBACK se descarta: ningún cliente ve
 * una operación que terminó en rollback ni un estado previo a persisti­rse.
 * Con `immediate: true` se difunde al instante aunque haya transacción activa,
 * reservado a alertas operativas (p. ej. CLOSE_ATTEMPT_INCOMPLETE) cuyo sentido
 * es notificar un intento que precisamente no producirá COMMIT.
 */
export function emitMonitorEvent(type, payload = {}, options = {}) {
  const event = sanitizeMonitorEvent({
    type,
    ...payload,
  });
  const store = eventScope.getStore();
  if (store && !options.immediate) {
    store.queue.push(event);
  } else {
    emitter.emit("monitor_event", event);
  }
  return event;
}

/**
 * Crea un scope de eventos asociado a una transacción.
 * El store se entrega a runInEventScope y se resuelve con
 * flushEventScope (COMMIT) o discardEventScope (ROLLBACK).
 */
export function createEventScope() {
  return { queue: [] };
}

/**
 * Ejecuta la operación dentro del scope de eventos indicado.
 * Si ya existe un scope activo (transacción externa), lo reutiliza:
 * los eventos van al scope de mayor jerarquía y se resuelven junto al
 * COMMIT/ROLLBACK del nivel superior.
 */
export function runInEventScope(store, operation) {
  if (eventScope.getStore()) return operation();
  return eventScope.run(store, operation);
}

/**
 * Difunde en orden los eventos encolados tras un COMMIT exitoso.
 */
export function flushEventScope(store) {
  for (const event of store.queue) {
    emitter.emit("monitor_event", event);
  }
  store.queue = [];
}

/**
 * Descarta los eventos encolados tras un ROLLBACK.
 */
export function discardEventScope(store) {
  store.queue = [];
}

/**
 * Suscribe un callback a eventos del monitor.
 * Devuelve una función para desuscribir.
 */
export function subscribeMonitorEvents(handler) {
  emitter.on("monitor_event", handler);
  return () => {
    emitter.off("monitor_event", handler);
  };
}

export function unsubscribeMonitorEvents(handler) {
  emitter.off("monitor_event", handler);
}

// Para testing y reinicio limpio
export function resetMonitorEventBus() {
  emitter.removeAllListeners();
}
