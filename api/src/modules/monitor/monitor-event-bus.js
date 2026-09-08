import { EventEmitter } from "node:events";

const emitter = new EventEmitter();
emitter.setMaxListeners(100);

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
 */
export function emitMonitorEvent(type, payload = {}) {
  const event = sanitizeMonitorEvent({
    type,
    ...payload,
  });
  emitter.emit("monitor_event", event);
  return event;
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
