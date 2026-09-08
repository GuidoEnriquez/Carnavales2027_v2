/**
 * ProgressBar — Barra de progreso accesible con roles ARIA nativos (Spec 020 / RF-178)
 */
export function ProgressBar({
  value = 0,
  max = 100,
  label,
  sublabel,
  className = "",
}) {
  const numericValue = Number.isFinite(value) ? value : 0;
  const numericMax = Number.isFinite(max) && max > 0 ? max : 100;
  const percentage = Math.round(Math.min(100, Math.max(0, (numericValue / numericMax) * 100)));

  return (
    <div className={`app-progress-container ${className}`.trim()}>
      {(label || sublabel) && (
        <div className="app-progress-header">
          {label && <span className="app-progress-label">{label}</span>}
          {sublabel && <span className="app-progress-sublabel">{sublabel}</span>}
        </div>
      )}
      <div
        role="progressbar"
        aria-valuenow={numericValue}
        aria-valuemin={0}
        aria-valuemax={numericMax}
        aria-label={label || "Progreso"}
        className="app-progress-track"
      >
        <div
          className="app-progress-fill"
          style={{ inlineSize: `${percentage}%` }}
        />
      </div>
    </div>
  );
}
