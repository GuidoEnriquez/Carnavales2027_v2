import { useEffect, useState } from "react";
import { apiRequest } from "../api/http.js";
import { EventConfigurationPage } from "./EventConfigurationPage.jsx";

export function AdminEventsPage() {
  const [events, setEvents] = useState([]);
  const [selected, setSelected] = useState(null);
  const [categories, setCategories] = useState([]);
  const [specialties, setSpecialties] = useState([]);
  const [rubrics, setRubrics] = useState([]);
  const [configurationLoading, setConfigurationLoading] = useState(false);

  const refreshEvents = async () => {
    try { setEvents(await apiRequest("/api/v1/events")); }
    catch { setEvents([]); }
  };

  useEffect(() => { void refreshEvents(); }, []);

  useEffect(() => {
    if (!selected) return;
    let current = true;
    void Promise.all([
      apiRequest(`/api/v1/events/${selected.id}/categories`),
      apiRequest(`/api/v1/events/${selected.id}/specialties`),
      apiRequest(`/api/v1/events/${selected.id}/rubrics`),
    ]).then(([eventCategories, eventSpecialties, eventRubrics]) => {
      if (!current) return;
      setCategories(eventCategories);
      setSpecialties(eventSpecialties);
      setRubrics(eventRubrics);
    }).catch(() => {
      if (!current) return;
      setCategories([]);
      setSpecialties([]);
      setRubrics([]);
    }).finally(() => { if (current) setConfigurationLoading(false); });
    return () => { current = false; };
  }, [selected]);

  const selectEvent = (event) => {
    setConfigurationLoading(true);
    setSelected(event);
  };

  const create = async (formEvent) => {
    formEvent.preventDefault();
    const form = formEvent.currentTarget;
    const data = new FormData(form);
    const created = await apiRequest("/api/v1/events", {
      method: "POST",
      body: JSON.stringify({ name: data.get("name") }),
    });
    selectEvent(created);
    await refreshEvents();
    form.reset();
  };

  if (selected) {
    if (configurationLoading) return <main><p>Cargando configuración…</p></main>;
    return (
      <EventConfigurationPage
        key={selected.id}
        event={selected}
        categories={categories}
        specialties={specialties}
        rubrics={rubrics}
      />
    );
  }

  return (
    <main>
      <h1>Carnavales 2027</h1>
      <h2>Administración de eventos</h2>
      <form onSubmit={create}>
        <label>Nuevo evento<input name="name" required /></label>
        <button>Crear evento</button>
      </form>
      <ul>{events.map((event) => <li key={event.id}><button onClick={() => selectEvent(event)}>{event.name} ({event.status})</button></li>)}</ul>
    </main>
  );
}
