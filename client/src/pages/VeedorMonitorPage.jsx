import { useEffect, useState } from "react";
import { apiRequest } from "../api/http.js";

const POLLING_MS = 15_000;
const countCards = [
  ["OPEN", "En carga"],
  ["SUBMITTED", "Confirmadas"],
  ["REOPENED", "Reabiertas"],
  ["REPLACED", "Reemplazadas"],
];

function votingStatusLabel(status) {
  return {
    NOT_OPEN: "Sin abrir",
    OPEN: "Abierta",
    CLOSED: "Cerrada",
  }[status] ?? status;
}

export function VeedorMonitorPage() {
  const [events, setEvents] = useState([]);
  const [eventId, setEventId] = useState("");
  const [nightId, setNightId] = useState("");
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [lastUpdated, setLastUpdated] = useState(null);

  useEffect(() => {
    let mounted = true;
    const refresh = async () => {
      if (document.visibilityState === "hidden") return;
      try {
        const nextEvents = await apiRequest("/api/v1/monitor/events");
        if (!mounted) return;
        setEvents(nextEvents);
        setMessage("");
        setLastUpdated(new Date());
        setEventId((current) => nextEvents.some((event) => event.id === current) ? current : nextEvents[0]?.id ?? "");
      } catch {
        if (!mounted) return;
        setMessage("No se pudo cargar la supervisión. Intentá actualizar nuevamente.");
      } finally {
        if (mounted) setLoading(false);
      }
    };
    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") void refresh();
    };
    void refresh();
    const interval = window.setInterval(() => void refresh(), POLLING_MS);
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => {
      mounted = false;
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, []);

  const selectedEvent = events.find((event) => event.id === eventId);
  const nights = selectedEvent?.nights ?? [];
  const selectedNight = nights.find((night) => night.id === nightId) ?? nights[0];
  const total = selectedNight?.total ?? 0;
  const submitted = selectedNight?.counts?.SUBMITTED ?? 0;
  const progress = total > 0 ? Math.round((submitted / total) * 100) : 0;

  useEffect(() => {
    if (selectedEvent && !nights.some((night) => night.id === nightId)) {
      setNightId(nights[0]?.id ?? "");
    }
  }, [eventId, nightId, nights, selectedEvent]);

  return (
    <main className="container monitor-page">
      <header className="monitor-header">
        <div>
          <p className="eyebrow">Supervisión operativa</p>
          <h1>Estado de la votación</h1>
          <p>Conteos agregados por noche, sin puntajes ni datos de jurados.</p>
        </div>
        {lastUpdated && <p className="monitor-updated">Actualizado {lastUpdated.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</p>}
      </header>

      {message && <p className="feedback" role="alert">{message}</p>}
      {loading && <p role="status">Cargando supervisión…</p>}
      {!loading && events.length === 0 && !message && (
        <section className="empty-state"><h2>Sin actividad de votación</h2><p>Todavía no hay noches competitivas con planillas o una ventana de votación registrada.</p></section>
      )}
      {events.length > 0 && (
        <>
          <section className="monitor-selectors" aria-label="Seleccionar actividad">
            <label>Evento<select value={eventId} onChange={(event) => { setEventId(event.target.value); setNightId(""); }}>
              {events.map((event) => <option key={event.id} value={event.id}>{event.name}</option>)}
            </select></label>
            <label>Noche competitiva<select value={selectedNight?.id ?? ""} onChange={(event) => setNightId(event.target.value)}>
              {nights.map((night) => <option key={night.id} value={night.id}>{night.name}</option>)}
            </select></label>
          </section>

          {selectedNight ? (
            <>
              <section className="monitor-night-heading">
                <div><p className="eyebrow">{selectedEvent.name}</p><h2>{selectedNight.name}</h2></div>
                <span className={`monitor-status monitor-status-${selectedNight.votingStatus.toLowerCase()}`}>
                  {votingStatusLabel(selectedNight.votingStatus)}
                </span>
              </section>
              <section className="monitor-counts" aria-label="Conteos de planillas" aria-live="polite">
                {countCards.map(([key, label]) => <div className="monitor-count-card" key={key}><span>{label}</span><strong>{selectedNight.counts?.[key] ?? 0}</strong></div>)}
                <div className="monitor-count-card monitor-count-total"><span>Total votante</span><strong>{total}</strong></div>
              </section>
              <section className="monitor-progress" aria-label="Progreso de confirmación">
                <div><div><span>Confirmación de planillas</span><strong>{progress}%</strong></div><div className="progress-track"><span style={{ inlineSize: `${progress}%` }} /></div><p>{submitted} de {total} planillas confirmadas</p></div>
              </section>
            </>
          ) : <section className="empty-state"><h2>Sin noches activas</h2><p>Este evento todavía no tiene actividad de votación para supervisar.</p></section>}
        </>
      )}
    </main>
  );
}
