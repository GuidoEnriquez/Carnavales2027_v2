const STATUS_LABELS = {
  OPEN: "Abierta",
  SUBMITTED: "Confirmada",
  REOPENED: "Reabierta",
  REPLACED: "Reemplazada",
  PENDING: "Pendiente",
  SCORED: "Puntuado",
  NOT_PRESENTED: "No se presentó",
  ACTIVE: "Activo",
  SUSPENDED: "Suspendido",
  INVITED: "Invitado",
  REGISTERED: "Registrado",
  DRAFT: "Borrador",
  PUBLISHED: "Publicado",
  LOCKED: "Bloqueado",
};

/**
 * StatusPill — Indicador visual de estado accesible con texto legible y contraste garantizado (Spec 020 / RF-178)
 */
export function StatusPill({ status, label, className = "" }) {
  const normalizedKey = typeof status === "string" ? status.toUpperCase().trim() : "";
  const displayLabel = label || STATUS_LABELS[normalizedKey] || status || "Desconocido";
  const modifier = normalizedKey.toLowerCase().replace(/_/g, "-");

  return (
    <span className={`status-pill status-pill-${modifier} ${className}`.trim()}>
      {displayLabel}
    </span>
  );
}
