/**
 * ConfigurationProgress — Camino recomendado de configuración (Spec 027/RF-UX-02).
 *
 * Guía sin bloquear: cada paso enlaza al acceso directo (sidebar/ruta).
 * `steps`: [{ key, label, detail, state: "done"|"current"|"pending"|"attention", href }]
 */
export function ConfigurationProgress({ steps = [], value = 0, label = "Preparación" }) {
  const pct = Math.max(0, Math.min(100, Math.round(value)));
  const completed = steps.filter((step) => step.state === "done").length;
  const stateLabels = {
    done: "Completo",
    current: "Paso actual",
    pending: "Pendiente",
    attention: "Requiere atención",
  };
  return (
    <section className="config-progress" aria-label={label}>
      <div className="config-progress-summary">
        <div>
          <span>{label}</span>
          <strong>{completed} de {steps.length} etapas completadas</strong>
        </div>
        <strong aria-label={`${pct}% completado`}>{pct}%</strong>
      </div>
      <div
        className="progress-track"
        role="progressbar"
        aria-valuenow={pct}
        aria-valuemin="0"
        aria-valuemax="100"
        aria-label={label}
      >
        <span style={{ inlineSize: `${pct}%` }} />
      </div>
      <ol className="config-progress-steps">
        {steps.map((step) => (
          <li key={step.key} className={`config-progress-step is-${step.state}`}>
            {step.href ? (
              <a
                className="config-progress-link"
                href={step.href}
                aria-current={step.state === "current" ? "step" : undefined}
                aria-label={`${step.label}. ${stateLabels[step.state] ?? "Pendiente"}. ${step.detail ?? ""}`.trim()}
              >
                <span className="config-progress-bullet" aria-hidden="true">
                  {step.state === "done" ? "✓" : step.state === "current" ? "●" : step.state === "attention" ? "!" : "○"}
                </span>
                <span className="config-progress-copy">
                  <span className="config-progress-title">
                    <strong>{step.label}</strong>
                    <span className="config-progress-state">{stateLabels[step.state] ?? "Pendiente"}</span>
                  </span>
                  {step.detail && <span className="config-progress-detail">{step.detail}</span>}
                </span>
                <span className="config-progress-chevron" aria-hidden="true">›</span>
              </a>
            ) : (
              <span className="config-progress-link">
                <span className="config-progress-bullet" aria-hidden="true">○</span>
                <span className="config-progress-copy">
                  <span className="config-progress-title"><strong>{step.label}</strong><span className="config-progress-state">Pendiente</span></span>
                  {step.detail && <span className="config-progress-detail">{step.detail}</span>}
                </span>
              </span>
            )}
          </li>
        ))}
      </ol>
    </section>
  );
}
