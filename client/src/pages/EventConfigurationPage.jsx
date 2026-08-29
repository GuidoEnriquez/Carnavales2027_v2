import { useState } from "react";
import { apiRequest } from "../api/http.js";

const empty = { name: "", code: "", displayOrder: 1 };
export function EventConfigurationPage({ event, categories = [], specialties = [] }) {
  const [message, setMessage] = useState("");
  const locked = event.status === "OPEN";
  const submit = (path, body) => async (formEvent) => {
    formEvent.preventDefault();
    try { await apiRequest(path, { method: "POST", body: JSON.stringify(body(new FormData(formEvent.currentTarget))) }); setMessage("Guardado."); formEvent.currentTarget.reset(); } catch { setMessage("No se pudo guardar."); }
  };
  return <main>
    <h1>Configuración: {event.status}</h1><p>{message}</p>
    <section><h2>Jornadas</h2><form onSubmit={submit(`/api/v1/events/${event.id}/nights`, d => ({ name: d.get("name"), displayOrder: Number(d.get("displayOrder")), kind: d.get("kind") }))}><label>Nombre de jornada<input name="name" disabled={locked} required /></label><label>Orden<input name="displayOrder" type="number" defaultValue="1" disabled={locked} required /></label><label>Tipo<select name="kind" disabled={locked}><option value="COMPETITION">Competencia</option><option value="AWARDS">Premios</option></select></label><button disabled={locked}>Agregar jornada</button></form></section>
    <section><h2>Categorías</h2><form onSubmit={submit(`/api/v1/events/${event.id}/categories`, d => ({ name: d.get("name"), code: d.get("code"), displayOrder: Number(d.get("displayOrder")) }))}><label>Nombre de categoría<input aria-label="Nombre de categoría" name="name" disabled={locked} required /></label><label>Código<input name="code" disabled={locked} required /></label><label>Orden<input name="displayOrder" type="number" defaultValue="1" disabled={locked} required /></label><button disabled={locked}>Agregar categoría</button></form></section>
    <section><h2>Comparsas</h2><form onSubmit={submit(`/api/v1/events/${event.id}/troupes`, d => ({ name: d.get("name"), categoryId: d.get("categoryId") }))}><label>Nombre<input name="name" disabled={locked} required /></label><label>Categoría de comparsa<select aria-label="Categoría de comparsa" name="categoryId" disabled={locked} required><option value="">Seleccionar</option>{categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label><button disabled={locked}>Agregar comparsa</button></form></section>
    <section><h2>Especialidades</h2><form onSubmit={submit(`/api/v1/events/${event.id}/specialties`, d => ({ name: d.get("name"), code: d.get("code"), displayOrder: Number(d.get("displayOrder")) }))}><label>Nombre<input name="name" disabled={locked} required /></label><label>Código<input name="code" disabled={locked} required /></label><label>Orden<input name="displayOrder" type="number" defaultValue="1" disabled={locked} required /></label><button disabled={locked}>Agregar especialidad</button></form></section>
    <section><h2>Rubros e ítems</h2><form onSubmit={submit(`/api/v1/events/${event.id}/rubrics`, d => ({ name: d.get("name"), code: d.get("code"), evaluationTarget: d.get("evaluationTarget") }))}><label>Nombre<input name="name" disabled={locked} required /></label><label>Código<input name="code" disabled={locked} required /></label><label>Objetivo<select name="evaluationTarget" disabled={locked}><option value="TROUPE">Comparsa</option><option value="NOMINATION">Nominación</option></select></label><button disabled={locked}>Agregar rubro</button></form><p>Las especialidades del rubro se derivan de sus ítems activos.</p></section>
  </main>;
}
