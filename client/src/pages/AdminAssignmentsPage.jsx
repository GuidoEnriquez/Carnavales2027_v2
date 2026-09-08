import { useEffect, useState } from "react";
import { PageShell } from "../components/PageShell.jsx";
import { apiRequest } from "../api/http.js";

const typeLabels = { PRIMARY: "Titular", SUBSTITUTE: "Suplente" };

export function AdminAssignmentsPage() {
  const [events, setEvents] = useState([]);
  const [judges, setJudges] = useState([]);
  const [nights, setNights] = useState([]);
  const [specialties, setSpecialties] = useState([]);
  const [data, setData] = useState({ quotas: [], assignments: [] });
  const [eventId, setEventId] = useState("");
  const [assignmentType, setAssignmentType] = useState("PRIMARY");
  const [busy, setBusy] = useState("");
  const [message, setMessage] = useState("");
  const selectedEvent = events.find((event) => event.id === eventId);
  const canConfigure = selectedEvent?.status === "CONFIGURING";
  const availableNights = nights.filter((night) => night.status !== "CLOSED");

  const refresh = async (selectedEventId = eventId) => {
    if (!selectedEventId) return;
    try {
      const [eventData, eventNights, eventSpecialties] = await Promise.all([
        apiRequest(`/api/v1/events/${selectedEventId}/judge-assignments`),
        apiRequest(`/api/v1/events/${selectedEventId}/nights`),
        apiRequest(`/api/v1/events/${selectedEventId}/specialties`),
      ]);
      setData(eventData);
      setNights(eventNights.filter((night) => night.kind === "COMPETITION"));
      setSpecialties(eventSpecialties.filter((specialty) => specialty.active));
    } catch {
      setData({ quotas: [], assignments: [] });
      setMessage("No se pudieron cargar las asignaciones del evento.");
    }
  };

  useEffect(() => {
    void Promise.all([apiRequest("/api/v1/events"), apiRequest("/api/v1/judges")])
      .then(([eventList, judgeList]) => {
        setEvents(eventList);
        setJudges(judgeList.filter((judge) => judge.registrationStatus === "REGISTERED"));
        if (eventList[0]) setEventId(eventList[0].id);
      })
      .catch(() => setMessage("No se pudieron cargar eventos y jurados."));
  }, []);

  useEffect(() => { void refresh(); }, [eventId]);

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

  const updateQuota = async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const values = new FormData(form);
    await action("quota", () => apiRequest(
      `/api/v1/events/${eventId}/nights/${values.get("nightId")}/specialties/${values.get("specialtyId")}/judge-quota`,
      { method: "PUT", body: JSON.stringify({ maxAssignments: Number(values.get("maxAssignments")) }) },
    ), "Cupo actualizado.");
  };

  const createAssignment = async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const values = new FormData(form);
    await action("assignment", () => apiRequest(`/api/v1/events/${eventId}/judge-assignments`, {
      method: "POST",
      body: JSON.stringify({
        nightId: values.get("nightId"), specialtyId: values.get("specialtyId"),
        judgeProfileId: values.get("judgeProfileId"), assignmentType: values.get("assignmentType"),
        standbyForAssignmentId: values.get("standbyForAssignmentId") || undefined,
      }),
    }), "Asignación creada.");
    form.reset();
  };

  const revoke = async (assignmentId, form) => {
    const values = new FormData(form);
    await action(`revoke-${assignmentId}`, () => apiRequest(`/api/v1/judge-assignments/${assignmentId}/revoke`, {
      method: "POST", body: JSON.stringify({ reason: values.get("reason") }),
    }), "Asignación revocada.");
  };

  const replace = async (assignmentId, form) => {
    const values = new FormData(form);
    await action(`replace-${assignmentId}`, () => apiRequest(`/api/v1/judge-assignments/${assignmentId}/replace`, {
      method: "POST",
      body: JSON.stringify({ replacementJudgeProfileId: values.get("replacementJudgeProfileId"), assignmentType: "PRIMARY", reason: values.get("reason") }),
    }), "Asignación reemplazada.");
  };

  const activateSubstitute = async (assignmentId, form) => {
    const values = new FormData(form);
    await action(`activate-${assignmentId}`, () => apiRequest(`/api/v1/judge-assignments/${assignmentId}/activate-substitute`, {
      method: "POST", body: JSON.stringify({ reason: values.get("reason") }),
    }), "Suplente activado; su planilla ya está disponible.");
  };

  return (
    <PageShell layer="instrument" className="admin-shell assignment-page">
      <header className="event-header">
        <div><p className="eyebrow">Operación de jurados</p><h1>Cupos y asignaciones</h1></div>
        <label className="event-picker">Evento<select value={eventId} onChange={(event) => setEventId(event.target.value)}>
          <option value="">Seleccionar evento</option>
          {events.map((event) => <option key={event.id} value={event.id}>{event.name} ({event.status})</option>)}
        </select></label>
      </header>
      <p className="feedback" role="status" aria-live="polite">{message}</p>
      {eventId && <>
        <section className="config-section">
          <div className="section-heading"><div><h2>Configurar cupo</h2><p>Se cuenta cada titular o suplente. Los cupos se congelan al abrir el evento.</p></div></div>
          <form className="assignment-form" onSubmit={updateQuota}>
            <label>Noche<select name="nightId" required><option value="">Elegir noche</option>{availableNights.map((night) => <option key={night.id} value={night.id}>{night.name}</option>)}</select></label>
            <label>Especialidad<select name="specialtyId" required><option value="">Elegir especialidad</option>{specialties.map((specialty) => <option key={specialty.id} value={specialty.id}>{specialty.name}</option>)}</select></label>
            <label>Cupo<input name="maxAssignments" type="number" min="1" required /></label>
            <button disabled={Boolean(busy) || !canConfigure}>Guardar cupo</button>
          </form>
          <ul className="quota-list">{data.quotas.map((quota) => <li key={quota.id}>{quota.nightName} · {quota.specialtyName}: <strong>{quota.activeAssignments}/{quota.maxAssignments}</strong></li>)}</ul>
        </section>
        <section className="config-section">
          <div className="section-heading"><div><h2>Asignar jurado</h2><p>Las altas se realizan antes de abrir el evento.</p></div></div>
          <form className="assignment-form" onSubmit={createAssignment}>
            <label>Noche<select name="nightId" required><option value="">Elegir noche</option>{availableNights.map((night) => <option key={night.id} value={night.id}>{night.name}</option>)}</select></label>
            <label>Especialidad<select name="specialtyId" required><option value="">Elegir especialidad</option>{specialties.map((specialty) => <option key={specialty.id} value={specialty.id}>{specialty.name}</option>)}</select></label>
            <label>Jurado<select name="judgeProfileId" required><option value="">Elegir jurado</option>{judges.map((judge) => <option key={judge.id} value={judge.id}>{judge.name}</option>)}</select></label>
            <label>Tipo<select name="assignmentType" value={assignmentType} onChange={(event) => setAssignmentType(event.target.value)}><option value="PRIMARY">Titular</option><option value="SUBSTITUTE">Suplente</option></select></label>
            {assignmentType === "SUBSTITUTE" && <label>Titular asignado<select name="standbyForAssignmentId" required><option value="">Elegir titular</option>{data.assignments.filter((assignment) => assignment.status === "ACTIVE" && assignment.assignmentType === "PRIMARY").map((assignment) => <option key={assignment.id} value={assignment.id}>{assignment.judgeName} · {assignment.nightName} · {assignment.specialtyName}</option>)}</select></label>}
            <button disabled={Boolean(busy) || !canConfigure}>Asignar</button>
          </form>
        </section>
        <section className="assignment-grid" aria-label="Historial de asignaciones">
          {data.assignments.length === 0 && <p className="empty-state">Todavía no hay asignaciones para este evento.</p>}
          {data.assignments.map((assignment) => {
            const standby = data.assignments.find((candidate) => candidate.status === "ACTIVE" && candidate.standbyForAssignmentId === assignment.id);
            return <article className={`assignment-card assignment-${assignment.status.toLowerCase()}`} key={assignment.id}>
            <div className="judge-card-heading"><div><p className="eyebrow">{assignment.nightName} · {assignment.specialtyName}</p><h2>{assignment.judgeName}</h2><p>{typeLabels[assignment.assignmentType]}</p></div><span className="status-pill">{assignment.status === "ACTIVE" ? "Activa" : "Revocada"}</span></div>
            {assignment.replacedAssignmentId && <p>Reemplaza una asignación anterior.</p>}
            {assignment.assignmentType === "SUBSTITUTE" && assignment.status === "ACTIVE" && <p>En espera del titular asignado.</p>}
            {standby && <p>Suplente reservado: <strong>{standby.judgeName}</strong>.</p>}
            {assignment.status === "ACTIVE" && <div className="assignment-actions">
              <form onSubmit={(event) => { event.preventDefault(); void revoke(assignment.id, event.currentTarget); }}><label>Motivo de revocación<input name="reason" required /></label><button className="danger-action" disabled={Boolean(busy) || assignment.nightStatus === "CLOSED"}>Revocar</button></form>
              {standby && <form onSubmit={(event) => { event.preventDefault(); void activateSubstitute(assignment.id, event.currentTarget); }}><label>Motivo de activación<input name="reason" required /></label><button disabled={Boolean(busy) || assignment.nightStatus === "CLOSED"}>Activar suplente</button></form>}
              <form onSubmit={(event) => { event.preventDefault(); void replace(assignment.id, event.currentTarget); }}><label>Reemplazar por<select name="replacementJudgeProfileId" required><option value="">Elegir jurado</option>{judges.filter((judge) => judge.id !== assignment.judgeProfileId).map((judge) => <option key={judge.id} value={judge.id}>{judge.name}</option>)}</select></label><label>Motivo<input name="reason" required /></label><button disabled={Boolean(busy) || assignment.nightStatus === "CLOSED"}>Reemplazar</button></form>
            </div>}
          </article>;
          })}
        </section>
      </>}
    </PageShell>
  );
}
