import { useEffect, useRef, useState } from "react";
import { PageShell } from "../components/PageShell.jsx";
import { apiRequest } from "../api/http.js";
import { useSession } from "../auth/session-context.jsx";
import { Dialog } from "../components/Dialog.jsx";
import { EventCard } from "../components/EventCard.jsx";
import { EventConfigurationPage } from "./EventConfigurationPage.jsx";

export function AdminEventsPage() {
  const session = useSession();
  const [events, setEvents] = useState([]);
  const [users, setUsers] = useState([]);
  const [selected, setSelected] = useState(null);
  const [nights, setNights] = useState([]);
  const [configurationLoading, setConfigurationLoading] = useState(false);
  const [configurationError, setConfigurationError] = useState(false);
  const [message, setMessage] = useState("");
  const [isPickerOpen, setIsPickerOpen] = useState(false);
  const pickerTriggerRef = useRef(null);

  const refreshEvents = async () => {
    try {
      setEvents(await apiRequest("/api/v1/events"));
      setMessage("");
    } catch {
      setEvents([]);
      setMessage("No se pudieron cargar los eventos.");
    }
  };

  const refreshUsers = async () => {
    try { setUsers(await apiRequest("/api/v1/users")); }
    catch { setMessage("No se pudieron cargar los usuarios."); }
  };

  useEffect(() => { void refreshEvents(); void refreshUsers(); }, []);

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

  const selectEvent = (event) => {
    setConfigurationLoading(true);
    setConfigurationError(false);
    setIsPickerOpen(false);
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

  const suggestedStep = (status) => ({
    CONFIGURING: "Completar la configuracion y asignar jurados.",
    OPEN: "Supervisar el avance de la votacion.",
    CLOSED: "Revisar los resultados del escrutinio.",
  }[status] ?? "Revisar el estado operativo del evento.");

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
      />
    );
  }

  return (
    <PageShell layer="instrument" className="container">
      <div className="card">
        <p className="eyebrow">Configuracion operativa</p>
        <h1>Administracion de eventos</h1>
        {events.length > 0 && <section className="operations-summary" aria-label="Resumen operativo">
          <div className="section-heading"><div><p className="eyebrow">Resumen operativo</p><h2>Proximo paso</h2></div></div>
          <div className="operations-summary-list">
            {events.map((event) => <article key={event.id}>
              <strong>{event.name}</strong>
              <span>Estado: {event.status}</span>
              <p>{suggestedStep(event.status)}</p>
              {event.status === "OPEN" && <a className="button-link" href="#/veedor">Ver supervision</a>}
              {event.status === "CLOSED" && <a className="button-link" href="#/admin/results">Abrir escrutinio</a>}
            </article>)}
          </div>
        </section>}
        <div className="event-actions">
          <form className="inline-form" onSubmit={create}>
            <label>Nuevo evento<input name="name" required /></label>
            <button>Crear evento</button>
          </form>
          {events.length > 0 && <button ref={pickerTriggerRef} type="button" className="config-event-trigger" onClick={() => setIsPickerOpen(true)}>Configurar evento</button>}
        </div>
        <Dialog
          isOpen={isPickerOpen}
          onClose={() => setIsPickerOpen(false)}
          title="Configurar evento"
          description="Elegí un evento para configurar o revisar su estado."
          focusReturnRef={pickerTriggerRef}
        >
          <div className="event-picker-list" role="list">
            {events.map((event) => <EventCard key={event.id} event={event} onSelect={selectEvent} />)}
          </div>
        </Dialog>
        {message && <p role="status" className="feedback">{message}</p>}
      </div>
      <section className="card user-admin" aria-label="Usuarios y administradores">
        <h2>Usuarios y administradores</h2>
        <p>Los usuarios existentes pueden recibir o perder el rol ADMIN. El ultimo ADMIN siempre queda protegido.</p>
        <ul>{users.map((user) => {
          const isAdmin = user.roles.includes("ADMIN");
          const isCurrentUser = user.id === session.user?.id;
          return <li key={user.id}>
            <span><strong>{user.name}</strong> · {user.email}</span>
            <button className="secondary" type="button" disabled={isCurrentUser && isAdmin} onClick={() => changeAdminRole(user, !isAdmin)}>{isCurrentUser && isAdmin ? "Sesion actual" : isAdmin ? "Revocar ADMIN" : "Promover a ADMIN"}</button>
          </li>;
        })}</ul>
      </section>
    </PageShell>
  );
}
