import { StatusPill } from "./StatusPill.jsx";
import { uxStatusLabel } from "./admin-ux-labels.js";

/**
 * PageHeader — Cabecera estándar de pantallas admin (Spec 027).
 * Eyebrow + título + opcional estado humano + acciones.
 */
export function PageHeader({ eyebrow, title, status, actions }) {
  return (
    <header className="admin-page-header">
      <div>
        {eyebrow && <p className="eyebrow">{eyebrow}</p>}
        <h1>{title}</h1>
        {status && (
          <p className="admin-page-status">
            <StatusPill status={status} label={uxStatusLabel(status)} />
          </p>
        )}
      </div>
      {actions && <div className="event-actions">{actions}</div>}
    </header>
  );
}
