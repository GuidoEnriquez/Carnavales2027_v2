import { useEffect, useState } from "react";
import { apiRequest } from "../api/http.js";
import { EventReadinessPanel } from "../features/EventReadinessPanel.jsx";

const EMPTY_LIST = [];
const optionLabel = (entry) => entry.name ?? entry.code;
const errorMessages = {
  CATEGORY_INACTIVE: "La categoría seleccionada está inactiva.",
  EVENT_LOCKED: "El evento está abierto y su configuración ya no puede modificarse.",
  INVALID_REFERENCE: "La selección ya no es válida. Actualizá la configuración.",
  RESOURCE_CONFLICT: "El código o el orden ya está en uso.",
  SPECIALTY_INACTIVE: "La especialidad seleccionada está inactiva.",
  VALIDATION_ERROR: "Revisá los datos ingresados.",
};

export function EventConfigurationPage({
  event,
  nights: initialNights = EMPTY_LIST,
  categories: initialCategories = EMPTY_LIST,
  troupes: initialTroupes = EMPTY_LIST,
  specialties: initialSpecialties = EMPTY_LIST,
  rubrics: initialRubrics = EMPTY_LIST,
  onBack,
}) {
  const [currentEvent, setCurrentEvent] = useState(event);
  const [nights, setNights] = useState(initialNights);
  const [categories, setCategories] = useState(initialCategories);
  const [troupes, setTroupes] = useState(initialTroupes);
  const [specialties, setSpecialties] = useState(initialSpecialties);
  const [rubrics, setRubrics] = useState(initialRubrics);
  const [rubricTarget, setRubricTarget] = useState("TROUPE");
  const [readinessRevision, setReadinessRevision] = useState(0);
  const [message, setMessage] = useState("");
  const locked = currentEvent.status === "OPEN";

  useEffect(() => setNights(initialNights), [initialNights]);
  useEffect(() => setCategories(initialCategories), [initialCategories]);
  useEffect(() => setTroupes(initialTroupes), [initialTroupes]);
  useEffect(() => setSpecialties(initialSpecialties), [initialSpecialties]);
  useEffect(() => setRubrics(initialRubrics), [initialRubrics]);

  const save = async (path, body, { form, method = "POST", onSaved, reset = method === "POST" } = {}) => {
    try {
      const saved = await apiRequest(path, { method, body: JSON.stringify(body) });
      onSaved?.(saved);
      setReadinessRevision((revision) => revision + 1);
      setMessage("Cambios guardados.");
      if (reset) form?.reset();
      return saved;
    } catch (error) {
      setMessage(errorMessages[error.code] ?? error.message ?? "No se pudo guardar.");
      return null;
    }
  };

  const submit = (path, toBody, onSaved, method = "POST") => async (formEvent) => {
    formEvent.preventDefault();
    const form = formEvent.currentTarget;
    await save(path, toBody(new FormData(form)), { form, method, onSaved });
  };

  const replace = (setter) => (saved) => setter((current) => current.map((entry) => entry.id === saved.id ? { ...entry, ...saved } : entry));
  const replaceRubricChild = (rubricId, collection, saved) => {
    setRubrics((current) => current.map((rubric) => rubric.id !== rubricId ? rubric : {
      ...rubric,
      [collection]: (rubric[collection] ?? []).map((entry) => entry.id === saved.id ? { ...entry, ...saved } : entry),
    }));
  };

  const activeCategories = categories.filter((category) => category.active !== false);
  const activeSpecialties = specialties.filter((specialty) => specialty.active !== false);

  return (
    <main className="admin-shell">
      <header className="event-header">
        <div>
          <p className="eyebrow">{locked ? "Evento abierto" : "Evento en configuración"}</p>
          <h1>{currentEvent.name ?? "Evento"}</h1>
        </div>
        <div className="event-actions">
          <span className={`status-pill status-${currentEvent.status.toLowerCase()}`}>{currentEvent.status}</span>
          {onBack && <button className="secondary" type="button" onClick={onBack}>Volver a eventos</button>}
        </div>
      </header>
      <p className="feedback" role="status" aria-live="polite">{message}</p>

      <section className="config-section">
        <div className="section-heading"><h2>Evento y jornadas</h2><p>Identidad y calendario de la competencia.</p></div>
        <div className="config-grid">
          <form className="config-card" onSubmit={submit(`/api/v1/events/${event.id}`, (data) => ({ name: data.get("name") }), setCurrentEvent, "PATCH")}>
            <h3>Datos del evento</h3>
            <label>Nombre del evento<input name="name" defaultValue={currentEvent.name ?? ""} disabled={locked} required /></label>
            <button disabled={locked}>Guardar evento</button>
          </form>
          <form className="config-card" onSubmit={submit(`/api/v1/events/${event.id}/nights`, (data) => ({
            name: data.get("name"), displayOrder: Number(data.get("displayOrder")), kind: data.get("kind"), eventDate: data.get("eventDate") || null,
          }), (saved) => setNights((current) => [...current, saved]))}>
            <h3>Nueva jornada</h3>
            <label>Nombre de jornada<input name="name" disabled={locked} required /></label>
            <label>Orden<input name="displayOrder" type="number" min="1" defaultValue="1" disabled={locked} required /></label>
            <label>Fecha<input name="eventDate" type="date" disabled={locked} /></label>
            <label>Tipo<select name="kind" disabled={locked}><option value="COMPETITION">Competencia</option><option value="AWARDS">Premios</option></select></label>
            <button disabled={locked}>Agregar jornada</button>
          </form>
        </div>
        <h3 className="list-heading">Jornadas</h3>
        <div className="records-grid">
          {nights.map((night) => <form className="record" key={night.id} onSubmit={submit(`/api/v1/nights/${night.id}`, (data) => ({
            name: data.get("name"), displayOrder: Number(data.get("displayOrder")), kind: data.get("kind"), eventDate: data.get("eventDate") || null,
          }), replace(setNights), "PATCH")}>
            <label>Editar jornada {night.name}<input name="name" defaultValue={night.name} disabled={locked} required /></label>
            <label>Orden<input name="displayOrder" type="number" min="1" defaultValue={night.displayOrder} disabled={locked} required /></label>
            <label>Fecha<input name="eventDate" type="date" defaultValue={night.eventDate?.slice?.(0, 10) ?? ""} disabled={locked} /></label>
            <label>Tipo<select name="kind" defaultValue={night.kind} disabled={locked}><option value="COMPETITION">Competencia</option><option value="AWARDS">Premios</option></select></label>
            <button disabled={locked}>Guardar {night.name}</button>
          </form>)}
        </div>
      </section>

      <section className="config-section">
        <div className="section-heading"><h2>Categorías</h2><p>Catálogo propio del evento, sin valores libres en comparsas.</p></div>
        <form className="inline-form" onSubmit={submit(`/api/v1/events/${event.id}/categories`, (data) => ({
          name: data.get("name"), code: data.get("code"), displayOrder: Number(data.get("displayOrder")),
        }), (saved) => setCategories((current) => [...current, saved]))}>
          <label>Nombre de categoría<input aria-label="Nombre de categoría" name="name" disabled={locked} required /></label>
          <label>Código de categoría<input name="code" disabled={locked} required /></label>
          <label>Orden de categoría<input name="displayOrder" type="number" min="1" defaultValue="1" disabled={locked} required /></label>
          <button disabled={locked}>Agregar categoría</button>
        </form>
        <div className="records-grid">
          {categories.map((category) => <form className="record" key={category.id} onSubmit={submit(`/api/v1/categories/${category.id}`, (data) => ({
            name: data.get("name"), code: data.get("code"), displayOrder: Number(data.get("displayOrder")), active: data.get("active") === "on",
          }), replace(setCategories), "PATCH")}>
            <label>Editar nombre de {category.name}<input name="name" defaultValue={category.name} disabled={locked} required /></label>
            <label>Código<input name="code" defaultValue={category.code} disabled={locked} required /></label>
            <label>Orden<input name="displayOrder" type="number" min="1" defaultValue={category.displayOrder} disabled={locked} required /></label>
            <label className="check"><input aria-label={`Categoría ${category.name} activa`} name="active" type="checkbox" defaultChecked={category.active} disabled={locked} /> Categoría activa</label>
            <button disabled={locked}>Guardar {category.name}</button>
          </form>)}
        </div>
      </section>

      <section className="config-section">
        <div className="section-heading"><h2>Comparsas</h2><p>Participaciones y categoría vigente dentro del evento.</p></div>
        <form className="inline-form" onSubmit={submit(`/api/v1/events/${event.id}/troupes`, (data) => ({ name: data.get("name"), categoryId: data.get("categoryId") }), (saved) => setTroupes((current) => [...current, saved]))}>
          <label>Nombre de comparsa<input name="name" disabled={locked} required /></label>
          <label>Categoría de comparsa<select name="categoryId" disabled={locked} required><option value="">Seleccionar</option>{activeCategories.map((category) => <option key={category.id} value={category.id}>{optionLabel(category)}</option>)}</select></label>
          <button disabled={locked}>Agregar comparsa</button>
        </form>
        <div className="records-grid">
          {troupes.map((troupe) => <form className="record" key={troupe.id} onSubmit={submit(`/api/v1/troupes/${troupe.id}`, (data) => ({
            name: data.get("name"), categoryId: data.get("categoryId"), active: data.get("active") === "on",
          }), replace(setTroupes), "PATCH")}>
            <label>Editar nombre de {troupe.name}<input name="name" defaultValue={troupe.name} disabled={locked} required /></label>
            <label>Categoría<select name="categoryId" defaultValue={troupe.categoryId} disabled={locked} required>{categories.filter((category) => category.active !== false || category.id === troupe.categoryId).map((category) => <option key={category.id} value={category.id}>{optionLabel(category)}</option>)}</select></label>
            <label className="check"><input aria-label={troupes.length === 1 ? "Comparsa activa" : `Comparsa ${troupe.name} activa`} name="active" type="checkbox" defaultChecked={troupe.active} disabled={locked} /> Participación activa</label>
            <button disabled={locked}>Guardar {troupe.name}</button>
          </form>)}
        </div>
      </section>

      <section className="config-section">
        <div className="section-heading"><h2>Especialidades</h2><p>Responsabilidades configurables de los futuros jurados.</p></div>
        <form className="inline-form" onSubmit={submit(`/api/v1/events/${event.id}/specialties`, (data) => ({
          name: data.get("name"), code: data.get("code"), displayOrder: Number(data.get("displayOrder")),
        }), (saved) => setSpecialties((current) => [...current, saved]))}>
          <label>Nombre de especialidad<input name="name" disabled={locked} required /></label>
          <label>Código de especialidad<input name="code" disabled={locked} required /></label>
          <label>Orden de especialidad<input name="displayOrder" type="number" min="1" defaultValue="1" disabled={locked} required /></label>
          <button disabled={locked}>Agregar especialidad</button>
        </form>
        <div className="records-grid">
          {specialties.map((specialty) => <form className="record" key={specialty.id} onSubmit={submit(`/api/v1/specialties/${specialty.id}`, (data) => ({
            name: data.get("name"), code: data.get("code"), displayOrder: Number(data.get("displayOrder")), active: data.get("active") === "on",
          }), replace(setSpecialties), "PATCH")}>
            <label>Editar nombre de {specialty.name}<input aria-label={`Editar nombre de ${specialty.name}`} name="name" defaultValue={specialty.name} disabled={locked} required /></label>
            <label>Editar código de {specialty.name}<input aria-label={`Editar código de ${specialty.name}`} name="code" defaultValue={specialty.code} disabled={locked} required /></label>
            <label>Editar orden de {specialty.name}<input aria-label={`Editar orden de ${specialty.name}`} name="displayOrder" type="number" min="1" defaultValue={specialty.displayOrder} disabled={locked} required /></label>
            <label className="check"><input aria-label={specialties.length === 1 ? "Especialidad activa" : `Especialidad ${specialty.name} activa`} name="active" type="checkbox" defaultChecked={specialty.active} disabled={locked} /> Especialidad activa</label>
            <button disabled={locked}>Guardar {specialty.name}</button>
          </form>)}
        </div>
      </section>

      <section className="config-section">
        <div className="section-heading"><h2>Rubros e ítems</h2><p>Los ítems reciben puntuación; los criterios solo describen cómo evaluar.</p></div>
        <div className="config-grid">
          <form className="config-card" onSubmit={submit(`/api/v1/events/${event.id}/rubrics`, (data) => ({
            name: data.get("name"), code: data.get("code"), evaluationTarget: data.get("evaluationTarget"), expectedSubjectType: data.get("evaluationTarget") === "NOMINATION" ? data.get("expectedSubjectType") : null,
          }), (saved) => { setRubrics((current) => [...current, { ...saved, items: [], criteria: [], specialties: [] }]); setRubricTarget("TROUPE"); })}>
            <h3>Nuevo rubro</h3>
            <label>Nombre de rubro<input name="name" disabled={locked} required /></label>
            <label>Código de rubro<input name="code" disabled={locked} required /></label>
            <label>Objetivo<select name="evaluationTarget" value={rubricTarget} onChange={(changeEvent) => setRubricTarget(changeEvent.target.value)} disabled={locked}><option value="TROUPE">Comparsa</option><option value="NOMINATION">Nominación</option></select></label>
            {rubricTarget === "NOMINATION" && <label>Tipo de sujeto esperado<select name="expectedSubjectType" disabled={locked} required><option value="PERSON">Persona</option><option value="COUPLE">Pareja</option><option value="GROUP">Grupo</option><option value="FIGURE">Figura</option><option value="ELEMENT">Elemento</option><option value="OTHER">Otro</option></select></label>}
            <button disabled={locked}>Agregar rubro</button>
          </form>
          <form className="config-card" onSubmit={async (formEvent) => {
            formEvent.preventDefault(); const form = formEvent.currentTarget; const data = new FormData(form); const rubricId = data.get("rubricId");
            const saved = await save(`/api/v1/rubrics/${rubricId}/items`, { name: data.get("name"), code: data.get("code"), specialtyId: data.get("specialtyId") }, { form });
            if (saved) setRubrics((current) => current.map((rubric) => rubric.id === rubricId ? { ...rubric, items: [...(rubric.items ?? []), saved] } : rubric));
          }}>
            <h3>Nuevo ítem puntuable</h3>
            <label>Rubro del ítem<select name="rubricId" disabled={locked} required><option value="">Seleccionar</option>{rubrics.map((rubric) => <option key={rubric.id} value={rubric.id}>{optionLabel(rubric)}</option>)}</select></label>
            <label>Nombre del ítem<input name="name" disabled={locked} required /></label>
            <label>Código del ítem<input name="code" disabled={locked} required /></label>
            <label>Especialidad responsable del ítem<select name="specialtyId" disabled={locked} required><option value="">Seleccionar</option>{activeSpecialties.map((specialty) => <option key={specialty.id} value={specialty.id}>{optionLabel(specialty)}</option>)}</select></label>
            <button disabled={locked}>Agregar ítem</button>
          </form>
          <form className="config-card" onSubmit={async (formEvent) => {
            formEvent.preventDefault(); const form = formEvent.currentTarget; const data = new FormData(form); const rubricId = data.get("rubricId");
            const saved = await save(`/api/v1/rubrics/${rubricId}/criteria`, { description: data.get("description"), displayOrder: Number(data.get("displayOrder")) }, { form });
            if (saved) setRubrics((current) => current.map((rubric) => rubric.id === rubricId ? { ...rubric, criteria: [...(rubric.criteria ?? []), saved] } : rubric));
          }}>
            <h3>Nuevo criterio descriptivo</h3>
            <label>Rubro del criterio<select name="rubricId" disabled={locked} required><option value="">Seleccionar</option>{rubrics.map((rubric) => <option key={rubric.id} value={rubric.id}>{optionLabel(rubric)}</option>)}</select></label>
            <label>Descripción<textarea name="description" disabled={locked} required /></label>
            <label>Orden<input name="displayOrder" type="number" min="1" defaultValue="1" disabled={locked} required /></label>
            <button disabled={locked}>Agregar criterio</button>
          </form>
        </div>

        <div className="rubric-list">
          {rubrics.map((rubric) => {
            const derived = activeSpecialties.filter((specialty) => (rubric.items ?? []).some((item) => item.active !== false && item.specialtyId === specialty.id));
            return <article className="rubric-card" key={rubric.id}>
              <form onSubmit={submit(`/api/v1/rubrics/${rubric.id}`, (data) => ({
                name: data.get("name"), code: data.get("code"), evaluationTarget: data.get("evaluationTarget"), expectedSubjectType: data.get("evaluationTarget") === "NOMINATION" ? data.get("expectedSubjectType") : null, active: data.get("active") === "on",
              }), replace(setRubrics), "PATCH")}>
                <h3>{rubric.name}</h3>
                <label>Editar nombre de {rubric.name}<input name="name" defaultValue={rubric.name} disabled={locked} required /></label>
                <label>Código<input name="code" defaultValue={rubric.code} disabled={locked} required /></label>
                <label>Objetivo<select name="evaluationTarget" defaultValue={rubric.evaluationTarget} disabled={locked}><option value="TROUPE">Comparsa</option><option value="NOMINATION">Nominación</option></select></label>
                <label>Tipo esperado<select name="expectedSubjectType" defaultValue={rubric.expectedSubjectType ?? "PERSON"} disabled={locked}><option value="PERSON">Persona</option><option value="COUPLE">Pareja</option><option value="GROUP">Grupo</option><option value="FIGURE">Figura</option><option value="ELEMENT">Elemento</option><option value="OTHER">Otro</option></select></label>
                <label className="check"><input aria-label={`Rubro ${rubric.name} activo`} name="active" type="checkbox" defaultChecked={rubric.active} disabled={locked} /> Rubro activo</label>
                <p className="derived">Especialidades derivadas: {derived.map((specialty) => specialty.name).join(", ") || "Sin ítems activos"}</p>
                <button disabled={locked}>Guardar {rubric.name}</button>
              </form>
              <div className="subrecords">
                {(rubric.items ?? []).map((item) => <form className="record" key={item.id} onSubmit={submit(`/api/v1/evaluation-items/${item.id}`, (data) => ({
                  name: data.get("name"), code: data.get("code"), specialtyId: data.get("specialtyId"), active: data.get("active") === "on",
                }), (saved) => replaceRubricChild(rubric.id, "items", saved), "PATCH")}>
                  <strong>Ítem puntuable</strong>
                  <label>Editar ítem {item.name}<input name="name" defaultValue={item.name} disabled={locked} required /></label>
                  <label>Código<input name="code" defaultValue={item.code} disabled={locked} required /></label>
                  <label>Especialidad<select name="specialtyId" defaultValue={item.specialtyId} disabled={locked}>{specialties.filter((specialty) => specialty.active !== false || specialty.id === item.specialtyId).map((specialty) => <option key={specialty.id} value={specialty.id}>{specialty.name}</option>)}</select></label>
                  <label className="check"><input aria-label={`Ítem ${item.name} activo`} name="active" type="checkbox" defaultChecked={item.active} disabled={locked} /> Ítem activo</label>
                  <button disabled={locked}>Guardar ítem {item.name}</button>
                </form>)}
                {(rubric.criteria ?? []).map((criterion) => <form className="record criterion" key={criterion.id} onSubmit={submit(`/api/v1/rubric-criteria/${criterion.id}`, (data) => ({
                  description: data.get("description"), displayOrder: Number(data.get("displayOrder")), active: data.get("active") === "on",
                }), (saved) => replaceRubricChild(rubric.id, "criteria", saved), "PATCH")}>
                  <strong>Criterio descriptivo</strong>
                  <label>Descripción<textarea name="description" defaultValue={criterion.description} disabled={locked} required /></label>
                  <label>Orden<input name="displayOrder" type="number" min="1" defaultValue={criterion.displayOrder} disabled={locked} required /></label>
                  <label className="check"><input aria-label={`Criterio ${criterion.description} activo`} name="active" type="checkbox" defaultChecked={criterion.active} disabled={locked} /> Criterio activo</label>
                  <button disabled={locked}>Guardar criterio</button>
                </form>)}
              </div>
            </article>;
          })}
        </div>
      </section>

      <EventReadinessPanel
        event={currentEvent}
        locked={locked}
        refreshKey={readinessRevision}
        onOpened={(openedEvent) => setCurrentEvent((current) => ({ ...current, ...openedEvent }))}
      />
    </main>
  );
}
