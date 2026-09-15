import { useEffect, useState } from "react";
import { PageShell } from "../components/PageShell.jsx";
import { apiRequest } from "../api/http.js";
import { EventReadinessPanel } from "../features/EventReadinessPanel.jsx";

const EMPTY_LIST = [];
const errorMessages = {
  EVENT_LOCKED: "El evento esta abierto y su configuracion ya no puede modificarse.",
  RESOURCE_CONFLICT: "El codigo o el orden ya esta en uso.",
  VALIDATION_ERROR: "Revisa los datos ingresados.",
  NIGHT_DATE_REQUIRED: "La jornada debe tener una fecha.",
  NIGHT_DATE_DUPLICATE: "Ya existe una jornada con esa fecha en este evento.",
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
      await onSaved?.(saved);
      setReadinessRevision((revision) => revision + 1);
      setMessage("Cambios guardados.");
      if (reset) form?.reset();
      return saved;
    } catch (error) {
      setMessage(errorMessages[error.code] ?? error.message ?? "No se pudo guardar.");
      return null;
    }
  };

  const refreshNights = async () => {
    try {
      const data = await apiRequest(`/api/v1/events/${event.id}/nights`);
      setNights(data);
    } catch {
      setMessage("No se pudieron recargar las jornadas.");
    }
  };

  const submit = (path, toBody, onSaved, method = "POST") => async (formEvent) => {
    formEvent.preventDefault();
    const form = formEvent.currentTarget;
    await save(path, toBody(new FormData(form)), { form, method, onSaved });
  };

  return (
    <PageShell layer="instrument" className="admin-shell">
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
          name: data.get("name"), kind: data.get("kind"), eventDate: data.get("eventDate") || null,
        }), refreshNights)}>
          <h3>Nueva jornada</h3>
          <label>Nombre de jornada<input name="name" disabled={locked} required /></label>
          <label>Fecha<input name="eventDate" type="date" disabled={locked} required /></label>
          <label>Tipo<select name="kind" disabled={locked}><option value="COMPETITION">Competencia</option><option value="AWARDS">Premios</option></select></label>
          <button disabled={locked}>Agregar jornada</button>
        </form>
        <div className="records-grid">
          {nights.map((night) => <form className="record" key={night.id} onSubmit={submit(`/api/v1/nights/${night.id}`, (data) => ({
            name: data.get("name"), kind: data.get("kind"), eventDate: data.get("eventDate") || null,
          }), refreshNights, "PATCH")}>
            <label>Editar jornada {night.name}<input name="name" defaultValue={night.name} disabled={locked} required /></label>
            <label>Fecha<input name="eventDate" type="date" defaultValue={night.eventDate?.slice?.(0, 10) ?? ""} disabled={locked} required /></label>
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
    </PageShell>
  );
}
