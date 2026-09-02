import { useEffect, useMemo, useRef, useState } from "react";
import { apiRequest } from "../api/http.js";
import { CeremonialDrawModal } from "../features/results/CeremonialDrawModal.jsx";

function nameFor(troupes, id) {
  return troupes.find((troupe) => troupe.id === id)?.name ?? id;
}

export function AdminResultsPage() {
  const [events, setEvents] = useState([]);
  const [eventId, setEventId] = useState("");
  const [troupes, setTroupes] = useState([]);
  const [result, setResult] = useState(null);
  const [tie, setTie] = useState(null);
  const [drawResult, setDrawResult] = useState(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const drawTriggerRef = useRef(null);

  useEffect(() => {
    let active = true;
    void apiRequest("/api/v1/results/events").then((items) => {
      if (!active) return;
      setEvents(items);
      const testEvent = items.find((item) => item.name === "test_prueba");
      setEventId(testEvent?.id ?? items[0]?.id ?? "");
    }).catch(() => {
      if (active) {
        setEvents([]);
        setEventId("");
        setLoading(false);
        setMessage("No se pudieron cargar las competencias. Verificá que la API esté disponible y tu sesión siga activa.");
      }
    });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!eventId) return undefined;
    let active = true;
    setLoading(true);
    setResult(null);
    setTie(null);
    setDrawResult(null);
    setMessage("");

    void Promise.allSettled([
      apiRequest(`/api/v1/results/events/${eventId}/troupes`),
      apiRequest(`/api/v1/events/${eventId}/results`),
    ]).then(([troupesResponse, resultsResponse]) => {
      if (!active) return;
      if (troupesResponse.status === "fulfilled") setTroupes(troupesResponse.value);
      else setTroupes([]);
      if (resultsResponse.status === "fulfilled") {
        setResult(resultsResponse.value);
        setTie(null);
      } else if (resultsResponse.reason?.code === "TIE_BREAKER_REQUIRES_MANUAL_DRAW") {
        const details = resultsResponse.reason.details ?? {};
        setTie({
          remainingTroupeIds: details.remainingTroupeIds ?? [],
          context: details.tieBreakerContext ?? {},
        });
        setMessage("Empate pendiente: los criterios 1 y 2 no definieron una ganadora.");
      } else {
        setMessage("No se pudieron cargar los resultados.");
      }
    }).finally(() => {
      if (active) setLoading(false);
    });
    return () => { active = false; };
  }, [eventId]);

  const tiedNames = useMemo(
    () => (tie?.remainingTroupeIds ?? []).map((id) => ({ id, name: nameFor(troupes, id) })),
    [tie, troupes],
  );
  const selectedEvent = events.find((event) => event.id === eventId);

  return (
    <main className="admin-shell results-page">
      <header className="event-header">
        <div>
          <p className="eyebrow">Escrutinio autorizado</p>
          <h1>Resultados</h1>
        </div>
        <label>Competencia
          <select value={eventId} onChange={(event) => setEventId(event.target.value)}>
            {events.map((event) => <option key={event.id} value={event.id}>{event.name}</option>)}
          </select>
        </label>
      </header>

      <p className="feedback" role="status" aria-live="polite">{message}</p>
      {loading && <p>Cargando resultados…</p>}
      {!loading && selectedEvent && (
        <>
          <section className="config-section results-intro">
            <p className="eyebrow">{selectedEvent.name}</p>
            <h2>Mejor Comparsa</h2>
            <p>Resultados consolidados de rubros nominativos, liberados para escrutinio.</p>
          </section>

          {tie && (
            <section className="tie-breaker-panel" aria-labelledby="tie-breaker-title">
              <div>
                <p className="eyebrow">Criterio 3</p>
                <h2 id="tie-breaker-title">Empate pendiente</h2>
                <p>El sorteo ceremonial debe ejecutarse entre las comparsas que siguen empatadas.</p>
              </div>
              <ul className="tie-breaker-pool" aria-label="Comparsas empatadas">
                {tiedNames.map((troupe) => <li key={troupe.id}><strong>{troupe.name}</strong><span>Rubros ganados: {tie.context.wonRubricsCounts?.find((item) => item.troupeId === troupe.id)?.wonRubrics ?? "—"}</span></li>)}
              </ul>
              {drawResult ? (
                <p className="results-winner" role="status">Ganadora: <strong>{nameFor(troupes, drawResult.winnerTroupeId)}</strong></p>
              ) : (
                <button ref={drawTriggerRef} type="button" onClick={() => setModalOpen(true)}>Iniciar sorteo ceremonial</button>
              )}
            </section>
          )}

          {result && <section className="results-ranking" aria-labelledby="results-ranking-title">
            <div className="section-heading"><div><h2 id="results-ranking-title">Ranking general</h2><p>Solo rubros nominativos participan en Mejor Comparsa.</p></div></div>
            <div className="results-table" role="table" aria-label="Ranking general de comparsas">
              {result.overallRanking.map((troupe) => <div className="results-row" role="row" key={troupe.troupeId}>
                <span role="cell" className="results-rank">#{troupe.rank}</span>
                <strong role="cell">{troupe.troupeName}</strong>
                <span role="cell">{troupe.totalScore} puntos</span>
              </div>)}
            </div>
          </section>}
        </>
      )}
      {modalOpen && tie && <CeremonialDrawModal
        eventId={eventId}
        remainingTroupeIds={tie.remainingTroupeIds}
        appliedCriteria={["WON_NOMINATIVE_RUBRICS_COUNT", "BATTERY_RUBRIC_WINNER"]}
        tiedTroupeNames={tiedNames}
        triggerRef={drawTriggerRef}
        onClose={() => setModalOpen(false)}
        onResolved={(draw) => { setDrawResult(draw); setModalOpen(false); }}
      />}
    </main>
  );
}
