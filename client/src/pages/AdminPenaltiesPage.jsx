import { useEffect, useRef, useState } from "react";
import { apiRequest } from "../api/http.js";
import { RevokePenaltyModal } from "../features/penalties/RevokePenaltyModal.jsx";

function getApiErrorMessage(error, defaultMsg = "Ocurrió un error inesperado.") {
  if (error?.code === "RESULTS_ALREADY_RELEASED") {
    return "Los resultados ya fueron liberados. No se pueden registrar ni revocar penalizaciones.";
  }
  if (error?.code === "RESULTS_ACCESS_DENIED" || error?.code === "PENALTIES_ACCESS_DENIED") {
    return "No tenés permisos para gestionar penalizaciones.";
  }
  if (error?.code === "TWO_FACTOR_REQUIRED") {
    return "Se requiere verificación en dos pasos (2FA).";
  }
  if (error?.code === "PENALTY_REQUIRES_COMPETITION_NIGHT") {
    return "Solo se pueden aplicar penalizaciones en jornadas competitivas.";
  }
  if (error?.code === "CANNOT_MUTATE_REVOKED_PENALTY") {
    return "La penalización ya fue revocada previamente.";
  }
  if (error?.code === "VALIDATION_ERROR") {
    return "Verificá los datos ingresados: motivo obligatorio y puntos enteros mayores a 0.";
  }
  return error?.message || defaultMsg;
}

