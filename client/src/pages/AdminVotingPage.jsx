import { useEffect, useState } from "react";
import { apiRequest } from "../api/http.js";

export function AdminVotingPage() {
  const [events, setEvents] = useState([]);
  const [nights, setNights] = useState([]);
  const [ballots, setBallots] = useState([]);
  const [status, setStatus] = useState(null);
  const [eventId, setEventId] = useState("");
  const [nightId, setNightId] = useState("");
  const [busy, setBusy] = useState("");
  const [message, setMessage] = useState("");

  const refreshNight = async (selectedEventId = eventId, selectedNightId = nightId) => {
    if (!selectedEventId || !selectedNightId) return;
    try {
      const [nextStatus, nextBallots] = await Promise.all([
        apiRequest(`/api/v1/events/${selectedEventId}/nights/${selectedNightId}/voting/status`),
        apiRequest(`/api/v1/events/${selectedEventId}/nights/${selectedNightId}/voting/ballots`),
      ]);
      setStatus(nextStatus);
      setBallots(nextBallots);
    } catch {
      setStatus(null);
      setBallots([]);
      setMessage("No se pudo cargar el estado de votación.");
    }
  };

  useEffect(() => {
    void apiRequest("/api/v1/events").then((items) => {
      setEvents(items);
      if (items[0]) setEventId(items[0].id);
    }).catch(() => setMessage("No se pudieron cargar los eventos."));
  }, []);

  useEffect(() => {
    if (!eventId) return;
    void apiRequest(`/api/v1/events/${eventId}/nights`).then((items) => {
      const competitionNights = items.filter((night) => night.kind === "COMPETITION");
      setNights(competitionNights);
      setNightId(competitionNights[0]?.id ?? "");
      setStatus(null);
      setBallots([]);
    }).catch(() => setMessage("No se pudieron cargar las noches del evento."));
  }, [eventId]);

  useEffect(() => { void refreshNight(); }, [eventId, nightId]);

  const action = async (key, operation, success) => {
    if (!eventId || !nightId || busy) return;
    setBusy(key);
    setMessage("");
    try {
      const result = await operation();
      setMessage(success(result));
      await refreshNight();
    } catch (error) {
      const messages = {
        EVENT_NOT_OPEN: "El evento debe estar abierto para habilitar la votación.",
        NIGHT_NOT_OPEN: "La noche no está disponible para votar.",
        BALLOT_NOT_SUBMITTED: "Solo se pueden reabrir planillas confirmadas.",
        BALLOT_MAX_REOPENS_REACHED: "La planilla ya alcanzó su única reapertura permitida.",
      };
      setMessage(messages[error.code] ?? "No se pudo completar la operación.");
    } finally {
      setBusy("");
    }
  };

  const reopen = async (ballotId, form) => {
    const reason = new FormData(form).get("reason");
    await action(`reopen-${ballotId}`, () => apiRequest(`/api/v1/events/${eventId}/ballots/${ballotId}/reopen`, {
      method: "POST", body: JSON.stringify({ reason }),
    }), () => "Planilla reabierta para corrección.");
    form.reset();
  };

  return <main className="admin-shell voting-page">
    <header className="event-header">
      <div><p className="eyebrow">Mesa de control</p><h1>Votación por noche</h1></div>
      <div className="voting-pickers">
        <label>Evento<select value={eventId} onChange={(event) => setEventId(event.target.value)}>{events.map((event) => <option key={event.id} value={event.id}>{event.name}</option>)}</select></label>
        <label>Noche<select value={nightId} onChange={(event) => setNightId(event.target.value)}>{nights.map((night) => <option key={night.id} value={night.id}>{night.name}</option>)}</select></label>
      </div>
    </header>
    <p className="feedback" role="status" aria-live="polite">{message}</p>
    {nightId && <>
      <section className="voting-summary" aria-label="Estado de planillas">
        <div><span>En carga</span><strong>{status?.counts.OPEN ?? 0}</strong></div>
        <div><span>Confirmadas</span><strong>{status?.counts.SUBMITTED ?? 0}</strong></div>
        <div><span>Reabiertas</span><strong>{status?.counts.REOPENED ?? 0}</strong></div>
        <div><span>Total</span><strong>{status?.total ?? 0}</strong></div>
      </section>
      <section className="config-section">
        <div className="section-heading"><div><h2>Ventana de votación</h2><p>La apertura crea las planillas pendientes. El cierre exige que todas estén completas y confirma las que sigan en carga.</p></div></div>
        <div className="event-actions"><button type="button" disabled={Boolean(busy)} onClick={() => void action("open", () => apiRequest(`/api/v1/events/${eventId}/nights/${nightId}/voting/open`, { method: "POST" }), (result) => `${result.ballotsCreated} planilla(s) habilitada(s).`)}>Abrir votación</button><button className="danger-action" type="button" disabled={Boolean(busy)} onClick={() => void action("close", () => apiRequest(`/api/v1/events/${eventId}/nights/${nightId}/voting/close`, { method: "POST" }), (result) => `${result.autoSubmitted} planilla(s) confirmada(s) al cerrar.`)}>Cerrar votación</button></div>
      </section>
      <section className="assignment-grid" aria-label="Planillas de la noche">
        {ballots.length === 0 && <p className="empty-state">Todavía no hay planillas para esta noche.</p>}
        {ballots.map((ballot) => <article className="assignment-card" key={ballot.id}>
          <div className="judge-card-heading"><div><p className="eyebrow">{ballot.specialtyName}</p><h2>{ballot.judgeName}</h2><p>{ballot.status === "SUBMITTED" ? "Confirmada" : ballot.status === "REOPENED" ? "Reabierta" : "En carga"}</p></div><span className="status-pill">{ballot.status}</span></div>
          {ballot.status === "SUBMITTED" && ballot.reopenCount === 0 && <form className="reopen-form" onSubmit={(event) => { event.preventDefault(); void reopen(ballot.id, event.currentTarget); }}><label>Motivo de reapertura<input name="reason" required /></label><button disabled={Boolean(busy)}>Reabrir una vez</button></form>}
        </article>)}
      </section>
    </>}
  </main>;
}
