/**
 * errors.js — Diccionario centralizado de traducción de errores técnicos a lenguaje de usuario (Spec 020 / RF-180)
 */

export const ERROR_MESSAGES = {
  // Planillas y votación
  BALLOT_INCOMPLETE: "La planilla tiene ítems pendientes de evaluación. Todos los ítems deben puntuarse o marcarse como no presentados.",
  BALLOT_NOT_FOUND: "No se encontró la planilla solicitada.",
  BALLOT_ALREADY_SUBMITTED: "La planilla ya fue confirmada previamente y no puede modificarse.",
  BALLOT_IMMUTABLE: "Esta planilla está confirmada y es de solo lectura.",
  SCORE_IMMUTABLE: "Esta puntuación ya fue confirmada y no puede modificarse.",
  SCORE_NOT_FOUND: "No se encontró el ítem de puntuación.",
  INVALID_SCORE: "El puntaje debe ser un valor entero entre 1 y 10.",
  INVALID_DECISION: "La decisión ingresada no es válida.",
  SYNC_OPERATION_MISMATCH: "Conflicto de sincronización: el contenido no coincide con la operación previa.",

  // Autenticación, sesión y 2FA
  INVALID_CREDENTIALS: "El correo electrónico o la contraseña ingresados son incorrectos.",
  TWO_FACTOR_REQUIRED: "Se requiere verificación en dos pasos (OTP) para continuar.",
  OTP_INVALID: "El código de seguridad ingresado es incorrecto o ha expirado.",
  USER_LOCKED: "La cuenta está bloqueada temporalmente tras reiterados intentos fallidos. Intente nuevamente en 15 minutos.",
  SESSION_EXPIRED: "Tu sesión ha expirado. Por favor, iniciá sesión nuevamente.",
  UNAUTHORIZED: "No tenés autorización para realizar esta acción.",
  FORBIDDEN: "No contás con los privilegios requeridos para acceder a esta sección.",

  // Seguridad y red
  NETWORK_ERROR: "No hay conexión con el servidor. Verificá tu red y volvé a intentar.",
  RATE_LIMIT_EXCEEDED: "Se realizaron demasiadas solicitudes. Por favor, esperá unos momentos antes de reintentar.",
  PAYLOAD_TOO_LARGE: "El tamaño de los datos enviados excede el límite permitido.",
  SERVER_ERROR: "Ocurrió un error interno en el servidor. Por favor, reintentá en unos momentos.",

  // Penalizaciones, resultados y actas
  PENALTY_IMMUTABLE: "La penalización ya fue revocada o se encuentra bloqueada tras la liberación de resultados.",
  RESULTS_ALREADY_RELEASED: "Los resultados ya han sido liberados oficialmente.",
  RESULTS_NOT_RELEASED: "Los resultados aún no han sido liberados por las autoridades correspondientes.",
  OFFICIAL_RECORD_ALREADY_EXISTS: "Ya existe un acta oficial certificada para este evento.",
  TIE_BREAKER_PENDING: "Existe un empate que requiere resolución mediante sorteo ceremonial antes de emitir el acta.",
};

/**
 * Traduce un objeto de error, código o excepción a un mensaje claro para el usuario.
 *
 * @param {Error|{code?: string, message?: string}|string} error
 * @param {string} [fallback]
 * @returns {string}
 */
export function formatErrorMessage(error, fallback = "Ocurrió un error inesperado. Por favor, reintentá.") {
  if (!error) return fallback;

  if (typeof error === "string") {
    return ERROR_MESSAGES[error] || error;
  }

  const code = error.code || (typeof error.message === "string" && ERROR_MESSAGES[error.message] ? error.message : null);

  if (code && ERROR_MESSAGES[code]) {
    return ERROR_MESSAGES[code];
  }

  if (error.code === "NETWORK_ERROR" || error.message === "Failed to fetch") {
    return ERROR_MESSAGES.NETWORK_ERROR;
  }

  if (typeof error.message === "string" && error.message.trim().length > 0) {
    return error.message;
  }

  return fallback;
}
