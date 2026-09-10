import { useEffect, useRef, useState } from "react";
import { PageShell } from "../components/PageShell.jsx";
import { apiRequest } from "../api/http.js";
import { useSession } from "../auth/session-context.jsx";
import { Dialog } from "../components/Dialog.jsx";
import { StatusPill } from "../components/StatusPill.jsx";
import { EventConfigurationPage } from "./EventConfigurationPage.jsx";
import { useAdminEvent } from "../context/AdminEventContext.jsx";

const EVENT_STATUS_LABELS = {
  CONFIGURING: "En configuración",
  OPEN: "Competencia abierta",
  CLOSED: "Evento cerrado",
};

const EMPTY_SUMMARY = { nights: 0, troupes: 0, judges: 0, rubrics: 0, loading: true };

function EventSummary({ summary }) {
  const items = [
    ["Jornadas", summary.nights],
    ["Comparsas", summary.troupes],
    ["Jurados", summary.judges],
    ["Rubros", summary.rubrics],
  ];
  return (
    <div className="event-summary-stats" aria-label="Resumen del evento">
      {items.map(([label, value]) => (
        <span key={label}>
          <strong>{summary.loading ? "—" : value}</strong>
          <small>{label}</small>
        </span>
      ))}
    </div>
  );
}

function nextStepFor(event, summary) {
  if (event.status === "OPEN") return { label: "En curso: Supervisar la votación", href: "#/veedor" };
  if (event.status === "CLOSED") return { label: "Finalizado: Revisar resultados", href: "#/admin/results" };
  if (summary.troupes === 0) return { label: "Agregar comparsas", href: "#/admin/competencia" };
  if (summary.rubrics === 0) return { label: "Configurar evaluación", href: "#/admin/competencia" };
  if (summary.judges === 0) return { label: "Registrar jurados", href: "#/admin/judges" };
  return { label: "Continuar preparación", href: "#/admin/events" };
}

