import { useEffect, useMemo, useRef, useState } from "react";
import { apiRequest } from "../api/http.js";
import { CeremonialDrawModal } from "../features/results/CeremonialDrawModal.jsx";
import { useSession } from "../auth/session-context.jsx";

function nameFor(troupes, id) {
  return troupes.find((troupe) => troupe.id === id)?.name ?? id;
}

export function AdminResultsPage() {
  const session = useSession();
  const canRelease = session?.roles?.some((role) => ["SCRUTINEER", "ESCRIBANO"].includes(role));
  const [events, setEvents] = useState([]);
  const [eventId, setEventId] = useState("");
  const [troupes, setTroupes] = useState([]);
  const [result, setResult] = useState(null);
  const [tie, setTie] = useState(null);
  const [drawResult, setDrawResult] = useState(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [releaseAvailable, setReleaseAvailable] = useState(false);
  const [refreshVersion, setRefreshVersion] = useState(0);
  const [releasing, setReleasing] = useState(false);
  const drawTriggerRef = useRef(null);

  useEffect(() => {
    let active = true;
    void apiRequest("/api/v1/results/events").then((items) => {
      if (!active) return;
      setEvents(items);
      setEventId(items[0]?.id ?? "");
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
    setReleaseAvailable(false);
    setMessage("");

    void Promise.allSettled([
      apiRequest(`/api/v1/results/events/${eventId}/troupes`),
      apiRequest(`/api/v1/events/${eventId}/results`),
    ]).then(async ([troupesResponse, resultsResponse]) => {
      if (!active) return;
      if (troupesResponse.status === "fulfilled") setTroupes(troupesResponse.value);
      else setTroupes([]);
      if (resultsResponse.status === "fulfilled") {
        setResult(resultsResponse.value);
        setTie(null);
      } else if (resultsResponse.reason?.code === "RESULTS_NOT_RELEASED") {
        setReleaseAvailable(true);
        setMessage("Los resultados estan listos para liberar en la etapa de escrutinio.");
      } else if (resultsResponse.reason?.code === "TIE_BREAKER_REQUIRES_MANUAL_DRAW") {
        const details = resultsResponse.reason.details ?? {};
        setTie({
          remainingTroupeIds: details.remainingTroupeIds ?? [],
          context: details.tieBreakerContext ?? {},
        });
        setMessage("Empate pendiente: los criterios 1 y 2 no definieron una ganadora.");
        try {
          const draw = await apiRequest(`/api/v1/events/${eventId}/tie-breaker/ceremonial-draw`);
          if (active) setDrawResult(draw);
        } catch (error) {
          if (error.code !== "TIE_BREAKER_DRAW_NOT_FOUND" && active) {
            setMessage("No se pudo recuperar el resultado del sorteo ceremonial.");
          }
        }
      } else {
        setMessage("No se pudieron cargar los resultados.");
      }
    }).finally(() => {
      if (active) setLoading(false);
    });
    return () => { active = false; };
  }, [eventId, refreshVersion]);

  const release = async () => {
    if (!eventId || releasing) return;
    setReleasing(true);
    setMessage("");
    try {
      await apiRequest(`/api/v1/events/${eventId}/results/release`, { method: "POST" });
      setRefreshVersion((version) => version + 1);
    } catch (error) {
      if (error?.code === "RESULTS_RELEASE_FORBIDDEN_FOR_ADMIN") {
        setMessage("La liberación oficial de resultados corresponde a Escrutinio o Escribanía; el Administrador no puede liberarlos.");
      } else if (error?.code === "RESULTS_NOT_READY") {
        setMessage("No se pueden liberar: la votación debe estar cerrada y todas las planillas votantes confirmadas.");
      } else {
        setMessage("No se pudieron liberar los resultados.");
      }
    } finally {
      setReleasing(false);
    }
  };

  const tiedNames = useMemo(
    () => (tie?.remainingTroupeIds ?? []).map((id) => ({ id, name: nameFor(troupes, id) })),
    [tie, troupes],
  );
  const selectedEvent = events.find((event) => event.id === eventId);
  const workflowSteps = [
    { label: "Revisar consolidación", state: result || releaseAvailable ? "done" : "current" },
    { label: "Liberar resultados", state: result ? "done" : releaseAvailable ? "current" : "locked" },
    { label: "Resolver desempate", state: result && !tie ? "skipped" : drawResult ? "done" : tie ? "current" : "locked" },
    { label: "Emitir acta oficial", state: result && (!tie || drawResult) ? "current" : "locked" },
  ];

  return (
    <main className="admin-shell results-page" data-layer="brand">
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
            {releaseAvailable && (
              canRelease ? (
                <button type="button" onClick={release} disabled={releasing}>
                  {releasing ? "Liberando resultados..." : "Liberar resultados"}
                </button>
              ) : (
                <p className="admin-release-notice" role="note">
                  La liberación oficial de resultados corresponde exclusivamente a Escrutinio o Escribanía.
                </p>
              )
            )}
           </section>

           <ol className="workflow-stepper" aria-label="Flujo de escrutinio">
             {workflowSteps.map((step, index) => <li className={`workflow-step workflow-step-${step.state}`} key={step.label}>
               <span className="workflow-step-number" aria-hidden="true">{index + 1}</span>
               <div><strong>{step.label}</strong><span>{step.state === "done" ? "Listo" : step.state === "current" ? "En curso" : step.state === "skipped" ? "No requerido" : "Bloqueado"}</span></div>
             </li>)}
           </ol>

           {!result && (
             <section className="release-conditions-card" aria-label="Condiciones para liberación de resultados">
               <h3>Condiciones previas para liberar resultados (RF-94a)</h3>
               <ul className="release-conditions-list">
                 <li className={selectedEvent.status === "CLOSED" || releaseAvailable ? "is-met" : "is-pending"}>
                   <span className="condition-bullet" aria-hidden="true">{selectedEvent.status === "CLOSED" || releaseAvailable ? "✓" : "○"}</span>
                   <span>Votación de todas las jornadas cerrada por el Administrador.</span>
                 </li>
                 <li className={releaseAvailable ? "is-met" : "is-pending"}>
                   <span className="condition-bullet" aria-hidden="true">{releaseAvailable ? "✓" : "○"}</span>
                   <span>Todas las planillas en estado Confirmada (SUBMITTED) o Reemplazada (REPLACED).</span>
                 </li>
                 <li className={releaseAvailable ? "is-met" : "is-pending"}>
                   <span className="condition-bullet" aria-hidden="true">{releaseAvailable ? "✓" : "○"}</span>
                   <span>Cero ítems pendientes de calificación (SCORED o NOT_PRESENTED completos).</span>
                 </li>
                 <li className={canRelease ? "is-met" : "is-warning"}>
                   <span className="condition-bullet" aria-hidden="true">{canRelease ? "✓" : "🔒"}</span>
                   <span>Rol autorizado: Escrutinio (SCRUTINEER) o Escribanía (ESCRIBANO) con 2FA verificado.</span>
                 </li>
               </ul>
             </section>
           )}

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

          {result && (
            <section className="results-ranking" aria-labelledby="results-ranking-title">
              <div className="section-heading">
                <div>
                  <h2 id="results-ranking-title">Ranking general</h2>
                  <p>Solo rubros nominativos participan en Mejor Comparsa.</p>
                </div>
              </div>
              <div className="results-table" role="table" aria-label="Ranking general de comparsas">
                <div className="results-header-row" role="row">
                  <span role="columnheader">Puesto</span>
                  <span role="columnheader">Comparsa</span>
                  <span role="columnheader" className="results-num-col">Puntaje bruto</span>
                  <span role="columnheader" className="results-num-col">Penalizaciones</span>
                  <span role="columnheader" className="results-num-col">Puntaje final neto</span>
                </div>
                {result.overallRanking.map((troupe) => {
                  const gross = troupe.grossScore ?? troupe.totalScore ?? 0;
                  const penalties = troupe.totalPenalties ?? troupe.penaltyPoints ?? 0;
                  const net = troupe.netScore ?? troupe.totalScore ?? Math.max(0, gross - penalties);
                  return (
                    <div className="results-row" role="row" key={troupe.troupeId}>
                      <span role="cell" className="results-rank">#{troupe.rank}</span>
                      <strong role="cell" className="results-troupe-name">{troupe.troupeName}</strong>
                      <span role="cell" className="results-col-gross" data-label="Puntaje bruto">{gross} pts</span>
                      <span role="cell" className="results-col-penalties" data-label="Penalizaciones">
                        {penalties > 0 ? `−${penalties} pts` : "0 pts"}
                      </span>
                      <span role="cell" className="results-col-net" data-label="Puntaje final neto">{net} pts</span>
                    </div>
                  );
                })}
              </div>
            </section>
          )}
          {result && (
            <section className="official-record-banner" aria-label="Acta Oficial">
              <div>
                <h3>Acta Notarial Oficial</h3>
                <p>Emisión formal, sellado de integridad digital y firmas de autoridades y delegados.</p>
              </div>
              <a className="button-link" href={`#/admin/record?eventId=${encodeURIComponent(eventId)}`}>
                📜 Ver / Emitir Acta Oficial →
              </a>
            </section>
          )}
        </>
      )}
      {modalOpen && tie && <CeremonialDrawModal
        eventId={eventId}
        remainingTroupeIds={tie.remainingTroupeIds}
        tiedTroupeNames={tiedNames}
        triggerRef={drawTriggerRef}
        onClose={() => setModalOpen(false)}
        onResolved={setDrawResult}
      />}
    </main>
  );
}
