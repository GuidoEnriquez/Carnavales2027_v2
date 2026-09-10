import { uxErrorHint } from "./admin-ux-labels.js";

/**
 * EventStatusBanner — Banner de solo lectura para eventos OPEN/CLOSED
 * (Spec 027/RF-UX-07). No sustituye las guardas del servidor; solo
 * explica por qué la configuración ya no es editable.
 */
export function EventStatusBanner({ status }) {
  if (status === "OPEN") {
    return (
      <p className="event-status-banner event-status-banner-open" role="note">
        {uxErrorHint("EVENT_LOCKED")}
      </p>
    );
  }
  if (status === "CLOSED") {
    return (
      <p className="event-status-banner event-status-banner-closed" role="note">
        Evento cerrado. Consultá resultados, escrutinio y acta oficial.
      </p>
    );
  }
  return null;
}
