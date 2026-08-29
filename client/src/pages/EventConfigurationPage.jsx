import { useEffect, useState } from "react";
import { apiRequest } from "../api/http.js";
import { EventReadinessPanel } from "../features/EventReadinessPanel.jsx";

const optionLabel = (entry) => entry.name ?? entry.code;
const EMPTY_LIST = [];

export function EventConfigurationPage({
  event,
  categories: initialCategories = EMPTY_LIST,
  specialties: initialSpecialties = EMPTY_LIST,
  rubrics: initialRubrics = EMPTY_LIST,
}) {
  const [status, setStatus] = useState(event.status);
  const [categories, setCategories] = useState(initialCategories);
  const [specialties, setSpecialties] = useState(initialSpecialties);
  const [rubrics, setRubrics] = useState(initialRubrics);
  const [rubricTarget, setRubricTarget] = useState("TROUPE");
  const [readinessRevision, setReadinessRevision] = useState(0);
  const [message, setMessage] = useState("");
  const locked = status === "OPEN";

  useEffect(() => setCategories(initialCategories), [initialCategories]);
  useEffect(() => setSpecialties(initialSpecialties), [initialSpecialties]);
  useEffect(() => setRubrics(initialRubrics), [initialRubrics]);

  const save = async (path, body, form, onSaved, method = "POST") => {
    try {
      const saved = await apiRequest(path, {
        method,
        body: JSON.stringify(body),
      });
      onSaved?.(saved);
      setReadinessRevision((revision) => revision + 1);
      setMessage("Guardado.");
      form.reset();
    } catch {
      setMessage("No se pudo guardar.");
    }
  };

  const submit = (path, toBody, onSaved, method = "POST") => async (formEvent) => {
    formEvent.preventDefault();
    const form = formEvent.currentTarget;
    await save(path, toBody(new FormData(form)), form, onSaved, method);
  };

  return (
    <main>
      <h1>Configuración: {status}</h1>
      <p>{message}</p>

      <section>
        <h2>Jornadas</h2>
        <form onSubmit={submit(`/api/v1/events/${event.id}/nights`, (data) => ({
          name: data.get("name"),
          displayOrder: Number(data.get("displayOrder")),
          kind: data.get("kind"),
        }))}>
          <label>Nombre de jornada<input name="name" disabled={locked} required /></label>
          <label>Orden<input name="displayOrder" type="number" defaultValue="1" disabled={locked} required /></label>
          <label>Tipo<select name="kind" disabled={locked}><option value="COMPETITION">Competencia</option><option value="AWARDS">Premios</option></select></label>
          <button disabled={locked}>Agregar jornada</button>
        </form>
      </section>

      <section>
        <h2>Categorías</h2>
        <form onSubmit={submit(`/api/v1/events/${event.id}/categories`, (data) => ({
          name: data.get("name"),
          code: data.get("code"),
          displayOrder: Number(data.get("displayOrder")),
        }), (saved) => setCategories((current) => [...current, saved]))}>
          <label>Nombre de categoría<input aria-label="Nombre de categoría" name="name" disabled={locked} required /></label>
          <label>Código de categoría<input name="code" disabled={locked} required /></label>
          <label>Orden de categoría<input name="displayOrder" type="number" defaultValue="1" disabled={locked} required /></label>
          <button disabled={locked}>Agregar categoría</button>
        </form>
      </section>

      <section>
        <h2>Comparsas</h2>
        <form onSubmit={submit(`/api/v1/events/${event.id}/troupes`, (data) => ({
          name: data.get("name"),
          categoryId: data.get("categoryId"),
        }))}>
          <label>Nombre de comparsa<input name="name" disabled={locked} required /></label>
          <label>Categoría de comparsa<select name="categoryId" disabled={locked} required><option value="">Seleccionar</option>{categories.map((category) => <option key={category.id} value={category.id}>{optionLabel(category)}</option>)}</select></label>
          <button disabled={locked}>Agregar comparsa</button>
        </form>
      </section>

      <section>
        <h2>Especialidades</h2>
        <form onSubmit={submit(`/api/v1/events/${event.id}/specialties`, (data) => ({
          name: data.get("name"),
          code: data.get("code"),
          displayOrder: Number(data.get("displayOrder")),
        }), (saved) => setSpecialties((current) => [...current, saved]))}>
          <label>Nombre de especialidad<input name="name" disabled={locked} required /></label>
          <label>Código de especialidad<input name="code" disabled={locked} required /></label>
          <label>Orden de especialidad<input name="displayOrder" type="number" defaultValue="1" disabled={locked} required /></label>
          <button disabled={locked}>Agregar especialidad</button>
        </form>
        {specialties.map((specialty) => (
          <form key={specialty.id} onSubmit={submit(`/api/v1/specialties/${specialty.id}`, (data) => ({
            name: data.get("name"),
            code: data.get("code"),
            displayOrder: Number(data.get("displayOrder")),
            active: data.get("active") === "on",
          }), (saved) => setSpecialties((current) => current.map((entry) => entry.id === saved.id ? saved : entry)), "PATCH")}>
            <label>Editar nombre de {specialty.name}<input aria-label={`Editar nombre de ${specialty.name}`} name="name" defaultValue={specialty.name} disabled={locked} required /></label>
            <label>Editar código de {specialty.name}<input aria-label={`Editar código de ${specialty.name}`} name="code" defaultValue={specialty.code} disabled={locked} required /></label>
            <label>Editar orden de {specialty.name}<input aria-label={`Editar orden de ${specialty.name}`} name="displayOrder" type="number" defaultValue={specialty.displayOrder} disabled={locked} required /></label>
            <label>Especialidad activa<input name="active" type="checkbox" defaultChecked={specialty.active} disabled={locked} /></label>
            <button disabled={locked}>Guardar {specialty.name}</button>
          </form>
        ))}
      </section>

      <section>
        <h2>Rubros e ítems</h2>
        <form onSubmit={submit(`/api/v1/events/${event.id}/rubrics`, (data) => ({
          name: data.get("name"),
          code: data.get("code"),
          evaluationTarget: data.get("evaluationTarget"),
          expectedSubjectType: data.get("evaluationTarget") === "NOMINATION" ? data.get("expectedSubjectType") : null,
        }), (saved) => { setRubrics((current) => [...current, saved]); setRubricTarget("TROUPE"); })}>
          <label>Nombre de rubro<input name="name" disabled={locked} required /></label>
          <label>Código de rubro<input name="code" disabled={locked} required /></label>
          <label>Objetivo<select name="evaluationTarget" value={rubricTarget} onChange={(event) => setRubricTarget(event.target.value)} disabled={locked}><option value="TROUPE">Comparsa</option><option value="NOMINATION">Nominación</option></select></label>
          {rubricTarget === "NOMINATION" && (
            <label>Tipo de sujeto esperado<select name="expectedSubjectType" disabled={locked} required><option value="PERSON">Persona</option><option value="COUPLE">Pareja</option><option value="GROUP">Grupo</option><option value="FIGURE">Figura</option><option value="ELEMENT">Elemento</option><option value="OTHER">Otro</option></select></label>
          )}
          <button disabled={locked}>Agregar rubro</button>
        </form>
        <p>Las especialidades del rubro se derivan de sus ítems activos.</p>
        <form onSubmit={async (formEvent) => {
          formEvent.preventDefault();
          const form = formEvent.currentTarget;
          const data = new FormData(form);
          await save(`/api/v1/rubrics/${data.get("rubricId")}/items`, {
            name: data.get("name"),
            code: data.get("code"),
            specialtyId: data.get("specialtyId"),
          }, form);
        }}>
          <label>Rubro del ítem<select name="rubricId" disabled={locked} required><option value="">Seleccionar</option>{rubrics.map((rubric) => <option key={rubric.id} value={rubric.id}>{optionLabel(rubric)}</option>)}</select></label>
          <label>Nombre del ítem<input name="name" disabled={locked} required /></label>
          <label>Código del ítem<input name="code" disabled={locked} required /></label>
          <label>Especialidad responsable del ítem<select name="specialtyId" disabled={locked} required><option value="">Seleccionar</option>{specialties.filter((specialty) => specialty.active !== false).map((specialty) => <option key={specialty.id} value={specialty.id}>{optionLabel(specialty)}</option>)}</select></label>
          <button disabled={locked}>Agregar ítem</button>
        </form>
      </section>

      <EventReadinessPanel
        event={event}
        locked={locked}
        refreshKey={readinessRevision}
        onOpened={(openedEvent) => setStatus(openedEvent.status)}
      />
    </main>
  );
}
