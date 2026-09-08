import { useEffect, useRef, useState } from "react";
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
  const [pendingCloseDialog, setPendingCloseDialog] = useState(null);
  const closeDialogRef = useRef(null);
  const closeButtonRef = useRef(null);

  useEffect(() => {
    const dialog = closeDialogRef.current;
    if (!dialog) return;
    if (pendingCloseDialog?.length > 0 && !dialog.open) {
      dialog.showModal();
      dialog.querySelector("[data-close-pending-dialog-close]")?.focus();
    } else if (!pendingCloseDialog && dialog.open) {
      dialog.close();
    }
  }, [pendingCloseDialog]);

  const closePendingDialog = () => {
    const dialog = closeDialogRef.current;
    if (dialog?.open) dialog.close();
    else {
      setPendingCloseDialog(null);
      closeButtonRef.current?.focus();
    }
  };

  const handlePendingDialogClose = () => {
    setPendingCloseDialog(null);
    closeButtonRef.current?.focus();
  };

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
      if (error.code === "VOTING_CLOSE_INCOMPLETE_BALLOTS") {
        setPendingCloseDialog((error.details ?? []).map((item) => ({
          id: item.id,
          judgeName: item.judgeName ?? "Jurado",
          troupeName: item.troupeName ?? "Comparsa",
          rubricName: item.rubricName ?? "Rubro",
          itemName: item.name ?? item.code ?? "Ítem pendiente",
        })));
        return;
      }
      const messages = {
        EVENT_NOT_OPEN: "El evento debe estar abierto para habilitar la votación.",
        NIGHT_NOT_OPEN: "La noche no está disponible para votar.",
      };
      setMessage(messages[error.code] ?? "No se pudo completar la operación.");
    } finally {
      setBusy("");
    }
  };

  return <main className="admin-shell voting-page" data-layer="instrument">
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
        <div className="event-actions"><button type="button" disabled={Boolean(busy)} onClick={() => void action("open", () => apiRequest(`/api/v1/events/${eventId}/nights/${nightId}/voting/open`, { method: "POST" }), (result) => `${result.ballotsCreated} planilla(s) habilitada(s).`)}>Abrir votación</button><button ref={closeButtonRef} className="danger-action" type="button" disabled={Boolean(busy)} onClick={() => void action("close", () => apiRequest(`/api/v1/events/${eventId}/nights/${nightId}/voting/close`, { method: "POST" }), (result) => `${result.autoSubmitted} planilla(s) confirmada(s) al cerrar.`)}>Cerrar votación</button></div>
      </section>
      {status?.troupes && status.troupes.length > 0 && (
        <section className="config-section runway-control-section" aria-label="Control de pista y orden de pasada">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Desfile en vivo</p>
              <h2>Control de pista y orden de pasada</h2>
              <p>Monitoreo secuencial del desfile y avance de votación de jurados según orden oficial de salida.</p>
            </div>
            <div className="event-actions">
              <button
                type="button"
                className="refresh-runway-btn"
                disabled={Boolean(busy)}
                onClick={() => void refreshNight()}
                aria-label="Actualizar estado de pista"
              >
                Actualizar pista
              </button>
            </div>
          </div>

          {status.activeTroupe ? (
            <div className="runway-active-card">
              <div className="runway-active-header">
                <div>
                  <span className="runway-order-badge">Salida #{status.activeTroupe.presentationOrder}</span>
                  <h3 className="runway-active-name" style={{ color: status.activeTroupe.brandColor || "inherit" }}>
                    {status.activeTroupe.troupeName}
                  </h3>
                </div>
                <span className="status-pill status-pill-active">EN PISTA</span>
              </div>
              <div className="runway-progress-wrapper">
                <div className="runway-progress-labels">
                  <span>Votos de jurados registrados</span>
                  <strong>{status.activeTroupe.resolvedScores} / {status.activeTroupe.totalScores}</strong>
                </div>
                <progress
                  className="runway-progress-bar"
                  max={status.activeTroupe.totalScores || 1}
                  value={status.activeTroupe.resolvedScores}
                  aria-label={`Progreso de votos para ${status.activeTroupe.troupeName}`}
                />
              </div>
            </div>
          ) : (
            <div className="runway-all-completed-card">
              <span className="status-pill status-pill-submitted">DESFILE FINALIZADO</span>
              <p>Todas las comparsas de la noche han completado su pasada y cuentan con votos resueltos.</p>
            </div>
          )}

          <div className="runway-troupes-grid" aria-label="Cronograma de pasadas">
            {status.troupes.map((troupe) => {
              const pct = troupe.totalScores > 0 ? Math.round((troupe.resolvedScores / troupe.totalScores) * 100) : 0;
              const isCurrent = status.activeTroupe?.scheduleId === troupe.scheduleId;
              const isDone = troupe.status === "COMPLETED";

              return (
                <article
                  key={troupe.scheduleId}
                  className={`runway-troupe-card ${isCurrent ? "is-current" : ""} ${isDone ? "is-completed" : "is-waiting"}`}
                >
                  <div className="runway-troupe-header">
                    <span className="troupe-order">#{troupe.presentationOrder}</span>
                    <strong className="troupe-name" style={{ color: troupe.brandColor || "inherit" }}>
                      {troupe.troupeName}
                    </strong>
                    <span
                      className={`status-pill ${
                        isDone
                          ? "status-pill-submitted"
                          : isCurrent
                            ? "status-pill-active"
                            : "status-pill-pending"
                      }`}
                    >
                      {isDone ? "COMPLETADA" : isCurrent ? "EN PISTA" : "EN ESPERA"}
                    </span>
                  </div>
                  <div className="runway-troupe-progress">
                    <div className="runway-troupe-meta">
                      <span>Progreso</span>
                      <span>{troupe.resolvedScores}/{troupe.totalScores} ({pct}%)</span>
                    </div>
                    <div className="troupe-mini-bar" role="progressbar" aria-valuenow={pct} aria-valuemin="0" aria-valuemax="100">
                      <div className="troupe-mini-fill" style={{ inlineSize: `${pct}%` }} />
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        </section>
      )}
      <section className="assignment-grid" aria-label="Planillas de la noche">
        {ballots.length === 0 && <p className="empty-state">Todavía no hay planillas para esta noche.</p>}
        {ballots.map((ballot) => <article className="assignment-card" key={ballot.id}>
          <div className="judge-card-heading"><div><p className="eyebrow">{ballot.specialtyName}</p><h2>{ballot.judgeName}</h2><p>{ballot.status === "SUBMITTED" ? "Confirmada" : ballot.status === "REOPENED" ? "Reabierta" : "En carga"}</p></div><span className="status-pill">{ballot.status}</span></div>
        </article>)}
      </section>
    </>}
    <dialog ref={closeDialogRef} className="pending-dialog" aria-modal="true" aria-labelledby="close-pending-dialog-title" aria-describedby="close-pending-dialog-description" onCancel={(event) => { event.preventDefault(); closePendingDialog(); }} onClose={handlePendingDialogClose}>
      {pendingCloseDialog && <div className="pending-dialog-content">
        <p className="eyebrow">Cierre bloqueado</p>
        <h2 id="close-pending-dialog-title">Faltan votos por resolver</h2>
        <p id="close-pending-dialog-description">No se puede cerrar la votación hasta que los jurados resuelvan estos ítems.</p>
        <ul className="pending-dialog-list" aria-label="Votos pendientes">
          {pendingCloseDialog.map((item) => <li key={item.id}><span>{item.judgeName} · {item.troupeName}</span><span>{item.rubricName}</span><strong>{item.itemName}</strong></li>)}
        </ul>
        <div className="pending-dialog-actions"><button data-close-pending-dialog-close type="button" onClick={closePendingDialog}>Volver al control</button></div>
      </div>}
    </dialog>
  </main>;
}