export function AdminEventsPage() {
  const session = useSession();
  const adminEvent = useAdminEvent();
  const [localEvents, setLocalEvents] = useState([]);
  const [users, setUsers] = useState([]);
  const [selected, setSelected] = useState(null);
  const [nights, setNights] = useState([]);
  const [configurationLoading, setConfigurationLoading] = useState(false);
  const [configurationError, setConfigurationError] = useState(false);
  const [message, setMessage] = useState("");
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [summaries, setSummaries] = useState({});
  const createTriggerRef = useRef(null);

  const events = adminEvent?.events ?? localEvents;
  const activeEventId = adminEvent?.activeEventId ?? "";
  const hasAdminEventContext = Boolean(adminEvent);

  const refreshEvents = async () => {
    if (adminEvent) {
      await adminEvent.refreshEvents();
      return;
    }
    try {
      setLocalEvents(await apiRequest("/api/v1/events"));
      setMessage("");
    } catch {
      setLocalEvents([]);
      setMessage("No se pudieron cargar los eventos.");
    }
  };

  const refreshUsers = async () => {
    try { setUsers(await apiRequest("/api/v1/users")); }
    catch { setMessage("No se pudieron cargar los usuarios."); }
  };

  useEffect(() => {
    if (!hasAdminEventContext) void refreshEvents();
    void refreshUsers();
  }, [hasAdminEventContext]);

  const eventKey = events.map((event) => event.id).join("|");
  useEffect(() => {
    if (events.length === 0) {
      setSummaries({});
      return undefined;
    }
    let current = true;
    const loadSummaries = async () => {
      const judgesResult = await apiRequest("/api/v1/judges").catch(() => []);
      const judges = Array.isArray(judgesResult)
        ? judgesResult.filter((judge) => judge.registrationStatus === "REGISTERED").length
        : 0;
      const entries = await Promise.all(events.map(async (event) => {
        const [nightsResult, troupesResult, rubricsResult] = await Promise.allSettled([
          apiRequest(`/api/v1/events/${event.id}/nights`),
          apiRequest(`/api/v1/events/${event.id}/troupes`),
          apiRequest(`/api/v1/events/${event.id}/rubrics`),
        ]);
        return [event.id, {
          nights: nightsResult.status === "fulfilled" ? nightsResult.value.filter((night) => night.kind === "COMPETITION").length : 0,
          troupes: troupesResult.status === "fulfilled" ? troupesResult.value.filter((troupe) => troupe.active !== false).length : 0,
          judges,
          rubrics: rubricsResult.status === "fulfilled" ? rubricsResult.value.filter((rubric) => rubric.active !== false).length : 0,
          loading: false,
        }];
      }));
      if (current) setSummaries(Object.fromEntries(entries));
    };
    void loadSummaries();
    return () => { current = false; };
  }, [eventKey]);

  useEffect(() => {
    if (!selected) return;
    let current = true;
    setConfigurationError(false);
    void Promise.all([
      apiRequest(`/api/v1/events/${selected.id}/nights`),
    ]).then(([eventNights]) => {
      if (!current) return;
      setNights(eventNights);
      setMessage("");
    }).catch(() => {
      if (!current) return;
      setNights([]);
      setMessage("No se pudo cargar la configuracion del evento.");
      setConfigurationError(true);
    }).finally(() => { if (current) setConfigurationLoading(false); });
    return () => { current = false; };
  }, [selected]);

  useEffect(() => {
    if (adminEvent?.activeEvent && selected && selected.id !== adminEvent.activeEvent.id) {
      setConfigurationLoading(true);
      setConfigurationError(false);
      setSelected(adminEvent.activeEvent);
    }
  }, [adminEvent?.activeEventId]);

  const selectEvent = (event) => {
    setConfigurationLoading(true);
    setConfigurationError(false);
    adminEvent?.setActiveEvent(event);
    setSelected(event);
  };

  const create = async (formEvent) => {
    formEvent.preventDefault();
    const form = formEvent.currentTarget;
    const data = new FormData(form);
    try {
      const created = await apiRequest("/api/v1/events", {
        method: "POST",
        body: JSON.stringify({ name: data.get("name") }),
      });
      selectEvent(created);
      await refreshEvents();
      setIsCreateOpen(false);
      form.reset();
    } catch (error) {
      setMessage(error.code === "RESOURCE_CONFLICT" ? "Ya existe un evento equivalente." : "No se pudo crear el evento.");
    }
  };

  const changeAdminRole = async (user, grant) => {
    try {
      await apiRequest(`/api/v1/users/${user.id}/roles/admin`, { method: grant ? "POST" : "DELETE" });
      await refreshUsers();
      setMessage(grant ? "Administrador promovido." : "Rol ADMIN revocado.");
    } catch (error) {
      setMessage(error.code === "LAST_ADMIN_REQUIRED"
        ? "No se puede revocar al ultimo administrador."
        : "No se pudo modificar el rol.");
    }
  };

  if (selected) {
    if (configurationLoading) return <PageShell layer="instrument" className="container"><p>Cargando configuracion...</p></PageShell>;
    if (configurationError) return <PageShell layer="instrument" className="container"><div className="card"><h1>No se pudo cargar la configuracion</h1><p>No se muestran formularios para evitar trabajar sobre datos incompletos.</p><button type="button" onClick={() => { setConfigurationLoading(true); setSelected({ ...selected }); }}>Reintentar</button> <button className="secondary" type="button" onClick={() => setSelected(null)}>Volver a eventos</button></div></PageShell>;
    return (
      <EventConfigurationPage
        key={selected.id}
        event={selected}
        nights={nights}
        onBack={async () => { setSelected(null); await refreshEvents(); }}
        onCompetencia={() => { window.location.hash = "#/admin/competencia"; }}
        onEventChange={adminEvent?.updateEvent}
      />
    );
  }

  return (
    <PageShell layer="instrument" className="container admin-events-page">
      <header className="admin-events-header">
        <div>
          <p className="eyebrow">Configuración operativa</p>
          <h1>Administración de eventos</h1>
          <p>Creá, seleccioná y prepará el evento sobre el que vas a trabajar.</p>
        </div>
        <button ref={createTriggerRef} type="button" onClick={() => setIsCreateOpen(true)}>+ Nuevo evento</button>
      </header>
      <p className="feedback" role="status" aria-live="polite">{message}</p>
      {events.length === 0 ? (
        <section className="admin-events-empty card" aria-label="Catálogo de eventos vacío">
          <h2>Todavía no hay eventos</h2>
          <p>Creá el primero para comenzar la configuración del carnaval.</p>
          <button type="button" onClick={() => setIsCreateOpen(true)}>Crear primer evento</button>
        </section>
      ) : (
        <>
          {(() => {
            const activeEvent = events.find((event) => event.id === activeEventId);
            const otherEvents = events.filter((event) => event.id !== activeEventId);
            const renderActions = (event, active) => {
              const nextStep = nextStepFor(event, summaries[event.id] ?? EMPTY_SUMMARY);
              return (
                <div className="event-catalog-actions">
                  {active ? (
                    <>
                      <button type="button" onClick={() => selectEvent(event)}>Continuar preparación</button>
                      <button type="button" className="secondary" onClick={() => selectEvent(event)}>Ver detalle</button>
                    </>
                  ) : (
                    <>
                      <button type="button" onClick={() => selectEvent(event)}>Usar este evento</button>
                      {event.status === "CONFIGURING" && <button type="button" className="secondary" onClick={() => selectEvent(event)}>Ver detalle</button>}
                      {event.status === "OPEN" && <a className="button-link secondary" href={nextStep.href}>Ir a supervisión</a>}
                      {event.status === "CLOSED" && <a className="button-link secondary" href={nextStep.href}>Ver resultados</a>}
                    </>
                  )}
                </div>
              );
            };
            const renderCard = (event, active) => {
              const summary = summaries[event.id] ?? EMPTY_SUMMARY;
              const nextStep = nextStepFor(event, summary);
              return (
                <article className={`event-catalog-card${active ? " is-active" : ""}`} key={event.id}>
                  <div className="event-catalog-card-heading">
                    <div>
                      <h3>{event.name}</h3>
                      <StatusPill status={event.status} label={EVENT_STATUS_LABELS[event.status] ?? event.status} />
                    </div>
                    {active && <span className="event-active-label">✓ Evento activo</span>}
                  </div>
                  <EventSummary summary={summary} />
                  <p className="event-next-step"><strong>{nextStep.label.startsWith("En curso") || nextStep.label.startsWith("Finalizado") ? "" : "Próximo paso: "}</strong>{nextStep.label}</p>
                  {renderActions(event, active)}
                </article>
              );
            };
            return (
              <>
                <section className="event-catalog-section" aria-labelledby="active-event-title">
                  <div className="section-heading"><div><p className="eyebrow">Contexto de trabajo</p><h2 id="active-event-title">Evento activo</h2></div></div>
                  {activeEvent ? renderCard(activeEvent, true) : <div className="admin-events-empty card"><h3>Seleccioná un evento para comenzar</h3><p>Elegí un evento del catálogo para convertirlo en tu contexto de trabajo.</p></div>}
                </section>
                {otherEvents.length > 0 && <section className="event-catalog-section" aria-labelledby="other-events-title">
                  <div className="section-heading"><div><p className="eyebrow">Catálogo</p><h2 id="other-events-title">Otros eventos</h2></div><span>{otherEvents.length} disponibles</span></div>
                  <div className="event-catalog-grid">{otherEvents.map((event) => renderCard(event, false))}</div>
                </section>}
              </>
            );
          })()}
        </>
      )}
      <section className="card user-admin" aria-label="Usuarios y administradores">
        <div className="user-admin-heading"><div><p className="eyebrow">Administración de acceso</p><h2>Usuarios y administradores</h2></div><span>Gestión de plataforma</span></div>
        <p>Gestioná quién puede administrar la plataforma. El último administrador siempre queda protegido.</p>
        <ul>{users.map((user) => {
          const isAdmin = user.roles.includes("ADMIN");
          const isCurrentUser = user.id === session.user?.id;
          return <li key={user.id}>
            <span><strong>{user.name}</strong> · {user.email}</span>
            <button className="secondary" type="button" disabled={isCurrentUser && isAdmin} onClick={() => changeAdminRole(user, !isAdmin)}>{isCurrentUser && isAdmin ? "Sesión actual" : isAdmin ? "Revocar ADMIN" : "Promover a ADMIN"}</button>
          </li>;
        })}</ul>
      </section>
        <Dialog
          isOpen={isCreateOpen}
          onClose={() => setIsCreateOpen(false)}
          title="Nuevo evento"
          description="Creá un evento para luego configurar sus jornadas y competencia."
          focusReturnRef={createTriggerRef}
        >
          <form className="config-card" onSubmit={create}>
            <label>Nombre del evento<input name="name" required autoFocus /></label>
            <div className="dialog-actions">
              <button type="button" className="secondary" onClick={() => setIsCreateOpen(false)}>Cancelar</button>
              <button type="submit">Crear evento</button>
            </div>
          </form>
        </Dialog>
    </PageShell>
  );
}
