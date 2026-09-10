import { StatusPill } from "./StatusPill.jsx";

const EVENT_STATUS_LABELS = {
  CONFIGURING: "En configuración",
  OPEN: "Competencia abierta",
  CLOSED: "Evento cerrado",
};

export function EventCard({ event, onSelect, active = false }) {
  return (
    <button
      type="button"
      className={`event-card${active ? " is-active" : ""}`}
      onClick={() => onSelect(event)}
      aria-label={active ? `Evento activo: ${event.name}` : `Usar ${event.name}`}
      aria-pressed={active}
    >
      <span className="event-card-name">{event.name}</span>
      <StatusPill status={event.status} label={EVENT_STATUS_LABELS[event.status] ?? event.status} />
      {active && <span className="event-card-active">Evento activo</span>}
    </button>
  );
}
