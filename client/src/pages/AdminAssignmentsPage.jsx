import { useEffect, useRef, useState } from "react";
import { PageShell } from "../components/PageShell.jsx";
import { PageHeader } from "../components/PageHeader.jsx";
import { Dialog } from "../components/Dialog.jsx";
import { DialogFooter } from "../components/DialogFooter.jsx";
import { StatusPill } from "../components/StatusPill.jsx";
import { apiRequest } from "../api/http.js";
import { JudgeAssignmentDialog } from "../features/JudgeAssignmentDialog.jsx";
import { useAdminEvent } from "../context/AdminEventContext.jsx";

const typeLabels = { PRIMARY: "Titular", SUBSTITUTE: "Suplente" };

/**
 * AdminAssignmentsPage — Board Noche → Especialidad → Puestos (Spec 027/E).
 * Cupo y asignación se operan desde cada grupo; las excepcionales
 * (revocar/reemplazar/activar) viven en [Acciones ▾] + dialog con motivo.
 * Contratos API y reglas intactos.
 */
export function AdminAssignmentsPage() {
  const adminEvent = useAdminEvent();
  const [localEvents, setLocalEvents] = useState([]);
  const [judges, setJudges] = useState([]);
  const [nights, setNights] = useState([]);
  const [specialties, setSpecialties] = useState([]);
  const [data, setData] = useState({ quotas: [], assignments: [] });
  const [localEventId, setLocalEventId] = useState("");
  const [nightId, setNightId] = useState("");
  const [quotaTarget, setQuotaTarget] = useState(null);
  const [assignTarget, setAssignTarget] = useState(null);
  const [actionTarget, setActionTarget] = useState(null);
  const [openActionsId, setOpenActionsId] = useState(null);
  const [busy, setBusy] = useState("");
  const [message, setMessage] = useState("");
  const dialogTriggerRef = useRef(null);
  const events = adminEvent?.events ?? localEvents;
  const eventId = adminEvent?.activeEventId ?? localEventId;
  const selectedEvent = adminEvent?.activeEvent ?? events.find((event) => event.id === eventId);
  const canConfigure = selectedEvent?.status === "CONFIGURING";
  const availableNights = nights.filter((night) => night.status !== "CLOSED");
  const previousEventId = useRef(eventId);

  const refresh = async (selectedEventId = eventId) => {
    if (!selectedEventId) return;
    try {
      const [eventData, eventNights, eventSpecialties] = await Promise.all([
        apiRequest(`/api/v1/events/${selectedEventId}/judge-assignments`),
        apiRequest(`/api/v1/events/${selectedEventId}/nights`),
        apiRequest(`/api/v1/events/${selectedEventId}/specialties`),
      ]);
      setData(eventData);
      const competition = eventNights.filter((night) => night.kind === "COMPETITION");
      setNights(competition);
      setNightId((current) => current || competition.filter((night) => night.status !== "CLOSED")[0]?.id || "");
      setSpecialties(eventSpecialties.filter((specialty) => specialty.active));
    } catch {
      setData({ quotas: [], assignments: [] });
      setMessage("No se pudieron cargar las asignaciones del evento.");
    }
  };

  useEffect(() => {
    const eventsRequest = adminEvent ? Promise.resolve(adminEvent.events) : apiRequest("/api/v1/events");
    void Promise.all([eventsRequest, apiRequest("/api/v1/judges")])
      .then(([eventList, judgeList]) => {
        if (!adminEvent) setLocalEvents(eventList);
        setJudges(judgeList.filter((judge) => judge.registrationStatus === "REGISTERED"));
        if (!adminEvent && eventList[0]) setLocalEventId(eventList[0].id);
      })
      .catch(() => setMessage("No se pudieron cargar eventos y jurados."));
  }, [Boolean(adminEvent)]);

  useEffect(() => { void refresh(); }, [eventId]);

  useEffect(() => {
    if (previousEventId.current !== eventId) setNightId("");
    previousEventId.current = eventId;
  }, [eventId]);

  const action = async (key, operation, success) => {
    if (busy) return;
    setBusy(key);
    setMessage("");
    try {
      await operation();
      setMessage(success);
      await refresh();
    } catch (error) {
      const messages = {
        JUDGE_QUOTA_FULL: "El cupo de esa combinación está completo.",
        JUDGE_ALREADY_ASSIGNED: "El jurado ya tiene una asignación activa en esa noche.",
        EVENT_LOCKED: "El evento ya no permite modificar esa configuración.",
        NIGHT_CLOSED: "La noche ya está cerrada.",
        JUDGE_NOT_ASSIGNABLE: "El jurado no está registrado o está suspendido.",
        PRIMARY_BALLOT_SUBMITTED: "El titular ya presentó su planilla y no puede ser reemplazado.",
        STANDBY_NOT_FOUND: "Esta asignación no tiene un suplente activo vinculado.",
      };
      setMessage(messages[error.code] ?? "No se pudo completar la operación.");
    } finally {
      setBusy("");
    }
  };

  const quotaFor = (targetNightId, targetSpecialtyId) =>
    data.quotas.find((quota) => quota.nightId === targetNightId && quota.specialtyId === targetSpecialtyId);

  const sameNight = (assignment, night) =>
    assignment.nightId ? assignment.nightId === night.id : assignment.nightName === night.name;
  const sameSpecialty = (assignment, specialty) =>
    assignment.specialtyId ? assignment.specialtyId === specialty.id : assignment.specialtyName === specialty.name;

  const activeFor = (night, specialty) =>
    data.assignments.filter(
      (assignment) => assignment.status === "ACTIVE" && sameNight(assignment, night) && sameSpecialty(assignment, specialty),
    );

  const inactiveForNight = data.assignments.filter(
    (assignment) => assignment.status !== "ACTIVE" && (nightId === "" || (selectedNight ? sameNight(assignment, selectedNight) : assignment.nightId === nightId)),
  );

  const openDialog = (setter, value) => (event) => {
    dialogTriggerRef.current = event.currentTarget;
    setter(value);
  };

  const closeDialogs = () => {
    setQuotaTarget(null);
    setAssignTarget(null);
    setActionTarget(null);
    setOpenActionsId(null);
  };

  const submitQuota = async (formEvent) => {
    formEvent.preventDefault();
    const values = new FormData(formEvent.currentTarget);
    const target = quotaTarget;
    closeDialogs();
    await action("quota", () => apiRequest(
      `/api/v1/events/${eventId}/nights/${target.nightId}/specialties/${target.specialtyId}/judge-quota`,
      { method: "PUT", body: JSON.stringify({ maxAssignments: Number(values.get("maxAssignments")) }) },
    ), "Cupo actualizado.");
  };

  const submitAssignment = async ({ judgeProfileId, assignmentType, standbyForAssignmentId }) => {
    const target = assignTarget;
    closeDialogs();
    await action("assignment", () => apiRequest(`/api/v1/events/${eventId}/judge-assignments`, {
      method: "POST",
      body: JSON.stringify({
        nightId: target.nightId, specialtyId: target.specialtyId,
        judgeProfileId, assignmentType,
        standbyForAssignmentId,
      }),
    }), "Asignación creada.");
  };

  const submitAction = async (formEvent) => {
    formEvent.preventDefault();
    const values = new FormData(formEvent.currentTarget);
    const { assignment, action: actionName } = actionTarget;
    const reason = values.get("reason");
    closeDialogs();
    if (actionName === "revoke") {
      await action(`revoke-${assignment.id}`, () => apiRequest(`/api/v1/judge-assignments/${assignment.id}/revoke`, {
        method: "POST", body: JSON.stringify({ reason }),
      }), "Asignación revocada.");
    } else if (actionName === "replace") {
      await action(`replace-${assignment.id}`, () => apiRequest(`/api/v1/judge-assignments/${assignment.id}/replace`, {
        method: "POST",
        body: JSON.stringify({ replacementJudgeProfileId: values.get("replacementJudgeProfileId"), assignmentType: "PRIMARY", reason }),
      }), "Asignación reemplazada.");
    } else if (actionName === "activate") {
      await action(`activate-${assignment.id}`, () => apiRequest(`/api/v1/judge-assignments/${assignment.id}/activate-substitute`, {
        method: "POST", body: JSON.stringify({ reason }),
      }), "Suplente activado; su planilla ya está disponible.");
    }
  };

  const selectedNight = nights.find((night) => night.id === nightId);
  const assignNight = assignTarget ? nights.find((night) => night.id === assignTarget.nightId) : null;
  const assignSpecialty = assignTarget ? specialties.find((specialty) => specialty.id === assignTarget.specialtyId) : null;
  const quotaNight = quotaTarget ? nights.find((night) => night.id === quotaTarget.nightId) : null;
  const quotaSpecialty = quotaTarget ? specialties.find((specialty) => specialty.id === quotaTarget.specialtyId) : null;
  const quotaValue = quotaTarget ? quotaFor(quotaTarget.nightId, quotaTarget.specialtyId) : null;
  const primaryOptions = data.assignments.filter((assignment) => assignment.status === "ACTIVE" && assignment.assignmentType === "PRIMARY");

  return (
    <PageShell layer="instrument" className="admin-shell assignment-page">
      <PageHeader
        eyebrow="Operación de jurados"
        title="Asignaciones"
          actions={!adminEvent ? <label className="event-picker">Evento<select value={eventId} onChange={(event) => { setLocalEventId(event.target.value); setNightId(""); }}>
            <option value="">Seleccionar evento</option>
            {events.map((event) => <option key={event.id} value={event.id}>{event.name}</option>)}
          </select></label> : null}
      />
      <p className="feedback" role="status" aria-live="polite">{message}</p>
      {eventId && <>
        <div className="night-tabs" role="group" aria-label="Jornada">
          {availableNights.map((night) => (
            <button
              key={night.id}
              type="button"
              className={night.id === nightId ? "active" : "secondary"}
              aria-pressed={night.id === nightId}
              onClick={() => setNightId(night.id)}
            >
              {night.name}
            </button>
          ))}
        </div>
        {selectedNight && specialties.map((specialty) => {
          const quota = quotaFor(selectedNight.id, specialty.id);
          const slots = activeFor(selectedNight, specialty);
          const filled = quota ? `${quota.activeAssignments}/${quota.maxAssignments} puestos cubiertos` : `${slots.length} puesto(s) cubierto(s)`;
          return (
            <section className="config-section" key={specialty.id} aria-label={`${selectedNight.name} · ${specialty.name}`}>
              <div className="section-heading">
                <div>
                  <h2>{specialty.name}</h2>
                  <p>{filled}{quota ? ` · Cupo máximo: ${quota.maxAssignments}` : " · Sin cupo configurado"}</p>
                </div>
                <div className="event-actions">
                  {!quota && <button type="button" disabled={Boolean(busy) || !canConfigure} onClick={openDialog(setQuotaTarget, { nightId: selectedNight.id, specialtyId: specialty.id })}>Configurar cupo</button>}
                  {quota && <button className="secondary" type="button" disabled={Boolean(busy) || !canConfigure} onClick={openDialog(setQuotaTarget, { nightId: selectedNight.id, specialtyId: specialty.id })}>Editar cupo</button>}
                  <button type="button" disabled={Boolean(busy) || !canConfigure} onClick={openDialog(setAssignTarget, { nightId: selectedNight.id, specialtyId: specialty.id })}>+ Asignar jurado</button>
                </div>
              </div>
              {slots.length === 0 ? (
                <p className="empty-state">⚠ Falta cubrir el puesto de {specialty.name} en {selectedNight.name}.</p>
              ) : (
                <ul className="assignment-slot-list">
                  {slots.map((assignment) => {
                    const standby = data.assignments.find((candidate) => candidate.status === "ACTIVE" && candidate.standbyForAssignmentId === assignment.id);
                    return (
                      <li key={assignment.id} className={`assignment-slot assignment-${assignment.status.toLowerCase()}`}>
                        <div className="judge-card-heading">
                          <div>
                            <p className="eyebrow">{typeLabels[assignment.assignmentType]}</p>
                            <h3>{assignment.judgeName}</h3>
                          </div>
                          <StatusPill status="ACTIVE" label="Activa" />
                        </div>
                        {assignment.assignmentType === "SUBSTITUTE" && assignment.status === "ACTIVE" && <p>En espera del titular asignado.</p>}
                        {standby && <p>Suplente reservado: <strong>{standby.judgeName}</strong>.</p>}
                        <div className="actions-menu">
                          <button
                            type="button"
                            className="secondary"
                            aria-expanded={openActionsId === assignment.id}
                            aria-label={`Acciones para ${assignment.judgeName}`}
                            onClick={() => setOpenActionsId(openActionsId === assignment.id ? null : assignment.id)}
                          >
                            Acciones ▾
                          </button>
                          {openActionsId === assignment.id && (
                            <div className="actions-menu-items">
                              {standby && <button type="button" disabled={Boolean(busy) || assignment.nightStatus === "CLOSED"} onClick={openDialog(setActionTarget, { assignment, action: "activate" })}>Activar suplente</button>}
                              <button type="button" disabled={Boolean(busy) || assignment.nightStatus === "CLOSED"} onClick={openDialog(setActionTarget, { assignment, action: "replace" })}>Reemplazar jurado</button>
                              <button type="button" className="danger-action" disabled={Boolean(busy) || assignment.nightStatus === "CLOSED"} onClick={openDialog(setActionTarget, { assignment, action: "revoke" })}>Revocar asignación</button>
                            </div>
                          )}
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>
          );
        })}
        {inactiveForNight.length > 0 && (
          <details className="config-section">
            <summary>Historial de la noche ({inactiveForNight.length})</summary>
            <ul className="assignment-slot-list">
              {inactiveForNight.map((assignment) => (
                <li key={assignment.id} className="assignment-slot">
                  <div className="judge-card-heading">
                    <div>
                      <p className="eyebrow">{assignment.nightName} · {assignment.specialtyName} · {typeLabels[assignment.assignmentType]}</p>
                      <h3>{assignment.judgeName}</h3>
                      {assignment.replacedAssignmentId && <p>Reemplaza una asignación anterior.</p>}
                    </div>
                    <StatusPill status={assignment.status} label={assignment.status === "REPLACED" ? "Reemplazada" : "Revocada"} />
                  </div>
                </li>
              ))}
            </ul>
          </details>
        )}
      </>}

      <Dialog
        isOpen={quotaTarget !== null}
        onClose={closeDialogs}
        title={`Configurar cupo — ${quotaNight?.name ?? ""} · ${quotaSpecialty?.name ?? ""}`}
        description="Se cuenta cada titular o suplente. Los cupos se congelan al abrir el evento."
        focusReturnRef={dialogTriggerRef}
      >
        <form onSubmit={submitQuota}>
          {quotaValue && <p>{quotaValue.activeAssignments}/{quotaValue.maxAssignments} puestos cubiertos.</p>}
          <label htmlFor="quota-max">Cupo máximo</label>
          <input id="quota-max" name="maxAssignments" type="number" min="1" defaultValue={quotaValue?.maxAssignments ?? ""} required />
          <DialogFooter>
            <button type="button" className="secondary" onClick={closeDialogs}>Cancelar</button>
            <button type="submit" disabled={Boolean(busy)}>Guardar cupo</button>
          </DialogFooter>
        </form>
      </Dialog>

      <JudgeAssignmentDialog
        isOpen={assignTarget !== null}
        onClose={closeDialogs}
        onSubmit={submitAssignment}
        nightName={assignNight?.name ?? ""}
        specialtyName={assignSpecialty?.name ?? ""}
        judges={judges}
        primaryOptions={primaryOptions}
        submitting={Boolean(busy)}
        focusReturnRef={dialogTriggerRef}
      />

      <Dialog
        isOpen={actionTarget !== null}
        onClose={closeDialogs}
        title={
          actionTarget?.action === "revoke" ? "Revocar asignación"
          : actionTarget?.action === "replace" ? "Reemplazar jurado"
          : "Activar suplente"
        }
        description={actionTarget ? `${actionTarget.assignment.judgeName} · ${actionTarget.assignment.nightName} · ${actionTarget.assignment.specialtyName}` : ""}
        focusReturnRef={dialogTriggerRef}
      >
        <form onSubmit={submitAction}>
          {actionTarget?.action === "replace" && (
            <>
              <label htmlFor="action-replacement">Nuevo jurado</label>
              <select id="action-replacement" name="replacementJudgeProfileId" required defaultValue="">
                <option value="">Elegir jurado</option>
                {judges.filter((judge) => judge.id !== actionTarget.assignment.judgeProfileId).map((judge) => (
                  <option key={judge.id} value={judge.id}>{judge.name}</option>
                ))}
              </select>
            </>
          )}
          <label htmlFor="action-reason">
            {actionTarget?.action === "revoke" ? "Motivo de revocación" : actionTarget?.action === "replace" ? "Motivo" : "Motivo de activación"}
          </label>
          <input id="action-reason" name="reason" required />
          <p>⚠ Esta acción quedará registrada.</p>
          <DialogFooter>
            <button type="button" className="secondary" onClick={closeDialogs}>Cancelar</button>
            <button
              type="submit"
              className={actionTarget?.action === "revoke" ? "danger-action" : undefined}
              disabled={Boolean(busy)}
            >
              {actionTarget?.action === "revoke" ? "Revocar asignación" : actionTarget?.action === "replace" ? "Confirmar reemplazo" : "Activar suplente"}
            </button>
          </DialogFooter>
        </form>
      </Dialog>
    </PageShell>
  );
}
