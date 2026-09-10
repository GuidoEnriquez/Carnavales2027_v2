/**
 * admin-ux-labels — Mapa de presentación UX (Spec 027/C4, RF-UX-01).
 *
 * Solo presentación: los valores internos/API (CONFIGURING, OPEN,
 * displayOrder, standbyForAssignmentId, matrix, ...) NO cambian.
 * Usar `uxLabel()` para textos visibles y conservar el código
 * original en atributos/llamadas API.
 */

export const UX_STATUS_LABELS = {
  CONFIGURING: "En configuración",
  OPEN: "Competencia abierta",
  CLOSED: "Evento cerrado",
};

export const UX_FIELD_LABELS = {
  displayOrder: "Orden de visualización",
  assignmentType: "Tipo de asignación",
  standbyForAssignmentId: "Suplente de",
  matrix: "Planillas de evaluación",
  orphanedCriterion: "Criterio pendiente de asignar",
};

export const UX_ERROR_HINTS = {
  RESOURCE_CONFLICT: "Ese nombre u orden ya está en uso.",
  EVENT_LOCKED:
    "🔒 La competencia está abierta. La configuración de planillas ya no puede modificarse.",
};

export function uxStatusLabel(status, fallback = status) {
  if (typeof status !== "string") return fallback;
  return UX_STATUS_LABELS[status.toUpperCase().trim()] ?? fallback;
}

export function uxFieldLabel(field, fallback = field) {
  if (typeof field !== "string") return fallback;
  return UX_FIELD_LABELS[field] ?? fallback;
}

export function uxErrorHint(code, fallback) {
  if (typeof code !== "string") return fallback;
  return UX_ERROR_HINTS[code] ?? fallback;
}
