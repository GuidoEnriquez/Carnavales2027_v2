/**
 * Button — Botón accesible con target táctil mínimo de 48px y soporte de estado busy (Spec 020 / RF-178)
 */
export function Button({
  children,
  variant = "primary",
  size = "md",
  busy = false,
  busyText,
  disabled = false,
  type = "button",
  className = "",
  onClick,
  ...props
}) {
  const isBusy = Boolean(busy);
  const isDisabled = disabled || isBusy;

  return (
    <button
      type={type}
      disabled={isDisabled}
      aria-busy={isBusy ? "true" : undefined}
      className={`app-button app-button-${variant} app-button-${size} ${isBusy ? "is-busy" : ""} ${className}`.trim()}
      onClick={onClick}
      {...props}
    >
      {isBusy ? (
        <span className="app-button-busy-wrap">
          <span className="app-button-spinner" aria-hidden="true" />
          <span>{busyText || children}</span>
        </span>
      ) : (
        children
      )}
    </button>
  );
}
