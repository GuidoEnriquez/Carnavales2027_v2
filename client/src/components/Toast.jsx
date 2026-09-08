/**
 * Toast — Notificación en pantalla no intrusiva y accesible (Spec 020 / RF-178)
 */
export function Toast({
  message,
  type = "info",
  actionLabel,
  onAction,
  onDismiss,
  className = "",
}) {
  if (!message) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className={`app-toast app-toast-${type} ${className}`.trim()}
    >
      <span className="app-toast-message">{message}</span>
      {actionLabel && onAction && (
        <button
          type="button"
          className="app-toast-action-btn"
          onClick={onAction}
        >
          {actionLabel}
        </button>
      )}
      {onDismiss && (
        <button
          type="button"
          className="app-toast-close-btn"
          onClick={onDismiss}
          aria-label="Cerrar notificación"
        >
          ✕
        </button>
      )}
    </div>
  );
}