export function AdminPenaltiesPage() {
  const [events, setEvents] = useState([]);
  const [eventId, setEventId] = useState("");
  const [nights, setNights] = useState([]);
  const [selectedNightId, setSelectedNightId] = useState("");
  const [troupes, setTroupes] = useState([]);
  const [selectedTroupeId, setSelectedTroupeId] = useState("");
  const [penaltyPoints, setPenaltyPoints] = useState("");
  const [reason, setReason] = useState("");
  const [penalties, setPenalties] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState("");
  const [revokingPenalty, setRevokingPenalty] = useState(null);
  const revokeTriggerRef = useRef(null);

  // Carga inicial de competencias
  useEffect(() => {
    let active = true;
    const fetchEvents = async () => {
      try {
        let items;
        try {
          items = await apiRequest("/api/v1/events");
        } catch (err) {
          if (err?.code === "ADMIN_REQUIRED" || err?.status === 403) {
            items = await apiRequest("/api/v1/results/events");
          } else {
            throw err;
          }
        }
        if (!active) return;
        setEvents(items);
        const defaultEvent = items.find((e) => e.name === "test_prueba") ?? items[0];
        setEventId(defaultEvent?.id ?? "");
      } catch (error) {
        if (!active) return;
        setEvents([]);
        setEventId("");
        setLoading(false);
        if (error?.code === "RESULTS_ACCESS_DENIED" || error?.code === "PENALTIES_ACCESS_DENIED") {
          setMessage("No tenés permisos para acceder a las competencias.");
        } else {
          setMessage("No se pudieron cargar las competencias. Verificá que la API esté disponible y tu sesión siga activa.");
        }
      }
    };
    void fetchEvents();
    return () => { active = false; };
  }, []);

  // Carga de noches, comparsas y penalizaciones cuando cambia el evento seleccionado
  useEffect(() => {
    if (!eventId) {
      setNights([]);
      setTroupes([]);
      setPenalties([]);
      setLoading(false);
      return;
    }

    let active = true;
    setLoading(true);
    setMessage("");

    const loadEventData = async () => {
      try {
        // Carga en paralelo
        const [nightsRes, troupesRes, penaltiesRes] = await Promise.allSettled([
          apiRequest(`/api/v1/events/${eventId}/nights`),
          apiRequest(`/api/v1/events/${eventId}/troupes`).catch(() =>
            apiRequest(`/api/v1/results/events/${eventId}/troupes`),
          ),
          apiRequest(`/api/v1/events/${eventId}/penalties`),
        ]);

        if (!active) return;

        if (nightsRes.status === "fulfilled") {
          const compNights = nightsRes.value.filter((n) => n.kind === "COMPETITION");
          setNights(compNights);
          setSelectedNightId(compNights[0]?.id ?? "");
        } else {
          setNights([]);
          setSelectedNightId("");
        }

        if (troupesRes.status === "fulfilled") {
          setTroupes(troupesRes.value);
          setSelectedTroupeId(troupesRes.value[0]?.id ?? "");
        } else {
          setTroupes([]);
          setSelectedTroupeId("");
        }

        if (penaltiesRes.status === "fulfilled") {
          setPenalties(penaltiesRes.value);
        } else {
          setPenalties([]);
          const err = penaltiesRes.reason;
          if (err?.code === "RESULTS_ACCESS_DENIED" || err?.code === "PENALTIES_ACCESS_DENIED") {
            setMessage("No tenés permisos para consultar las penalizaciones de este evento.");
          } else {
            setMessage(getApiErrorMessage(err, "No se pudieron cargar las penalizaciones del evento."));
          }
        }
      } catch (error) {
        if (!active) return;
        setMessage(getApiErrorMessage(error, "Error al cargar la información del evento."));
      } finally {
        if (active) setLoading(false);
      }
    };

    void loadEventData();
    return () => { active = false; };
  }, [eventId]);

  const refreshPenalties = async () => {
    if (!eventId) return;
    try {
      const items = await apiRequest(`/api/v1/events/${eventId}/penalties`);
      setPenalties(items);
    } catch (error) {
      setMessage(getApiErrorMessage(error, "No se pudo actualizar el listado de penalizaciones."));
    }
  };

  const handleSubmitPenalty = async (event) => {
    event.preventDefault();
    if (!eventId || !selectedNightId || !selectedTroupeId || submitting) return;

    const pointsNum = Number(penaltyPoints);
    if (!Number.isInteger(pointsNum) || pointsNum <= 0) {
      setMessage("Los puntos deben ser un número entero mayor a 0.");
      return;
    }

    const cleanReason = reason.trim();
    if (!cleanReason) {
      setMessage("El motivo o concepto reglamentario es obligatorio.");
      return;
    }

    setSubmitting(true);
    setMessage("");

    try {
      await apiRequest(`/api/v1/events/${eventId}/penalties`, {
        method: "POST",
        body: JSON.stringify({
          nightId: selectedNightId,
          eventTroupeId: selectedTroupeId,
          reason: cleanReason,
          penaltyPoints: pointsNum,
        }),
      });

      setReason("");
      setPenaltyPoints("");
      setMessage("Penalización registrada correctamente.");
      await refreshPenalties();
    } catch (error) {
      setMessage(getApiErrorMessage(error, "No se pudo registrar la penalización."));
    } finally {
      setSubmitting(false);
    }
  };

  const handleOpenRevoke = (penalty, triggerElement) => {
    revokeTriggerRef.current = triggerElement;
    setRevokingPenalty(penalty);
  };

  const handleRevokeSuccess = async () => {
    setMessage("Penalización revocada correctamente.");
    await refreshPenalties();
  };

  const selectedEvent = events.find((e) => e.id === eventId);

  return (
    <main className="admin-shell penalties-page">
      <header className="event-header">
        <div>
          <p className="eyebrow">Comisariato</p>
          <h1>Gestión de Penalizaciones</h1>
        </div>
        <label htmlFor="penalties-event-select">
          Competencia
          <select
            id="penalties-event-select"
            value={eventId}
            onChange={(e) => setEventId(e.target.value)}
          >
            {events.map((event) => (
              <option key={event.id} value={event.id}>
                {event.name}
              </option>
            ))}
          </select>
        </label>
      </header>

      <p className="feedback" role="status" aria-live="polite">
        {message}
      </p>

      {loading && <p>Cargando información de penalizaciones…</p>}

      {!loading && selectedEvent && (
        <>
          <section className="config-section" aria-labelledby="form-penalties-title">
            <h2 id="form-penalties-title">Registrar sanción reglamentaria</h2>
            <p className="section-description">
              Las penalizaciones descuentan puntos en la tabla general de Mejor Comparsa sin
              alterar las planillas de los jurados ni los premios por rubro individual.
            </p>

            <form onSubmit={handleSubmitPenalty} className="penalty-form">
              <div className="penalty-form-grid">
                <label htmlFor="penalty-night">
                  Noche competitiva
                  <select
                    id="penalty-night"
                    value={selectedNightId}
                    onChange={(e) => setSelectedNightId(e.target.value)}
                    required
                  >
                    {nights.length === 0 ? (
                      <option value="">No hay noches competitivas disponibles</option>
                    ) : (
                      nights.map((n) => (
                        <option key={n.id} value={n.id}>
                          {n.name}
                        </option>
                      ))
                    )}
                  </select>
                </label>

                <label htmlFor="penalty-troupe">
                  Comparsa sancionada
                  <select
                    id="penalty-troupe"
                    value={selectedTroupeId}
                    onChange={(e) => setSelectedTroupeId(e.target.value)}
                    required
                  >
                    {troupes.length === 0 ? (
                      <option value="">No hay comparsas disponibles</option>
                    ) : (
                      troupes.map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.name}
                        </option>
                      ))
                    )}
                  </select>
                </label>

                <label htmlFor="penalty-points">
                  Puntos a descontar (entero &gt; 0)
                  <input
                    id="penalty-points"
                    type="number"
                    min="1"
                    step="1"
                    value={penaltyPoints}
                    onChange={(e) => setPenaltyPoints(e.target.value)}
                    placeholder="Ej: 5"
                    required
                  />
                </label>
              </div>

              <label htmlFor="penalty-reason">
                Motivo / concepto reglamentario (obligatorio)
                <textarea
                  id="penalty-reason"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  rows={3}
                  placeholder="Detalle de la infracción según el Reglamento del Carnaval..."
                  required
                />
              </label>

              <button
                type="submit"
                disabled={submitting || !selectedNightId || !selectedTroupeId}
              >
                {submitting ? "Registrando sanción..." : "Registrar penalización"}
              </button>
            </form>
          </section>

          <section className="penalties-list-section" aria-labelledby="penalties-list-title">
            <div className="section-heading">
              <div>
                <h2 id="penalties-list-title">Sanciones del evento</h2>
                <p>Historial auditado de penalizaciones aplicadas y revocadas.</p>
              </div>
            </div>

            {penalties.length === 0 ? (
              <p className="empty-state">No hay sanciones registradas para este evento.</p>
            ) : (
              <div
                className="penalties-table"
                role="table"
                aria-label="Listado de sanciones reglamentarias"
              >
                <div className="penalties-header-row" role="row">
                  <span role="columnheader">Noche</span>
                  <span role="columnheader">Comparsa</span>
                  <span role="columnheader">Puntos</span>
                  <span role="columnheader">Motivo</span>
                  <span role="columnheader">Estado</span>
                  <span role="columnheader">Acciones</span>
                </div>

                {penalties.map((penalty) => {
                  const isRevoked = penalty.status === "REVOKED";
                  return (
                    <div
                      className={`penalties-row ${isRevoked ? "is-revoked" : ""}`}
                      role="row"
                      key={penalty.id}
                    >
                      <span role="cell" className="penalty-cell-night">
                        {penalty.nightName}
                      </span>
                      <strong role="cell" className="penalty-cell-troupe">
                        {penalty.troupeName}
                      </strong>
                      <span role="cell" className="penalty-cell-points">
                        −{penalty.penaltyPoints} pts
                      </span>
                      <span role="cell" className="penalty-cell-reason">
                        {penalty.reason}
                      </span>
                      <span role="cell" className="penalty-cell-status">
                        <span
                          className={`penalty-status-badge ${
                            isRevoked ? "badge-revoked" : "badge-applied"
                          }`}
                        >
                          {isRevoked ? "Revocada" : "Aplicada"}
                        </span>
                        {isRevoked && penalty.revocationReason && (
                          <small className="revocation-note">
                            Motivo revocación: {penalty.revocationReason}
                          </small>
                        )}
                      </span>
                      <span role="cell" className="penalty-cell-actions">
                        {!isRevoked ? (
                          <button
                            type="button"
                            className="secondary revoke-button"
                            onClick={(e) => handleOpenRevoke(penalty, e.currentTarget)}
                            aria-label={`Revocar sanción a ${penalty.troupeName}`}
                          >
                            Revocar
                          </button>
                        ) : (
                          <span className="text-muted">—</span>
                        )}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        </>
      )}

      {revokingPenalty && (
        <RevokePenaltyModal
          penalty={revokingPenalty}
          eventId={eventId}
          triggerRef={revokeTriggerRef}
          onClose={() => setRevokingPenalty(null)}
          onRevoked={handleRevokeSuccess}
        />
      )}
    </main>
  );
}
