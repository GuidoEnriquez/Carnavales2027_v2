import { useEffect, useState } from "react";
import { apiRequest } from "../api/http.js";
import { useSession } from "../auth/session-context.jsx";
import { EventConfigurationPage } from "./EventConfigurationPage.jsx";

export function AdminEventsPage() {
  const session = useSession();
  const [events, setEvents] = useState([]);
  const [users, setUsers] = useState([]);
  const [selected, setSelected] = useState(null);
  const [categories, setCategories] = useState([]);
  const [nights, setNights] = useState([]);
  const [troupes, setTroupes] = useState([]);
  const [specialties, setSpecialties] = useState([]);
  const [rubrics, setRubrics] = useState([]);
  const [configurationLoading, setConfigurationLoading] = useState(false);
  const [configurationError, setConfigurationError] = useState(false);
  const [message, setMessage] = useState("");

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
      apiRequest(`/api/v1/events/${selected.id}/categories`),
      apiRequest(`/api/v1/events/${selected.id}/troupes`),
      apiRequest(`/api/v1/events/${selected.id}/specialties`),
      apiRequest(`/api/v1/events/${selected.id}/rubrics`),
    ]).then(([eventNights, eventCategories, eventTroupes, eventSpecialties, eventRubrics]) => {
      if (!current) return;
      setNights(eventNights);
      setCategories(eventCategories);
      setTroupes(eventTroupes);
      setSpecialties(eventSpecialties);
      setRubrics(eventRubrics);
      setMessage("");
    }).catch(() => {
      if (!current) return;
      setNights([]);
      setCategories([]);
      setTroupes([]);
      setSpecialties([]);
      setRubrics([]);
      setMessage("No se pudo cargar la configuración del evento.");
      setConfigurationError(true);
    }).finally(() => { if (current) setConfigurationLoading(false); });
    return () => { current = false; };
  }, [selected]);

  const selectEvent = (event) => {
    setConfigurationLoading(true);
    setConfigurationError(false);
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
        ? "No se puede revocar al último administrador."
        : "No se pudo modificar el rol.");
    }
  };

  if (selected) {
    if (configurationLoading) return <main className="container"><p>Cargando configuración…</p></main>;
    if (configurationError) return <main className="container"><div className="card"><h1>No se pudo cargar la configuración</h1><p>No se muestran formularios para evitar trabajar sobre datos incompletos.</p><button type="button" onClick={() => { setConfigurationLoading(true); setSelected({ ...selected }); }}>Reintentar</button> <button className="secondary" type="button" onClick={() => setSelected(null)}>Volver a eventos</button></div></main>;
    return (
      <EventConfigurationPage
        key={selected.id}
        event={selected}
        nights={nights}
        categories={categories}
        troupes={troupes}
        specialties={specialties}
        rubrics={rubrics}
        onBack={async () => { setSelected(null); await refreshEvents(); }}
      />
    );
  }

  return (
    <main className="container">
      <div className="card">
        <h1>Carnavales 2027</h1>
        <h2>Administración de eventos</h2>
        <p className="eyebrow">Configuración operativa</p>
        <form onSubmit={create}>
          <label>Nuevo evento<input name="name" required /></label>
          <button>Crear evento</button>
        </form>
        <ul>{events.map((event) => <li key={event.id}><button onClick={() => selectEvent(event)}>{event.name} ({event.status})</button></li>)}</ul>
        <p role="status">{message}</p>
        <section className="user-admin">
          <h2>Usuarios y administradores</h2>
          <p>Los usuarios existentes pueden recibir o perder el rol ADMIN. El último ADMIN siempre queda protegido.</p>
          <ul>{users.map((user) => {
            const isAdmin = user.roles.includes("ADMIN");
            const isCurrentUser = user.id === session.user?.id;
            return <li key={user.id}>
              <span><strong>{user.name}</strong> · {user.email}</span>
              <button className="secondary" type="button" disabled={isCurrentUser && isAdmin} onClick={() => changeAdminRole(user, !isAdmin)}>{isCurrentUser && isAdmin ? "Sesión actual" : isAdmin ? "Revocar ADMIN" : "Promover a ADMIN"}</button>
            </li>;
          })}</ul>
        </section>
      </div>
    </main>
  );
}
