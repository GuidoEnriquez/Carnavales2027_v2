import { createContext, useContext, useEffect, useRef, useState } from "react";
import { PageShell } from "../components/PageShell.jsx";
import { apiRequest } from "../api/http.js";
import { StatusPill } from "../components/StatusPill.jsx";

const WriteContext = createContext(null);

function SaveForm({ onSubmit, resetOnSuccess = false, ...props }) {
  const { writing, setPending } = useContext(WriteContext);
  return <form {...props} onSubmit={async (e) => {
    e.preventDefault();
    if (writing.current) return;
    const form = e.currentTarget;
    writing.current = true;
    // Read form values before the pending render disables its controls.
    try {
      const result = onSubmit(e);
      setPending(true);
      if (await result && resetOnSuccess) form.reset();
    } finally {
      writing.current = false;
      setPending(false);
    }
  }} />;
}

export function AdminCompetenciaPage({ event, onBack }) {
  const [subPage, setSubPage] = useState("overview");
  const [pending, setPending] = useState(false);
  const writing = useRef(false);

  const links = [
    { key: "overview", label: "Resumen" },
    { key: "troupes", label: "Comparsas" },
    { key: "categories", label: "Tipos de participacion" },
    { key: "specialties", label: "Especialidades" },
    { key: "rubrics", label: "Rubros" },
    { key: "matrix", label: "Matriz de planillas" },
  ];

  return (
    <WriteContext.Provider value={{ writing, setPending }}>
      <PageShell layer="instrument" className="admin-shell" aria-busy={pending}>
        <fieldset aria-label="Configuracion de competencia" disabled={pending} className="fieldset-reset">
          <header className="event-header">
            <div>
              <p className="eyebrow">Competencia</p>
              <h1>{event.name ?? "Evento"}</h1>
            </div>
            <div className="event-actions">
              {onBack && <button className="secondary" type="button" onClick={onBack}>Volver</button>}
            </div>
          </header>
          <nav className="competencia-nav" aria-label="Secciones de competencia">
            {links.map((link) => (
              <button
                key={link.key}
                className={subPage === link.key ? "active" : "secondary"}
                type="button"
                onClick={() => setSubPage(link.key)}
              >
                {link.label}
              </button>
            ))}
          </nav>
          {subPage === "overview" && <CompetenciaOverview event={event} />}
          {subPage === "troupes" && <AdminTroupesSection event={event} />}
          {subPage === "categories" && <AdminCategoriesSection event={event} />}
          {subPage === "specialties" && <AdminSpecialtiesSection event={event} />}
          {subPage === "rubrics" && <AdminRubricsSection event={event} />}
          {subPage === "matrix" && <MatrizPlanillasSection event={event} />}
        </fieldset>
      </PageShell>
    </WriteContext.Provider>
  );
}

