import { useEffect, useRef, useState } from "react";
import { PageShell } from "../components/PageShell.jsx";

function TrophyIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="36"
      height="36"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6" />
      <path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18" />
      <path d="M4 22h16" />
      <path d="M10 14.66V17c0 .55-.45 1-1 1H8c-.55 0-1 .45-1 1v1c0 .55.45 1 1 1h8c.55 0 1-.45 1-1v-1c0-.55-.45-1-1-1h-1c-.55 0-1-.45-1-1v-2.34" />
      <path d="M18 4H6v7a6 6 0 0 0 12 0V4Z" />
    </svg>
  );
}

function ShieldCheckIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z" />
      <path d="m9 12 2 2 4-4" />
    </svg>
  );
}

function CopyIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <rect width="14" height="14" x="8" y="8" rx="2" ry="2" />
      <path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2" />
    </svg>
  );
}

export function PublicResultsPage({ initialEventId = null }) {
  const [events, setEvents] = useState([]);
  const [selectedEventId, setSelectedEventId] = useState(initialEventId);
  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [notReleased, setNotReleased] = useState(false);
  const [liveStatus, setLiveStatus] = useState("connecting"); // connecting, live, polling, offline
  const [copyFeedback, setCopyFeedback] = useState(null);
  const pollingRef = useRef(null);
  const eventSourceRef = useRef(null);

  // 1. Cargar lista de eventos públicos
  useEffect(() => {
    fetch("/api/v1/public/events")
      .then((res) => {
        if (!res.ok) throw new Error("Error al cargar eventos públicos");
        return res.json();
      })
      .then((data) => {
        const evts = data.events || [];
        setEvents(evts);
        if (!selectedEventId && evts.length > 0) {
          setSelectedEventId(evts[0].id);
        }
      })
      .catch((err) => {
        console.error("Error al listar eventos:", err);
      });
  }, [initialEventId]);

  // 2. Cargar resultados del evento seleccionado
  const fetchResults = (eventId) => {
    if (!eventId) {
      setLoading(false);
      return;
    }
    fetch(`/api/v1/public/events/${eventId}/results`)
      .then(async (res) => {
        if (res.status === 404) {
          const body = await res.json().catch(() => ({}));
          if (body.code === "RESULTS_NOT_RELEASED") {
            setNotReleased(true);
            setResults(null);
            setError(null);
            setLoading(false);
            return;
          }
        }
        if (!res.ok) {
          throw new Error(`Error ${res.status}: no se pudieron cargar los resultados`);
        }
        const data = await res.json();
        setResults(data);
        setNotReleased(false);
        setError(null);
        setLoading(false);
      })
      .catch((err) => {
        console.error("Error al consultar resultados:", err);
        setError("No se pudieron cargar los resultados oficiales.");
        setLoading(false);
      });
  };

  useEffect(() => {
    if (selectedEventId) {
      fetchResults(selectedEventId);
    }
  }, [selectedEventId]);

  // 3. Canal SSE en tiempo real con fallback a polling (RF-213, RF-216)
  useEffect(() => {
    let es;
    try {
      es = new EventSource("/api/v1/public/stream");
      eventSourceRef.current = es;

      es.addEventListener("connected", () => {
        setLiveStatus("live");
      });

      es.addEventListener("results_updated", (e) => {
        try {
          const payload = JSON.parse(e.data);
          if (!selectedEventId || payload.eventId === selectedEventId) {
            fetchResults(selectedEventId);
          }
        } catch {
          fetchResults(selectedEventId);
        }
      });

      es.onerror = () => {
        setLiveStatus("polling");
        es.close();
      };
    } catch {
      setLiveStatus("polling");
    }

    return () => {
      if (es) es.close();
    };
  }, [selectedEventId]);

  // Polling de respaldo si SSE está en polling
  useEffect(() => {
    if (liveStatus === "polling" && selectedEventId) {
      pollingRef.current = setInterval(() => {
        fetchResults(selectedEventId);
      }, 30000);
    } else {
      if (pollingRef.current) clearInterval(pollingRef.current);
    }
    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current);
    };
  }, [liveStatus, selectedEventId]);

  // 4. Copiar Sello Notarial al portapapeles
  const copyNotarialSeal = () => {
    if (!results?.officialRecord) return;
    const textToCopy = `ACTA OFICIAL: ${results.officialRecord.recordNumber}\nSELLO CRIPTOGRÁFICO SHA-256: ${results.officialRecord.recordHash}\nROL: ${results.officialRecord.certifiedRole}`;
    navigator.clipboard
      .writeText(textToCopy)
      .then(() => {
        setCopyFeedback("¡Sello notarial copiado al portapapeles!");
        setTimeout(() => setCopyFeedback(null), 3000);
      })
      .catch(() => {
        setCopyFeedback("No se pudo copiar automáticamente.");
      });
  };

  const handleEventChange = (e) => {
    const newId = e.target.value;
    setSelectedEventId(newId);
    window.location.hash = `#/resultados?eventId=${newId}`;
  };

  return (
    <PageShell layer="brand" id="main-content" className="public-portal-container">
      {/* Barra de cabecera institucional */}
      <header className="public-portal-header">
        <div className="public-header-content">
          <div className="public-brand">
            <span className="public-brand-flag" aria-hidden="true">🎭</span>
            <div>
              <span className="public-brand-sub">Carnavales Oficiales</span>
              <h1 className="public-brand-title">Portal de Resultados</h1>
            </div>
          </div>
          <div className="public-header-actions">
            <div
              className={`live-indicator-badge is-${liveStatus}`}
              role="status"
              aria-live="polite"
              title={liveStatus === "live" ? "Conectado al canal en tiempo real" : "Actualización periódica activa"}
            >
              <span className="live-dot" aria-hidden="true" />
              {liveStatus === "live" && "En vivo"}
              {liveStatus === "polling" && "Respaldo (30s)"}
              {liveStatus === "connecting" && "Conectando..."}
              {liveStatus === "offline" && "Sin conexión"}
            </div>
            <a href="#/login" className="public-login-link">
              Acceso Operativo
            </a>
          </div>
        </div>
      </header>

      <div className="public-portal-body">
        {/* Selector de Evento */}
        {events.length > 1 && (
          <div className="public-event-selector-bar">
            <label htmlFor="public-event-select">Seleccionar Evento:</label>
            <select
              id="public-event-select"
              value={selectedEventId || ""}
              onChange={handleEventChange}
              className="public-event-select"
            >
              {events.map((ev) => (
                <option key={ev.id} value={ev.id}>
                  {ev.name}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Estado de Carga */}
        {loading && (
          <div className="public-state-card" role="status">
            <p>Cargando resultados oficiales...</p>
          </div>
        )}

        {/* Estado: Resultados No Liberados */}
        {!loading && notReleased && (
          <section className="public-unreleased-card" aria-labelledby="unreleased-title">
            <div className="unreleased-icon" aria-hidden="true">⏳</div>
            <h2 id="unreleased-title">Resultados en Proceso de Escrutinio</h2>
            <p className="unreleased-lead">
              Las planillas y el cómputo final para este evento aún no han sido liberados por las autoridades notariales.
            </p>
            <p className="unreleased-subtext">
              Esta pantalla se actualizará automáticamente y en tiempo real en cuanto el escrutinio oficial finalice.
            </p>
          </section>
        )}

        {/* Estado: Error */}
        {!loading && error && !notReleased && (
          <div className="public-state-card is-error" role="alert">
            <p>{error}</p>
            <button
              type="button"
              className="secondary"
              onClick={() => fetchResults(selectedEventId)}
            >
              Reintentar
            </button>
          </div>
        )}

        {/* Resultados Disponibles */}
        {!loading && results && (
          <>
            {/* Hero de Comparsa Campeona */}
            <section className="champion-honor-card" aria-labelledby="champion-title">
              <div className="champion-badge">
                <TrophyIcon />
              </div>
              <div className="champion-info">
                <span className="champion-label">Comparsa Campeona Oficial</span>
                <h2 id="champion-title" className="champion-name">
                  {results.bestTroupe.winnerTroupeName || "Comparsa Ganadora"}
                </h2>
                <div className="champion-score-banner">
                  <span className="champion-score-value">
                    {results.overallRanking[0]?.netScore}
                  </span>
                  <span className="champion-score-unit">Puntos Netos</span>
                </div>
                {results.bestTroupe.tieBreaker && (
                  <div className="champion-tiebreaker-notice" role="note">
                    <span className="tiebreaker-tag">Resolución de Empate</span>
                    <p>
                      {results.bestTroupe.tieBreaker.appliedCriteria?.includes("BATTERY_RUBRIC_WINNER")
                        ? "Desempate resuelto por ganadora en Mejor Batería."
                        : results.bestTroupe.tieBreaker.appliedCriteria?.includes("WON_NOMINATIVE_RUBRICS_COUNT")
                        ? "Desempate resuelto por mayor cantidad de rubros nominativos ganados."
                        : "Desempate reglamentario aplicado."}
                    </p>
                  </div>
                )}
              </div>
            </section>

            {/* Tabla de Ranking General */}
            <section className="public-section" aria-labelledby="ranking-title">
              <div className="public-section-header">
                <h3 id="ranking-title">Ranking General de Comparsas</h3>
                <span className="public-section-badge">Rubros Nominativos</span>
              </div>
              <div className="public-table-wrapper">
                <table className="public-ranking-table">
                  <caption className="sr-only">
                    Ranking General Oficial de Comparsas — Carnavales Goya 2027
                  </caption>
                  <thead>
                    <tr>
                      <th scope="col" className="col-rank">Puesto</th>
                      <th scope="col" className="col-troupe">Comparsa</th>
                      <th scope="col" className="col-num">Bruto</th>
                      <th scope="col" className="col-num">Penalizaciones</th>
                      <th scope="col" className="col-num col-net">Neto</th>
                    </tr>
                  </thead>
                  <tbody>
                    {results.overallRanking.map((t, idx) => (
                      <tr
                        key={t.troupeId}
                        className={idx === 0 ? "is-winner-row" : undefined}
                      >
                        <td className="col-rank">
                          <span className={`rank-pill rank-${t.rank}`}>
                            {idx === 0 ? "🥇 1" : idx === 1 ? "🥈 2" : idx === 2 ? "🥉 3" : t.rank}
                          </span>
                        </td>
                        <td className="col-troupe">
                          <strong>{t.troupeName}</strong>
                        </td>
                        <td className="col-num">{t.grossScore}</td>
                        <td className="col-num col-penalty">
                          {t.totalPenalties > 0 ? `-${t.totalPenalties}` : "0"}
                        </td>
                        <td className="col-num col-net">
                          <strong>{t.netScore}</strong>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            {/* Ganadores por Rubro Artístico */}
            {results.rubricRankings && results.rubricRankings.length > 0 && (
              <section className="public-section" aria-labelledby="rubrics-title">
                <div className="public-section-header">
                  <h3 id="rubrics-title">Ganadores por Rubro</h3>
                  <span className="public-section-badge">Evaluación Artística</span>
                </div>
                <div className="rubrics-cards-grid">
                  {results.rubricRankings.map((rubric) => (
                    <div key={rubric.rubricId} className="rubric-result-card">
                      <div className="rubric-card-header">
                        <span className="rubric-kind-tag">{rubric.rubricCode}</span>
                        <h4>{rubric.rubricName}</h4>
                      </div>
                      <div className="rubric-winners-list">
                        {rubric.winners && rubric.winners.length > 0 ? (
                          rubric.winners.map((winner) => (
                            <div key={winner.troupeId} className="rubric-winner-entry">
                              <span className="winner-troupe-name">{winner.troupeName}</span>
                              <span className="winner-troupe-score">{winner.totalScore} pts</span>
                            </div>
                          ))
                        ) : (
                          <p className="no-rubric-winner">Sin ganador registrado</p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* Certificación Notarial y Sello Criptográfico */}
            <section className="public-section" aria-labelledby="notarial-title">
              <div className="notarial-seal-card">
                <div className="notarial-header">
                  <div className="notarial-title-group">
                    <ShieldCheckIcon />
                    <div>
                      <h3 id="notarial-title">Certificación Notarial de Escrutinio</h3>
                      <span className="notarial-subtitle">
                        Integridad criptográfica y respaldo legal del resultado
                      </span>
                    </div>
                  </div>
                  {results.officialRecord ? (
                    <span className="notarial-verified-badge">✓ Acta Certificada</span>
                  ) : (
                    <span className="notarial-pending-badge">Pendiente de Certificación</span>
                  )}
                </div>

                {results.officialRecord ? (
                  <div className="notarial-body">
                    <div className="notarial-grid">
                      <div className="notarial-field">
                        <span className="field-label">Número de Acta</span>
                        <strong className="field-value">
                          {results.officialRecord.recordNumber}
                        </strong>
                      </div>
                      <div className="notarial-field">
                        <span className="field-label">Autoridad Certificante</span>
                        <strong className="field-value">
                          {results.officialRecord.certifiedRole}
                        </strong>
                      </div>
                      <div className="notarial-field">
                        <span className="field-label">Fecha de Certificación</span>
                        <span className="field-value">
                          {new Date(results.officialRecord.certifiedAt).toLocaleString("es-AR")}
                        </span>
                      </div>
                    </div>

                    <div className="notarial-hash-container">
                      <label htmlFor="seal-hash" className="hash-label">
                        Sello Criptográfico SHA-256 (Canonical JCS / RFC 8785):
                      </label>
                      <div className="hash-copy-row">
                        <code id="seal-hash" className="hash-code">
                          {results.officialRecord.recordHash}
                        </code>
                        <button
                          type="button"
                          className="copy-hash-button"
                          onClick={copyNotarialSeal}
                          aria-label="Copiar sello notarial al portapapeles"
                        >
                          <CopyIcon />
                          Copiar Sello
                        </button>
                      </div>
                      {copyFeedback && (
                        <p className="copy-feedback-toast" role="status" aria-live="polite">
                          {copyFeedback}
                        </p>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="notarial-unissued">
                    <p>
                      El acta oficial notarial aún se encuentra en proceso de protocolización por el Escribano o Escrutador habilitado.
                    </p>
                  </div>
                )}
              </div>
            </section>
          </>
        )}
      </div>

      <footer className="public-portal-footer">
        <p>
          Carnavales 2027 — Plataforma de Gestión, Votación y Escrutinio Oficial.
        </p>
      </footer>
    </PageShell>
  );
}
