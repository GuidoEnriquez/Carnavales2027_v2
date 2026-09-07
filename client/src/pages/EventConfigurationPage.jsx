import { useEffect, useState } from "react";
import { apiRequest } from "../api/http.js";
import { EventReadinessPanel } from "../features/EventReadinessPanel.jsx";

const EMPTY_LIST = [];
const errorMessages = {
  EVENT_LOCKED: "El evento esta abierto y su configuracion ya no puede modificarse.",
  RESOURCE_CONFLICT: "El codigo o el orden ya esta en uso.",
  VALIDATION_ERROR: "Revisa los datos ingresados.",
};

export function EventConfigurationPage({
  event,
  nights: initialNights = EMPTY_LIST,
  onBack,
  onCompetencia,
}) {
  const [currentEvent, setCurrentEvent] = useState(event);
  const [nights, setNights] = useState(initialNights);
  const [readinessRevision, setReadinessRevision] = useState(0);
  const [message, setMessage] = useState("");
  const locked = currentEvent.status === "OPEN";

  useEffect(() => setNights(initialNights), [initialNights]);

  const save = async (path, body, { form, method = "POST", onSaved, reset = method === "POST" } = {}) => {
    try {
      const saved = await apiRequest(path, { method, body: JSON.stringify(body) });
      onSaved?.(saved);
      setReadinessRevision((revision) => revision + 1);
      setMessage("Cambios guardados.");
      if (reset) form?.reset();
      return saved;
    } catch (error) {
      setMessage(errorMessages[error.code] ?? error.message ?? "No se pudo guardar.");
      return null;
    }
  };

  const submit = (path, toBody, onSaved, method = "POST") => async (formEvent) => {
    formEvent.preventDefault();
    const form = formEvent.currentTarget;
    await save(path, toBody(new FormData(form)), { form, method, onSaved });
  };

  const replace = (setter) => (saved) => setter((current) => current.map((entry) => entry.id === saved.id ? { ...entry, ...saved } : entry));

  return (
    <main className="admin-shell">
      <header className="event-header">
        <div>
          <p className="eyebrow">{locked ? "Evento abierto" : "Evento en configuracion"}</p>
          <h1>{currentEvent.name ?? "Evento"}</h1>
        </div>
        <div className="event-actions">
          <span className={`status-pill status-${(currentEvent.status ?? "configuring").toLowerCase()}`}>{currentEvent.status ?? "CONFIGURING"}</span>
          {onCompetencia && <button type="button" onClick={onCompetencia}>Competencia</button>}
          {onBack && <button className="secondary" type="button" onClick={onBack}>Volver a eventos</button>}
        </div>
      </header>
      <p className="feedback" role="status" aria-live="polite">{message}</p>

      <section className="config-section">
        <div className="section-heading"><h2>Datos del evento</h2><p>Identidad del evento.</p></div>
        <form className="config-card" onSubmit={submit(`/api/v1/events/${event.id}`, (data) => ({ name: data.get("name") }), setCurrentEvent, "PATCH")}>
          <label>Nombre del evento<input name="name" defaultValue={currentEvent.name ?? ""} disabled={locked} required /></label>
          <button disabled={locked}>Guardar evento</button>
        </form>
      </section>

      <section className="config-section">
        <div className="section-heading"><h2>Jornadas</h2><p>Calendario de la competencia.</p></div>
        <form className="config-card" onSubmit={submit(`/api/v1/events/${event.id}/nights`, (data) => ({
          name: data.get("name"), displayOrder: Number(data.get("displayOrder")), kind: data.get("kind"), eventDate: data.get("eventDate") || null,
        }), (saved) => setNights((current) => [...current, saved]))}>
          <h3>Nueva jornada</h3>
          <label>Nombre de jornada<input name="name" disabled={locked} required /></label>
          <label>Orden<input name="displayOrder" type="number" min="1" defaultValue="1" disabled={locked} required /></label>
          <label>Fecha<input name="eventDate" type="date" disabled={locked} /></label>
          <label>Tipo<select name="kind" disabled={locked}><option value="COMPETITION">Competencia</option><option value="AWARDS">Premios</option></select></label>
          <button disabled={locked}>Agregar jornada</button>
        </form>
        <div className="records-grid">
          {nights.map((night) => <form className="record" key={night.id} onSubmit={submit(`/api/v1/nights/${night.id}`, (data) => ({
            name: data.get("name"), displayOrder: Number(data.get("displayOrder")), kind: data.get("kind"), eventDate: data.get("eventDate") || null,
          }), replace(setNights), "PATCH")}>
            <label>Editar jornada {night.name}<input name="name" defaultValue={night.name} disabled={locked} required /></label>
            <label>Orden<input name="displayOrder" type="number" min="1" defaultValue={night.displayOrder} disabled={locked} required /></label>
            <label>Fecha<input name="eventDate" type="date" defaultValue={night.eventDate?.slice?.(0, 10) ?? ""} disabled={locked} /></label>
            <label>Tipo<select name="kind" defaultValue={night.kind} disabled={locked}><option value="COMPETITION">Competencia</option><option value="AWARDS">Premios</option></select></label>
            <button disabled={locked}>Guardar {night.name}</button>
          </form>)}
        </div>
      </section>

      <EventReadinessPanel
        event={currentEvent}
        locked={locked}
        refreshKey={readinessRevision}
        onOpened={(openedEvent) => setCurrentEvent((current) => ({ ...current, ...openedEvent }))}
      />
    </main>
  );
}