function CompetenciaOverview({ event }) {
  const [data, setData] = useState(null);
  const [message, setMessage] = useState("");
  const locked = event.status === "OPEN";

  useEffect(() => {
    let active = true;
    Promise.all([
      apiRequest(`/api/v1/events/${event.id}/troupes`),
      apiRequest(`/api/v1/events/${event.id}/specialties`),
      apiRequest(`/api/v1/events/${event.id}/rubrics`),
      apiRequest(`/api/v1/events/${event.id}/orphaned-criteria`),
    ]).then(([troupes, specialties, rubrics, orphaned]) => {
      if (!active) return;
      setData({ troupes, specialties, rubrics, orphaned });
    }).catch(() => { if (active) setMessage("No se pudo cargar el resumen."); });
    return () => { active = false; };
  }, [event.id]);

  const reassignCriterion = async (criterionId, scoringItemId) => {
    try {
      const saved = await apiRequest(`/api/v1/rubric-criteria/${criterionId}`, {
        method: "PATCH",
        body: JSON.stringify({ scoringItemId }),
      });
      setData((previous) => ({
        ...previous,
        orphaned: previous.orphaned.filter((criterion) => criterion.id !== criterionId),
        rubrics: previous.rubrics.map((rubric) => rubric.id === saved.rubricId
          ? { ...rubric, criteria: [...(rubric.criteria ?? []), saved] }
          : rubric),
      }));
      setMessage("Criterio reasignado.");
      return true;
    } catch {
      setMessage("No se pudo reasignar el criterio.");
    }
  };

  if (message && !data) return <p role="status">{message}</p>;
  if (!data) return <p>Cargando resumen...</p>;

  return (
    <section className="config-section">
      <div className="section-heading">
        <h2>Resumen de competencia</h2>
      </div>
      <p className="feedback" role="status">{message}</p>
      <div className="competencia-overview-grid">
        <article className="overview-stat">
          <span className="overview-number">{data.troupes.filter((t) => t.active).length}</span>
          <span className="overview-label">Comparsas activas</span>
        </article>
        <article className="overview-stat">
          <span className="overview-number">{data.specialties.filter((s) => s.active).length}</span>
          <span className="overview-label">Especialidades activas</span>
        </article>
        <article className="overview-stat">
          <span className="overview-number">{data.rubrics.filter((r) => r.active).length}</span>
          <span className="overview-label">Rubros activos</span>
        </article>
        <article className="overview-stat">
          <span className="overview-number">{data.rubrics.reduce((sum, r) => sum + (r.items?.length ?? 0), 0)}</span>
          <span className="overview-label">Items puntuables</span>
        </article>
        {data.orphaned.length > 0 && (
          <article className="overview-alert">
            <strong>{data.orphaned.length} criterio(s) pendiente(s) de reasignacion</strong>
            <p>Cada criterio debe vincularse a un item puntuable antes de publicar la configuracion.</p>
            {data.orphaned.map((criterion) => {
              const items = (data.rubrics.find((rubric) => rubric.id === criterion.rubricId)?.items ?? [])
                .filter((item) => item.active !== false);
              return (
                <SaveForm key={criterion.id} onSubmit={(e) => {
                  return reassignCriterion(criterion.id, new FormData(e.currentTarget).get("scoringItemId"));
                }}>
                  <span>{criterion.rubricName}: {criterion.description}</span>
                  <select name="scoringItemId" aria-label={`Item para ${criterion.rubricName}: ${criterion.description}`} required disabled={locked || items.length === 0}>
                    <option value="">Seleccionar item</option>
                    {items.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
                  </select>
                  <button type="submit" aria-label={`Reasignar ${criterion.description}`} disabled={locked || items.length === 0}>Reasignar</button>
                </SaveForm>
              );
            })}
          </article>
        )}
      </div>
    </section>
  );
}

function AdminTroupesSection({ event }) {
  const [troupes, setTroupes] = useState([]);
  const [categories, setCategories] = useState([]);
  const [editing, setEditing] = useState(null);
  const [message, setMessage] = useState("");

  useEffect(() => {
    apiRequest(`/api/v1/events/${event.id}/troupes`).then(setTroupes).catch(() => {});
    apiRequest(`/api/v1/events/${event.id}/categories`).then(setCategories).catch(() => {});
  }, [event.id]);

  const locked = event.status === "OPEN";
  const activeCategories = categories.filter((c) => c.active !== false);

  const save = async (path, body, method = "POST") => {
    try {
      const saved = await apiRequest(path, { method, body: JSON.stringify(body) });
      setTroupes((prev) => {
        if (method === "POST") return [...prev, saved];
        return prev.map((t) => t.id === saved.id ? { ...t, ...saved } : t);
      });
      setMessage("Guardado.");
      setEditing(null);
      return true;
    } catch (e) {
      setMessage(e.code === "CATEGORY_INACTIVE" ? "La categoria seleccionada esta inactiva." : "No se pudo guardar.");
    }
  };

  return (
    <section className="config-section">
      <div className="section-heading">
        <h2>Comparsas</h2>
        <p>Participaciones y tipo de participacion vigente.</p>
      </div>
      <p className="feedback" role="status">{message}</p>
      {!locked && (
        <SaveForm resetOnSuccess className="inline-form" onSubmit={(e) => { const fd = new FormData(e.currentTarget); return save(`/api/v1/events/${event.id}/troupes`, { name: fd.get("name"), categoryId: fd.get("categoryId") }); }}>
          <label>Nombre<input name="name" required /></label>
          <label>Tipo de participacion<select name="categoryId" required><option value="">Seleccionar</option>{activeCategories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
          <button type="submit">Agregar comparsa</button>
        </SaveForm>
      )}
      <div className="records-grid">
        {troupes.map((troupe) => (
          <article className="record" key={troupe.id}>
            {editing === troupe.id ? (
              <SaveForm onSubmit={(e) => { const fd = new FormData(e.currentTarget); return save(`/api/v1/troupes/${troupe.id}`, { name: fd.get("name"), categoryId: fd.get("categoryId"), active: fd.get("active") === "on" }, "PATCH"); }}>
                <label>Nombre<input name="name" defaultValue={troupe.name} required /></label>
                <label>Tipo<select name="categoryId" defaultValue={troupe.categoryId} required>{activeCategories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
                <label className="check"><input name="active" type="checkbox" defaultChecked={troupe.active} /> Activa</label>
                <button type="submit">Guardar</button>
                <button type="button" className="secondary" onClick={() => setEditing(null)}>Cancelar</button>
              </SaveForm>
            ) : (
              <div className="troupe-card-content">
                <strong className="troupe-card-name">{troupe.name}</strong>
                <span className="troupe-card-category">{troupe.categoryName ?? "Sin tipo"}</span>
                <StatusPill status={troupe.active ? "ACTIVE" : "SUSPENDED"} label={troupe.active ? "Activa" : "Inactiva"} />
                {!locked && <button className="secondary" type="button" aria-label={`Editar comparsa ${troupe.name}`} onClick={() => setEditing(troupe.id)}>Editar</button>}
              </div>
            )}
          </article>
        ))}
      </div>
    </section>
  );
}

function AdminCategoriesSection({ event }) {
  const [categories, setCategories] = useState([]);
  const [editing, setEditing] = useState(null);
  const [message, setMessage] = useState("");

  useEffect(() => { apiRequest(`/api/v1/events/${event.id}/categories`).then(setCategories).catch(() => {}); }, [event.id]);
  const locked = event.status === "OPEN";

  const save = async (path, body, method = "POST") => {
    try {
      const saved = await apiRequest(path, { method, body: JSON.stringify(body) });
      setCategories((prev) => method === "POST" ? [...prev, saved] : prev.map((category) => category.id === saved.id ? { ...category, ...saved } : category));
      setMessage("Guardado.");
      setEditing(null);
      return true;
    } catch (e) {
      setMessage(e.code === "RESOURCE_CONFLICT" ? "El codigo ya esta en uso." : "No se pudo guardar.");
    }
  };

  return (
    <section className="config-section">
      <div className="section-heading"><h2>Tipos de participacion</h2><p>Categorias de participacion configurables por evento.</p></div>
      <p className="feedback" role="status">{message}</p>
      {!locked && (
        <SaveForm resetOnSuccess className="inline-form" onSubmit={(e) => { const fd = new FormData(e.currentTarget); return save(`/api/v1/events/${event.id}/categories`, { name: fd.get("name"), displayOrder: Number(fd.get("displayOrder")) }); }}>
          <label>Nombre<input name="name" required /></label>
          <label>Orden<input name="displayOrder" type="number" min="1" defaultValue="1" required /></label>
          <button type="submit">Agregar tipo</button>
        </SaveForm>
      )}
      <div className="records-grid">
        {categories.map((category) => (
          <article className="record" key={category.id}>
            {editing === category.id ? (
              <SaveForm onSubmit={(e) => { const fd = new FormData(e.currentTarget); return save(`/api/v1/categories/${category.id}`, { name: fd.get("name"), displayOrder: Number(fd.get("displayOrder")), active: fd.get("active") === "on" }, "PATCH"); }}>
                <label>Nombre<input name="name" defaultValue={category.name} required /></label>
                <label>Orden<input name="displayOrder" type="number" min="1" defaultValue={category.displayOrder} required /></label>
                <label className="check"><input name="active" type="checkbox" defaultChecked={category.active} /> Activa</label>
                <button type="submit">Guardar</button>
                <button type="button" className="secondary" onClick={() => setEditing(null)}>Cancelar</button>
              </SaveForm>
            ) : (
              <div>
                <strong>{category.name}</strong>
                <span className="mono-text">{category.code}</span>
                <span className={category.active ? "status-active" : "status-inactive"}>{category.active ? "Activa" : "Inactiva"}</span>
                {!locked && <button className="secondary" type="button" aria-label={`Editar tipo ${category.name}`} onClick={() => setEditing(category.id)}>Editar</button>}
              </div>
            )}
          </article>
        ))}
      </div>
    </section>
  );
}

function AdminSpecialtiesSection({ event }) {
  const [specialties, setSpecialties] = useState([]);
  const [editing, setEditing] = useState(null);
  const [message, setMessage] = useState("");

  useEffect(() => { apiRequest(`/api/v1/events/${event.id}/specialties`).then(setSpecialties).catch(() => {}); }, [event.id]);
  const locked = event.status === "OPEN";

  const save = async (path, body, method = "POST") => {
    try {
      const saved = await apiRequest(path, { method, body: JSON.stringify(body) });
      setSpecialties((prev) => method === "POST" ? [...prev, saved] : prev.map((s) => s.id === saved.id ? { ...s, ...saved } : s));
      setMessage("Guardado.");
      setEditing(null);
      return true;
    } catch (e) {
      setMessage(e.code === "RESOURCE_CONFLICT" ? "El codigo o el orden ya esta en uso." : "No se pudo guardar.");
    }
  };

  return (
    <section className="config-section">
      <div className="section-heading"><h2>Especialidades</h2><p>Responsabilidades configurables de los jurados.</p></div>
      <p className="feedback" role="status">{message}</p>
      {!locked && (
        <SaveForm resetOnSuccess className="inline-form" onSubmit={(e) => { const fd = new FormData(e.currentTarget); return save(`/api/v1/events/${event.id}/specialties`, { name: fd.get("name"), displayOrder: Number(fd.get("displayOrder")) }); }}>
          <label>Nombre<input name="name" required /></label>
          <label>Orden<input name="displayOrder" type="number" min="1" defaultValue="1" required /></label>
          <button type="submit">Agregar especialidad</button>
        </SaveForm>
      )}
      <div className="records-grid">
        {specialties.map((spec) => (
          <article className="record" key={spec.id}>
            {editing === spec.id ? (
              <SaveForm onSubmit={(e) => { const fd = new FormData(e.currentTarget); return save(`/api/v1/specialties/${spec.id}`, { name: fd.get("name"), displayOrder: Number(fd.get("displayOrder")), active: fd.get("active") === "on" }, "PATCH"); }}>
                <label>Nombre<input name="name" defaultValue={spec.name} required /></label>
                <label>Orden<input name="displayOrder" type="number" min="1" defaultValue={spec.displayOrder} required /></label>
                <label className="check"><input name="active" type="checkbox" defaultChecked={spec.active} /> Activa</label>
                <button type="submit">Guardar</button>
                <button type="button" className="secondary" onClick={() => setEditing(null)}>Cancelar</button>
              </SaveForm>
            ) : (
              <div>
                <strong>{spec.name}</strong>
                <span className="mono-text">{spec.code}</span>
                <span className={spec.active ? "status-active" : "status-inactive"}>{spec.active ? "Activa" : "Inactiva"}</span>
                {!locked && <button className="secondary" type="button" aria-label={`Editar especialidad ${spec.name}`} onClick={() => setEditing(spec.id)}>Editar</button>}
              </div>
            )}
          </article>
        ))}
      </div>
    </section>
  );
}

function AdminRubricsSection({ event }) {
  const [rubrics, setRubrics] = useState([]);
  const [specialties, setSpecialties] = useState([]);
  const [expanded, setExpanded] = useState(null);
  const [editingItem, setEditingItem] = useState(null);
  const [editingCriterion, setEditingCriterion] = useState(null);
  const [message, setMessage] = useState("");
  const { writing, setPending } = useContext(WriteContext);

  useEffect(() => {
    apiRequest(`/api/v1/events/${event.id}/rubrics`).then(setRubrics).catch(() => {});
    apiRequest(`/api/v1/events/${event.id}/specialties`).then(setSpecialties).catch(() => {});
  }, [event.id]);

  const locked = event.status === "OPEN";
  const activeSpecialties = specialties.filter((s) => s.active !== false);

  const RUBRIC_TYPES = [
    { value: "NOMINATIVE", label: "Nominativo" },
    { value: "RANDOM", label: "Aleatorio" },
    { value: "GENERAL", label: "General" },
    { value: "CALCULATED", label: "Calculado" },
    { value: "SPECIAL", label: "Especial" },
  ];
  const RESOLUTION_METHODS = [
    { value: "JURY", label: "Jurado" },
    { value: "COMMITTEE", label: "Comision Organizadora" },
    { value: "AUTOMATIC", label: "Resultado automatico" },
    { value: "ADMINISTRATIVE", label: "Carga administrativa" },
  ];
  const SUBJECT_TYPES = [
    { value: "PERSON", label: "Persona" },
    { value: "COUPLE", label: "Pareja" },
    { value: "GROUP", label: "Grupo" },
    { value: "FIGURE", label: "Figura" },
    { value: "ELEMENT", label: "Elemento" },
    { value: "OTHER", label: "Otro" },
  ];

  const saveRubric = async (path, body, method = "POST") => {
    try {
      const saved = await apiRequest(path, { method, body: JSON.stringify(body) });
      setRubrics((prev) => method === "POST" ? [...prev, { ...saved, items: [], criteria: [], specialties: [] }] : prev.map((r) => r.id === saved.id ? { ...r, ...saved } : r));
      setMessage("Rubro guardado.");
      return true;
    } catch (e) {
      setMessage(e.code === "RESOURCE_CONFLICT" ? "El codigo ya esta en uso." : "No se pudo guardar.");
    }
  };

  const saveItem = async (rubricId, body, method = "POST", itemId = null) => {
    try {
      const path = method === "PATCH" ? `/api/v1/evaluation-items/${itemId}` : `/api/v1/rubrics/${rubricId}/items`;
      const saved = await apiRequest(path, { method, body: JSON.stringify(body) });
      setRubrics((prev) => prev.map((r) => {
        if (r.id !== rubricId) return r;
        if (method === "POST") return { ...r, items: [...(r.items ?? []), saved] };
        return { ...r, items: (r.items ?? []).map((i) => i.id === saved.id ? { ...i, ...saved } : i) };
      }));
      setMessage("Item guardado.");
      setEditingItem(null);
      return true;
    } catch (e) {
      setMessage(e.code === "SPECIALTY_INACTIVE" ? "La especialidad seleccionada esta inactiva." : "No se pudo guardar.");
    }
  };

  const saveCriterion = async (rubricId, body, method = "POST", criterionId = null) => {
    try {
      const path = method === "PATCH" ? `/api/v1/rubric-criteria/${criterionId}` : `/api/v1/rubrics/${rubricId}/criteria`;
      const saved = await apiRequest(path, { method, body: JSON.stringify(body) });
      setRubrics((prev) => prev.map((r) => {
        if (r.id !== rubricId) return r;
        if (method === "POST") return { ...r, criteria: [...(r.criteria ?? []), saved] };
        return { ...r, criteria: (r.criteria ?? []).map((c) => c.id === saved.id ? { ...c, ...saved } : c) };
      }));
      setMessage("Criterio guardado.");
      setEditingCriterion(null);
      return true;
    } catch (e) {
      setMessage(e.code === "EVALUATION_ITEM_NOT_FOUND" ? "El item seleccionado no es valido." : "No se pudo guardar.");
    }
  };

  const reorder = async (rubricId, collection, current, neighbor, direction) => {
    if (writing.current || locked || !neighbor) return;
    writing.current = true;
    setPending(true);
    try {
      const resource = collection === "items" ? "evaluation-items" : "rubric-criteria";
      const { changes } = await apiRequest(`/api/v1/${resource}/${current.id}/reorder`, {
        method: "POST",
        body: JSON.stringify({ direction, neighborId: neighbor.id, expectedOrder: current.displayOrder, expectedNeighborOrder: neighbor.displayOrder }),
      });
      setRubrics((previous) => previous.map((rubric) => rubric.id !== rubricId ? rubric : {
        ...rubric,
        [collection]: rubric[collection].map((entry) => ({ ...entry, ...changes.find((change) => change.id === entry.id) })),
      }));
      setMessage("Orden actualizado.");
    } catch (error) {
      if (["ORDER_CONFLICT", "ORDER_BOUNDARY", "CRITERION_REASSIGNMENT_REQUIRED"].includes(error.code)) {
        try {
          const fresh = await apiRequest(`/api/v1/rubrics/${rubricId}`);
          setRubrics((previous) => previous.map((rubric) => rubric.id === rubricId ? fresh : rubric));
          // Remount uncontrolled edit fields from the refreshed data on expansion.
          setExpanded(null);
          setMessage("La configuracion cambio. Recargamos el rubro; volve a expandirlo para revisar antes de editar.");
        } catch {
          setMessage("No se pudo actualizar la configuracion. Recarga antes de reintentar el orden.");
        }
      } else {
        setMessage(error.code === "EVENT_LOCKED" ? "El evento ya no permite modificar su configuracion." : "No se pudo cambiar el orden. Verifica la configuracion antes de reintentar.");
      }
    } finally {
      writing.current = false;
      setPending(false);
    }
  };

  return (
    <section className="config-section">
      <div className="section-heading"><h2>Rubros y planillas</h2><p>Constructor jerarquico: rubro, items puntuables y criterios descriptivos.</p></div>
      <p className="feedback" role="status">{message}</p>

      <p id="resolution-metadata">El metodo de resolucion es metadata futura: no ejecuta formulas ni decisiones automaticas o de Comision Organizadora.</p>
      <p id="item-metadata">Obligatorio (required) y Permite No presentado (allowNotPresented) son metadata futura: todos los items generados deben resolverse y admiten No se presento (NOT_PRESENTED). Los pendientes bloquean confirmacion y cierre, sin importar estas opciones.</p>
      <p id="subject-type-help">El tipo de sujeto solo aplica al objetivo Nominacion; para Comparsa se guarda sin tipo de sujeto.</p>
      {!locked && (
        <SaveForm resetOnSuccess className="config-card" onSubmit={(e) => { const fd = new FormData(e.currentTarget); return saveRubric(`/api/v1/events/${event.id}/rubrics`, { name: fd.get("name"), evaluationTarget: fd.get("evaluationTarget"), rubricType: fd.get("rubricType"), resolutionMethod: fd.get("resolutionMethod"), evaluationObjective: fd.get("evaluationObjective") || null, expectedSubjectType: fd.get("evaluationTarget") === "NOMINATION" ? fd.get("expectedSubjectType") : null }); }}>
          <h3>Nuevo rubro</h3>
          <label>Nombre<input name="name" required /></label>
          <label>Objetivo evaluado<select name="evaluationTarget"><option value="TROUPE">Comparsa</option><option value="NOMINATION">Nominacion</option></select></label>
          <label>Tipo de sujeto<select name="expectedSubjectType" aria-describedby="subject-type-help">{SUBJECT_TYPES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}</select></label>
          <label>Tipo de rubro<select name="rubricType">{RUBRIC_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}</select></label>
          <label>Metodo de resolucion<select name="resolutionMethod" aria-describedby="resolution-metadata">{RESOLUTION_METHODS.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}</select></label>
          <label>Objetivo evaluado (texto)<input name="evaluationObjective" placeholder="Ej: Figura / participante" /></label>
          <button type="submit">Crear rubro</button>
        </SaveForm>
      )}

      <div className="rubric-list">
        {rubrics.map((rubric) => {
          const orderedItems = [...(rubric.items ?? [])].sort((a, b) => a.displayOrder - b.displayOrder);
          const derived = activeSpecialties.filter((s) => (rubric.items ?? []).some((i) => i.active !== false && i.specialtyId === s.id));
          const isExpanded = expanded === rubric.id;
          const rubricTypeLabel = RUBRIC_TYPES.find((t) => t.value === rubric.rubricType)?.label ?? rubric.rubricType;
          const resolutionLabel = RESOLUTION_METHODS.find((m) => m.value === rubric.resolutionMethod)?.label ?? rubric.resolutionMethod;
          return (
            <article className="rubric-card" key={rubric.id}>
              <div className="rubric-card-header">
                <div>
                  <h3>{rubric.name}</h3>
                  <span className="rubric-meta">{rubricTypeLabel} &middot; {resolutionLabel}</span>
                  {rubric.evaluationObjective && <span className="rubric-meta">{rubric.evaluationObjective}</span>}
                  <span className="rubric-meta">{derived.map((s) => s.name).join(", ") || "Sin items activos"}</span>
                </div>
                <button className="secondary" type="button" aria-label={`${isExpanded ? "Contraer" : "Expandir"} ${rubric.name}`} aria-expanded={isExpanded} onClick={() => setExpanded(isExpanded ? null : rubric.id)}>
                  {isExpanded ? "Contraer" : "Expandir"}
                </button>
              </div>

              {isExpanded && (
                <div className="rubric-expanded">
                  {!locked && (
                    <SaveForm className="rubric-edit-form" onSubmit={(e) => { const fd = new FormData(e.currentTarget); return saveRubric(`/api/v1/rubrics/${rubric.id}`, { name: fd.get("name"), evaluationTarget: fd.get("evaluationTarget"), expectedSubjectType: fd.get("evaluationTarget") === "NOMINATION" ? fd.get("expectedSubjectType") : null, rubricType: fd.get("rubricType"), resolutionMethod: fd.get("resolutionMethod"), evaluationObjective: fd.get("evaluationObjective") || null, active: fd.get("active") === "on" }, "PATCH"); }}>
                      <label>Nombre<input name="name" defaultValue={rubric.name} required /></label>
                      <label>Objetivo<select name="evaluationTarget" defaultValue={rubric.evaluationTarget}><option value="TROUPE">Comparsa</option><option value="NOMINATION">Nominacion</option></select></label>
                      <label>Tipo de sujeto<select name="expectedSubjectType" defaultValue={rubric.expectedSubjectType ?? "PERSON"} aria-describedby="subject-type-help">{SUBJECT_TYPES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}</select></label>
                      <label>Tipo<select name="rubricType" defaultValue={rubric.rubricType}>{RUBRIC_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}</select></label>
                      <label>Resolucion<select name="resolutionMethod" defaultValue={rubric.resolutionMethod} aria-describedby="resolution-metadata">{RESOLUTION_METHODS.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}</select></label>
                      <label>Objetivo (texto)<input name="evaluationObjective" defaultValue={rubric.evaluationObjective ?? ""} /></label>
                      <label className="check"><input name="active" type="checkbox" defaultChecked={rubric.active} /> Activo</label>
                      <button type="submit">Guardar rubro</button>
                    </SaveForm>
                  )}

                  <h4>Items puntuables</h4>
                  {orderedItems.map((item, itemIndex) => (
                    <article className="subrecord" key={item.id}>
                      {editingItem === item.id ? (
                        <SaveForm onSubmit={(e) => { const fd = new FormData(e.currentTarget); return saveItem(rubric.id, { name: fd.get("name"), specialtyId: fd.get("specialtyId"), displayOrder: Number(fd.get("displayOrder")), required: fd.get("required") === "on", allowNotPresented: fd.get("allowNotPresented") === "on", active: fd.get("active") === "on" }, "PATCH", item.id); }}>
                          <label>Nombre<input name="name" defaultValue={item.name} required /></label>
                          <label>Especialidad<select name="specialtyId" defaultValue={item.specialtyId}>{activeSpecialties.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select></label>
                          <label>Orden<input name="displayOrder" type="number" min="1" defaultValue={item.displayOrder} required /></label>
                          <label className="check"><input name="required" type="checkbox" defaultChecked={item.required} aria-describedby="item-metadata" /> Obligatorio</label>
                          <label className="check"><input name="allowNotPresented" type="checkbox" defaultChecked={item.allowNotPresented} aria-describedby="item-metadata" /> Permite No presentado</label>
                          <label className="check"><input name="active" type="checkbox" defaultChecked={item.active} /> Activo</label>
                          <button type="submit">Guardar item</button>
                          <button type="button" className="secondary" onClick={() => setEditingItem(null)}>Cancelar</button>
                        </SaveForm>
                      ) : (
                        <div className="subrecord-summary">
                          <strong>{item.name}</strong>
                          <span>{item.specialtyName}</span>
                          <span className="mono-text">Orden: {item.displayOrder}</span>
                          {!locked && <button className="secondary" type="button" aria-label={`Editar item ${item.name}`} onClick={() => setEditingItem(item.id)}>Editar</button>}
                          {!locked && <>
                            <button className="secondary" type="button" aria-label={`Subir item ${item.name}`} disabled={itemIndex === 0 || !!editingItem || !!editingCriterion} onClick={() => reorder(rubric.id, "items", item, orderedItems[itemIndex - 1], "UP")}>Subir</button>
                            <button className="secondary" type="button" aria-label={`Bajar item ${item.name}`} disabled={itemIndex === orderedItems.length - 1 || !!editingItem || !!editingCriterion} onClick={() => reorder(rubric.id, "items", item, orderedItems[itemIndex + 1], "DOWN")}>Bajar</button>
                          </>}
                        </div>
                      )}
                      <div className="criterion-list">
                        {(rubric.criteria ?? []).filter((c) => c.scoringItemId === item.id).sort((a, b) => a.displayOrder - b.displayOrder).map((crit, criterionIndex, siblings) => (
                          <article className="subrecord criterion" key={crit.id}>
                            {editingCriterion === crit.id ? (
                              <SaveForm onSubmit={(e) => { const fd = new FormData(e.currentTarget); return saveCriterion(rubric.id, { scoringItemId: fd.get("scoringItemId"), description: fd.get("description"), displayOrder: Number(fd.get("displayOrder")), active: fd.get("active") === "on" }, "PATCH", crit.id); }}>
                                <label>Descripcion<textarea name="description" defaultValue={crit.description} required /></label>
                                <label>Item<select name="scoringItemId" defaultValue={crit.scoringItemId} required>{(rubric.items ?? []).map((candidate) => <option key={candidate.id} value={candidate.id}>{candidate.name}</option>)}</select></label>
                                <label>Orden<input name="displayOrder" type="number" min="1" defaultValue={crit.displayOrder} required /></label>
                                <label className="check"><input name="active" type="checkbox" defaultChecked={crit.active} /> Activo</label>
                                <button type="submit" aria-label={`Guardar criterio ${crit.description}`}>Guardar</button>
                                <button type="button" className="secondary" aria-label={`Cancelar edicion de criterio ${crit.description}`} onClick={() => setEditingCriterion(null)}>Cancelar</button>
                              </SaveForm>
                            ) : (
                              <div className="subrecord-summary">
                                <span>{crit.description}</span>
                                <span className="mono-text">#{crit.displayOrder}</span>
                                {!locked && <button className="secondary" type="button" aria-label={`Editar criterio ${crit.description}`} onClick={() => setEditingCriterion(crit.id)}>Editar</button>}
                                {!locked && <>
                                  <button className="secondary" type="button" aria-label={`Subir criterio ${crit.description}`} disabled={criterionIndex === 0 || !!editingItem || !!editingCriterion} onClick={() => reorder(rubric.id, "criteria", crit, siblings[criterionIndex - 1], "UP")}>Subir</button>
                                  <button className="secondary" type="button" aria-label={`Bajar criterio ${crit.description}`} disabled={criterionIndex === siblings.length - 1 || !!editingItem || !!editingCriterion} onClick={() => reorder(rubric.id, "criteria", crit, siblings[criterionIndex + 1], "DOWN")}>Bajar</button>
                                </>}
                              </div>
                            )}
                          </article>
                        ))}
                        {!locked && (
                          <SaveForm resetOnSuccess className="inline-criterion-form" onSubmit={(e) => { const fd = new FormData(e.currentTarget); return saveCriterion(rubric.id, { scoringItemId: item.id, description: fd.get("description"), displayOrder: Number(fd.get("displayOrder")) }); }}>
                            <input name="description" aria-label={`Nuevo criterio para ${item.name}`} placeholder="Nuevo criterio" required />
                            <input name="displayOrder" aria-label={`Orden del nuevo criterio para ${item.name}`} type="number" min="1" defaultValue="1" required className="input-order" />
                            <button type="submit" aria-label={`Agregar criterio a ${item.name}`}>+</button>
                          </SaveForm>
                        )}
                      </div>
                    </article>
                  ))}

                  {!locked && (
                    <SaveForm resetOnSuccess className="inline-item-form" onSubmit={(e) => { const fd = new FormData(e.currentTarget); return saveItem(rubric.id, { name: fd.get("name"), specialtyId: fd.get("specialtyId"), required: fd.get("required") === "on", allowNotPresented: fd.get("allowNotPresented") === "on" }); }}>
                      <input name="name" aria-label={`Nuevo item puntuable para ${rubric.name}`} placeholder="Nuevo item puntuable" required />
                      <select name="specialtyId" aria-label={`Especialidad del nuevo item para ${rubric.name}`} required><option value="">Especialidad</option>{activeSpecialties.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select>
                      <label className="check"><input name="required" type="checkbox" defaultChecked aria-describedby="item-metadata" /> Obligatorio</label>
                      <label className="check"><input name="allowNotPresented" type="checkbox" defaultChecked aria-describedby="item-metadata" /> Permite No presentado</label>
                      <button type="submit" aria-label={`Agregar item a ${rubric.name}`}>Agregar item</button>
                    </SaveForm>
                  )}
                </div>
              )}
            </article>
          );
        })}
      </div>
    </section>
  );
}

function MatrizPlanillasSection({ event }) {
  const [rubrics, setRubrics] = useState([]);
  const [specialties, setSpecialties] = useState([]);
  const [selected, setSelected] = useState(null);

  useEffect(() => {
    apiRequest(`/api/v1/events/${event.id}/rubrics`).then(setRubrics).catch(() => {});
    apiRequest(`/api/v1/events/${event.id}/specialties`).then(setSpecialties).catch(() => {});
  }, [event.id]);

  const activeSpecialties = specialties.filter((s) => s.active !== false);
  const activeRubrics = rubrics.filter((r) => r.active !== false);

  return (
    <section className="config-section">
      <div className="section-heading"><h2>Matriz de planillas</h2><p>Rubros por especialidad. Se genera automaticamente desde la configuracion.</p></div>
      <div className="matrix-wrapper">
        <table className="matrix-table">
          <thead>
            <tr>
              <th>Rubro</th>
              {activeSpecialties.map((s) => <th key={s.id}>{s.name}</th>)}
            </tr>
          </thead>
          <tbody>
            {activeRubrics.map((r) => (
              <tr key={r.id}>
                <td>
                  <button className="matrix-rubric-btn" type="button" onClick={() => setSelected(selected === r.id ? null : r.id)}>
                    {r.name}
                  </button>
                </td>
                {activeSpecialties.map((s) => {
                  const hasItem = (r.items ?? []).some((i) => i.active !== false && i.specialtyId === s.id);
                  return <td key={s.id} className={hasItem ? "matrix-yes" : "matrix-no"}>{hasItem ? "\u2713" : "\u2014"}</td>;
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {selected && (
        <div className="matrix-detail">
          <h3>{activeRubrics.find((r) => r.id === selected)?.name}</h3>
          <p>Items y criterios de este rubro:</p>
          {(activeRubrics.find((r) => r.id === selected)?.items ?? []).map((item) => (
            <article className="matrix-detail-item" key={item.id}>
              <strong>{item.name}</strong>
              <span>{item.specialtyName}</span>
              <ul>
                {(activeRubrics.find((r) => r.id === selected)?.criteria ?? []).filter((c) => c.scoringItemId === item.id).map((c) => (
                  <li key={c.id}>{c.description}</li>
                ))}
              </ul>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
