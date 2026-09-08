import { useCallback, useEffect, useRef, useState } from "react";
import { apiRequest } from "../api/http.js";

const POLLING_MS = 15_000;
const RECONNECT_INTERVAL_MS = 20_000;

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

  // Spec 022: Estado de conexión en tiempo real (RF-191, RF-193)
  const [connectionMode, setConnectionMode] = useState("connecting"); // "live" | "polling" | "connecting"

  // Spec 022: Alertas de anomalías operativas (RF-194)
  const [anomalies, setAnomalies] = useState([]);

  // Spec 022: Modo "Pared de Sala" / Wallboard para proyectores (RF-195)
  const [isWallboard, setIsWallboard] = useState(false);

  const eventSourceRef = useRef(null);
  const mountedRef = useRef(true);

  const refresh = useCallback(async () => {
    if (document.visibilityState === "hidden") return;
    try {
      const nextEvents = await apiRequest("/api/v1/monitor/events");
      if (!mountedRef.current) return;
      setEvents(nextEvents);
      setMessage("");
      setLastUpdated(new Date());
      setEventId((current) =>
        nextEvents.some((event) => event.id === current) ? current : nextEvents[0]?.id ?? "",
      );
    } catch {
      if (!mountedRef.current) return;
      setMessage("No se pudo cargar la supervisión. Intentá actualizar nuevamente.");
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }, []);

  // Carga inicial y escucha de visibilidad
  useEffect(() => {
    mountedRef.current = true;
    void refresh();

    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") void refresh();
    };
    document.addEventListener("visibilitychange", onVisibilityChange);

    return () => {
      mountedRef.current = false;
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [refresh]);

  // Gestión de conexión SSE con fallback automático a polling (RF-191, RF-193)
  useEffect(() => {
    let fallbackInterval = null;
    let reconnectTimer = null;

    const connectSSE = () => {
      if (typeof window.EventSource !== "function") {
        setConnectionMode("polling");
        return;
      }

      try {
        const es = new window.EventSource("/api/v1/monitor/stream");
        eventSourceRef.current = es;

        es.addEventListener("connected", () => {
          if (!mountedRef.current) return;
          setConnectionMode("live");
        });

        es.addEventListener("monitor_update", (e) => {
          if (!mountedRef.current) return;
          try {
            const data = JSON.parse(e.data);
            if (data.type === "CLOSE_ATTEMPT_INCOMPLETE") {
              const pendingText = data.pendingCount ? `${data.pendingCount} planilla(s)` : "planillas";
              setAnomalies((prev) => [
                {
                  id: String(Date.now()),
                  message: `Intento de cierre de votación bloqueado: aún hay ${pendingText} pendientes.`,
                  timestamp: data.timestamp || new Date().toISOString(),
                },
                ...prev,
              ]);
            }
          } catch {
            // Evento no JSON o malformado
          }
          void refresh();
        });

        es.onerror = () => {
          if (!mountedRef.current) return;
          setConnectionMode("polling");
          es.close();
          eventSourceRef.current = null;

          // Intentar reconectar SSE tras un intervalo
          reconnectTimer = window.setTimeout(() => {
            if (mountedRef.current) connectSSE();
          }, RECONNECT_INTERVAL_MS);
        };
      } catch {
        if (mountedRef.current) setConnectionMode("polling");
      }
    };

    connectSSE();

    // Polling de respaldo (RF-193)
    // Siempre activo a POLLING_MS cuando no esté en modo "live", o como guardián
    fallbackInterval = window.setInterval(() => {
      void refresh();
    }, POLLING_MS);

    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
      if (fallbackInterval) window.clearInterval(fallbackInterval);
      if (reconnectTimer) window.clearTimeout(reconnectTimer);
    };
  }, [refresh]);

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

  const dismissAnomaly = (id) => {
    setAnomalies((prev) => prev.filter((a) => a.id !== id));
  };

  return (
    <main className={`container monitor-page ${isWallboard ? "is-wallboard" : ""}`} data-layer="instrument">
      <header className="monitor-header">
        <div>
          <p className="eyebrow">Supervisión operativa</p>
          <h1>Estado de la votación</h1>
          <p>Conteos agregados por noche, sin puntajes ni datos de jurados.</p>
        </div>
        <div className="monitor-header-actions">
          {/* Insignia reactiva de enlace (RF-193) */}
          <div
            className={`connection-status ${
              connectionMode === "live" ? "is-live" : "is-polling"
            }`}
            role="status"
            aria-live="polite"
          >
            <span className="status-dot" aria-hidden="true" />
            <span>
              {connectionMode === "live" ? "● En vivo" : "○ Polling de respaldo"}
            </span>
          </div>

          {/* Botón de alternancia de Modo Pared de Sala (RF-195) */}
          <button
            type="button"
            className={`btn ${isWallboard ? "btn-secondary" : "btn-primary"} wallboard-toggle-btn`}
            onClick={() => setIsWallboard((prev) => !prev)}
            aria-pressed={isWallboard}
          >
            {isWallboard ? "Salir de Pared de Sala" : "Modo Pared de Sala"}
          </button>

          {lastUpdated && (
            <p className="monitor-updated">
              Actualizado{" "}
              {lastUpdated.toLocaleTimeString([], {
                hour: "2-digit",
                minute: "2-digit",
                second: "2-digit",
              })}
            </p>
          )}
        </div>
      </header>

      {/* Banner de anomalías operativas (RF-194) */}
      {anomalies.length > 0 && (
        <section className="anomaly-alert-container" aria-label="Alertas operativas">
          {anomalies.map((anomaly) => (
            <aside
              key={anomaly.id}
              className="anomaly-alert-banner"
              role="alert"
              aria-live="assertive"
            >
              <div className="anomaly-alert-content">
                <span className="anomaly-alert-icon" aria-hidden="true">
                  ⚠️
                </span>
                <div>
                  <strong>Alerta operativa</strong>
                  <p>{anomaly.message}</p>
                </div>
              </div>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => dismissAnomaly(anomaly.id)}
                aria-label="Descartar alerta"
              >
                Descartar
              </button>
            </aside>
          ))}
        </section>
      )}

      {message && (
        <p className="feedback" role="alert">
          {message}
        </p>
      )}
      {loading && <p role="status">Cargando supervisión…</p>}
      {!loading && events.length === 0 && !message && (
        <section className="empty-state">
          <h2>Sin actividad de votación</h2>
          <p>
            Todavía no hay noches competitivas con planillas o una ventana de
            votación registrada.
          </p>
        </section>
      )}

      {events.length > 0 && (
        <>
          <section
            className="monitor-selectors"
            aria-label="Seleccionar actividad"
          >
            <label>
              Evento
              <select
                value={eventId}
                onChange={(event) => {
                  setEventId(event.target.value);
                  setNightId("");
                }}
              >
                {events.map((event) => (
                  <option key={event.id} value={event.id}>
                    {event.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Noche competitiva
              <select
                value={selectedNight?.id ?? ""}
                onChange={(event) => setNightId(event.target.value)}
              >
                {nights.map((night) => (
                  <option key={night.id} value={night.id}>
                    {night.name}
                  </option>
                ))}
              </select>
            </label>
          </section>

          {selectedNight ? (
            <>
              <section className="monitor-night-heading">
                <div>
                  <p className="eyebrow">{selectedEvent.name}</p>
                  <h2>{selectedNight.name}</h2>
                </div>
                <span
                  className={`monitor-status monitor-status-${selectedNight.votingStatus.toLowerCase()}`}
                >
                  {votingStatusLabel(selectedNight.votingStatus)}
                </span>
              </section>

              <section
                className="monitor-counts"
                aria-label="Conteos de planillas"
                aria-live="polite"
              >
                {countCards.map(([key, label]) => (
                  <div className="monitor-count-card" key={key}>
                    <span>{label}</span>
                    <strong>{selectedNight.counts?.[key] ?? 0}</strong>
                  </div>
                ))}
                <div className="monitor-count-card monitor-count-total">
                  <span>Total votante</span>
                  <strong>{total}</strong>
                </div>
              </section>

              <section
                className="monitor-progress"
                aria-label="Progreso de confirmación"
              >
                <div>
                  <div>
                    <span>Confirmación de planillas</span>
                    <strong>{progress}%</strong>
                  </div>
                  <div className="progress-track">
                    <span style={{ inlineSize: `${progress}%` }} />
                  </div>
                  <p>
                    {submitted} de {total} planillas confirmadas
                  </p>
                </div>
              </section>
            </>
          ) : (
            <section className="empty-state">
              <h2>Sin noches activas</h2>
              <p>Este evento todavía no tiene actividad de votación para supervisar.</p>
            </section>
          )}
        </>
      )}
    </main>
  );
}
