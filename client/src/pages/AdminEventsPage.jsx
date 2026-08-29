import { useEffect, useState } from "react";
import { apiRequest } from "../api/http.js";
import { EventConfigurationPage } from "./EventConfigurationPage.jsx";

export function AdminEventsPage() {
  const [events, setEvents] = useState([]); const [selected, setSelected] = useState(null); const [categories, setCategories] = useState([]); const [specialties, setSpecialties] = useState([]);
  const refresh = () => apiRequest("/api/v1/events").then(setEvents).catch(() => setEvents([]));
  useEffect(refresh, []);
  useEffect(() => { if (!selected) return; apiRequest(`/api/v1/events/${selected.id}/categories`).then(setCategories).catch(() => setCategories([])); apiRequest(`/api/v1/events/${selected.id}/specialties`).then(setSpecialties).catch(() => setSpecialties([])); }, [selected]);
  const create = async (event) => { event.preventDefault(); const form = new FormData(event.currentTarget); const created = await apiRequest("/api/v1/events", { method: "POST", body: JSON.stringify({ name: form.get("name") }) }); setSelected(created); await refresh(); event.currentTarget.reset(); };
  if (selected) return <EventConfigurationPage event={selected} categories={categories} specialties={specialties} />;
  return <main><h1>Carnavales 2027</h1><h2>Administración de eventos</h2><form onSubmit={create}><label>Nuevo evento<input name="name" required /></label><button>Crear evento</button></form><ul>{events.map(event => <li key={event.id}><button onClick={() => setSelected(event)}>{event.name} ({event.status})</button></li>)}</ul></main>;
}
