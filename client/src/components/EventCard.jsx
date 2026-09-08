import { StatusPill } from "./StatusPill.jsx";

export function EventCard({ event, onSelect }) {
  const handleKeyDown = (e) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      onSelect(event);
    }
  };

  return (
    <article
      className="event-card"
      role="button"
      tabIndex={0}
      onClick={() => onSelect(event)}
      onKeyDown={handleKeyDown}
    >
      <span className="event-card-name">{event.name}</span>
      <StatusPill status={event.status} />
    </article>
  );
}
