import { createContext, useContext, useEffect, useRef, useState } from "react";
import { PageShell } from "../components/PageShell.jsx";
import { apiRequest } from "../api/http.js";
import { StatusPill } from "../components/StatusPill.jsx";
import { EntityDrawer } from "../components/EntityDrawer.jsx";
import { Dialog } from "../components/Dialog.jsx";
import { DialogFooter } from "../components/DialogFooter.jsx";
import { Button } from "../components/Button.jsx";
import { ProgressBar } from "../components/ProgressBar.jsx";
import { TroupeForm } from "../features/TroupeForm.jsx";
import { CatalogForm } from "../features/CatalogForm.jsx";
import { RubricTree } from "../features/RubricTree.jsx";

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
  const [step, setStep] = useState("participantes");
  const [pending, setPending] = useState(false);
  const [focusRubricId, setFocusRubricId] = useState(null);
  const [progress, setProgress] = useState(null);
  const writing = useRef(false);

  // Conteo liviano para el progreso del asistente (solo lectura; el detalle
  // y las mutaciones siguen en cada sección). Guía sin bloquear (T05 intacta).
  useEffect(() => {
    let active = true;
    Promise.all([
      apiRequest(`/api/v1/events/${event.id}/troupes`).catch(() => []),
      apiRequest(`/api/v1/events/${event.id}/categories`).catch(() => []),
      apiRequest(`/api/v1/events/${event.id}/specialties`).catch(() => []),
      apiRequest(`/api/v1/events/${event.id}/rubrics`).catch(() => []),
      apiRequest(`/api/v1/events/${event.id}/orphaned-criteria`).catch(() => []),
    ]).then(([troupes, categories, specialties, rubrics, orphaned]) => {
      if (active) setProgress({ troupes, categories, specialties, rubrics, orphaned });
    });
    return () => { active = false; };
  }, [event.id]);

  const troupesActive = (progress?.troupes ?? []).filter((t) => t.active !== false);
  const categoriesActive = (progress?.categories ?? []).filter((c) => c.active !== false);
  const specialtiesActive = (progress?.specialties ?? []).filter((s) => s.active !== false);
  const rubricsActive = (progress?.rubrics ?? []).filter((r) => r.active !== false);
  const rubricsComplete = rubricsActive.filter((r) => (r.items ?? []).some((i) => i.active !== false));
  const uncoveredSpecialties = specialtiesActive.filter(
    (s) => !rubricsActive.some((r) => (r.items ?? []).some((i) => i.active !== false && i.specialtyId === s.id)),
  );
  const orphanedCount = (progress?.orphaned ?? []).length;

  const stepCompletion = {
    participantes: categoriesActive.length > 0 && troupesActive.length > 0,
    jurados: specialtiesActive.length > 0,
    rubros: rubricsActive.length > 0 && rubricsComplete.length === rubricsActive.length,
    revision: false,
  };
  stepCompletion.revision = stepCompletion.participantes && stepCompletion.jurados && stepCompletion.rubros
    && uncoveredSpecialties.length === 0 && orphanedCount === 0;
  const stepAttention = {
    participantes: !stepCompletion.participantes && (categoriesActive.length > 0 || troupesActive.length > 0),
    jurados: false,
    rubros: !stepCompletion.rubros && rubricsActive.length > 0,
    revision: !stepCompletion.revision && (stepCompletion.participantes || stepCompletion.jurados || stepCompletion.rubros || orphanedCount > 0),
  };

  const steps = [
    { key: "participantes", label: "Participantes", detail: "Tipos, comparsas y orden de pasada" },
    { key: "jurados", label: "Jurados y especialidades", detail: "Especialidades por jurado" },
    { key: "rubros", label: "Rubros, ítems y criterios", detail: "Qué se puntúa" },
    { key: "revision", label: "Revisión final", detail: "Resumen y pendientes" },
  ];
  const stepStateLabels = {
    done: "Completo",
    current: "Paso actual",
    pending: "Pendiente",
    attention: "Requiere atención",
  };
  const stepState = (key) => {
    if (!progress) return "pending";
    if (stepCompletion[key]) return "done";
    if (step === key) return "current";
    return stepAttention[key] ? "attention" : "pending";
  };
  const doneCount = steps.filter((item) => stepCompletion[item.key]).length;
  const pct = Math.round((doneCount / steps.length) * 100);
  const activeIndex = Math.max(0, steps.findIndex((item) => item.key === step));

  // Accesibilidad: al cambiar de paso, el foco va al título del paso (no en el montaje inicial).
  const stepTitleRef = useRef(null);
  const firstRenderRef = useRef(true);
  useEffect(() => {
    if (firstRenderRef.current) { firstRenderRef.current = false; return; }
    stepTitleRef.current?.focus();
  }, [step]);

  const goStep = (key) => {
    setStep(key);
  };

  const pendingRubrics = rubricsActive.length - rubricsComplete.length;
  const revisionPendings = (uncoveredSpecialties.length > 0 ? uncoveredSpecialties.length : 0)
    + (orphanedCount > 0 ? 1 : 0)
    + (pendingRubrics > 0 ? pendingRubrics : 0);
  const summaryByStep = {
    participantes: !progress
      ? "Cargando el resumen del paso…"
      : categoriesActive.length === 0
        ? "Todavía no hay tipos de participación: creá al menos uno para poder dar de alta comparsas."
        : troupesActive.length === 0
          ? `Tenés ${categoriesActive.length} tipo(s) cargados y ninguna comparsa: agregá la primera comparsa.`
          : `Tenés ${troupesActive.length} comparsa(s) activa(s) en ${categoriesActive.length} tipo(s): programá el orden de pasada en el último bloque.`,
    jurados: !progress
      ? "Cargando el resumen del paso…"
      : specialtiesActive.length === 0
        ? "Todavía no hay especialidades: creá al menos una, porque cada ítem del paso 3 pertenece a una especialidad activa."
        : `Tenés ${specialtiesActive.length} especialidad(es) activa(s): los jurados que evalúan cada una se asignan en la pantalla de Jurados.`,
    rubros: !progress
      ? "Cargando el resumen del paso…"
      : rubricsActive.length === 0
        ? "Todavía no hay rubros: creá el primero y agregale ítems con su especialidad."
        : pendingRubrics > 0
          ? `${pendingRubrics} rubro(s) sin ítems puntuables: expandilos para completar la carga.`
          : uncoveredSpecialties.length > 0
            ? `La especialidad ${uncoveredSpecialties[0].name} todavía no evalúa ningún rubro: agregá un ítem con esa especialidad.`
            : "Todos los rubros tienen ítems puntuables: revisá la matriz en el paso final.",
    revision: !progress
      ? "Cargando el resumen del paso…"
      : stepCompletion.revision
        ? "Sin pendientes: la configuración está completa y lista para abrir la votación."
        : `Te faltan ${revisionPendings} punto(s) por resolver antes de abrir la votación: revisá el resumen y la matriz.`,
  };

  return (
    <WriteContext.Provider value={{ writing, setPending }}>
      <PageShell layer="instrument" className="admin-shell" aria-busy={pending}>
        <fieldset aria-label="Configuracion de competencia" disabled={pending} className="fieldset-reset">
          <header className="event-header competencia-header">
            <div>
              <p className="eyebrow">Competencia</p>
              <h1>{event.name ?? "Evento"}</h1>
              <p className="competencia-step-meta">Paso {activeIndex + 1} de {steps.length} · {pct}% completado</p>
            </div>
            <div className="event-actions">
              {onBack && <button className="secondary" type="button" onClick={onBack}>Volver</button>}
            </div>
          </header>
          <nav className="competencia-nav competencia-stepper" aria-label="Pasos de configuración de competencia">
            <ol>
              {steps.map((item, index) => {
                const state = stepState(item.key);
                const isCurrent = step === item.key;
                return (
                  <li key={item.key}>
                    <button
                      type="button"
                      className={isCurrent ? "active" : "secondary"}
                      aria-current={isCurrent ? "step" : undefined}
                      aria-label={`Paso ${index + 1} de ${steps.length}: ${item.label}. ${stepStateLabels[state]}.`}
                      onClick={() => goStep(item.key)}
                    >
                      <span className="competencia-step-badge" aria-hidden="true">
                        {state === "done" ? "✓" : index + 1}
                      </span>
                      <span className="competencia-step-copy">
                        <span className="competencia-step-label">{item.label}</span>
                        <span className="competencia-step-state">{stepStateLabels[state]}</span>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ol>
          </nav>
          <ProgressBar value={doneCount} max={steps.length} label="Progreso de configuración" sublabel={`${doneCount} de ${steps.length} pasos completados`} className="competencia-progress" />
          {step === "participantes" && (
            <section aria-labelledby="competencia-step-title">
              <h2 id="competencia-step-title" ref={stepTitleRef} tabIndex={-1}>Participantes</h2>
              <p className="step-intro">Cargá quiénes participan: primero los tipos, después las comparsas y por último el orden de pasada de cada jornada.</p>
              <StepSummary stepLabel="Participantes" recommendation={summaryByStep.participantes} />
              <section className="competencia-subblock" aria-label="Bloque 1 de 3: Tipos de participación">
                <AdminCategoriesSection key={`categories-${event.id}`} event={event} />
              </section>
              <section className="competencia-subblock" aria-label="Bloque 2 de 3: Comparsas">
                <AdminTroupesSection key={`troupes-${event.id}`} event={event} />
              </section>
              <section className="competencia-subblock" aria-label="Bloque 3 de 3: Orden de pasada por jornada">
                <TroupeScheduleSection key={`schedule-${event.id}`} event={event} />
              </section>
            </section>
          )}
          {step === "jurados" && (
            <section aria-labelledby="competencia-step-title">
              <h2 id="competencia-step-title" ref={stepTitleRef} tabIndex={-1}>Jurados y especialidades</h2>
              <p className="step-intro">Definí las especialidades que evalúan: cada ítem del paso 3 pertenece a una especialidad activa. Los jurados se asignan en <a href="#/admin/judges">Jurados</a>.</p>
              <StepSummary stepLabel="Jurados y especialidades" recommendation={summaryByStep.jurados} />
              <AdminSpecialtiesSection key={`specialties-${event.id}`} event={event} />
            </section>
          )}
          {step === "rubros" && (
            <section aria-labelledby="competencia-step-title">
              <h2 id="competencia-step-title" ref={stepTitleRef} tabIndex={-1}>Rubros, ítems y criterios</h2>
              <p className="step-intro">Creá cada rubro con sus ítems y criterios: al crearlo se abre solo para seguir cargando.</p>
              <StepSummary stepLabel="Rubros, ítems y criterios" recommendation={summaryByStep.rubros} />
              <AdminRubricsSection key={`rubrics-${event.id}`} event={event} focusRubricId={focusRubricId} />
            </section>
          )}
          {step === "revision" && (
            <section aria-labelledby="competencia-step-title">
              <h2 id="competencia-step-title" ref={stepTitleRef} tabIndex={-1}>Revisión final</h2>
              <p className="step-intro">Verificá que no falte nada: el resumen, la matriz y los pendientes se generan solos desde lo cargado.</p>
              <StepSummary stepLabel="Revisión final" recommendation={summaryByStep.revision} />
              <CompetenciaOverview key={event.id} event={event} onGoStep={goStep} />
              <MatrizPlanillasSection key={`matrix-${event.id}`} event={event} onResolveRubric={(rubricId) => { setFocusRubricId(rubricId); goStep("rubros"); }} />
            </section>
          )}
        </fieldset>
      </PageShell>
    </WriteContext.Provider>
  );
}

function StepSummary({ stepLabel, recommendation }) {
  if (!recommendation) return null;
  return (
    <section className="competencia-step-summary" aria-label={`Resumen del paso ${stepLabel}`}>
      <h3>Resumen del paso</h3>
      <p role="status">{recommendation}</p>
    </section>
  );
}

function CompetenciaOverview({ event, onGoStep }) {
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
          {onGoStep && <button type="button" className="link" onClick={() => onGoStep("participantes")}>Ir al paso 1 →</button>}
        </article>
        <article className="overview-stat">
          <span className="overview-number">{data.specialties.filter((s) => s.active).length}</span>
          <span className="overview-label">Especialidades activas</span>
          {onGoStep && <button type="button" className="link" onClick={() => onGoStep("jurados")}>Ir al paso 2 →</button>}
        </article>
        <article className="overview-stat">
          <span className="overview-number">{data.rubrics.filter((r) => r.active).length}</span>
          <span className="overview-label">Rubros activos</span>
          {onGoStep && <button type="button" className="link" onClick={() => onGoStep("rubros")}>Ir al paso 3 →</button>}
        </article>
        <article className="overview-stat">
          <span className="overview-number">{data.rubrics.reduce((sum, r) => sum + (r.items?.length ?? 0), 0)}</span>
          <span className="overview-label">Items puntuables</span>
        </article>
        {data.orphaned.length > 0 && (
          <article className="overview-alert">
            <strong>{data.orphaned.length} criterio(s) pendiente(s) de asignar</strong>
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
  const [drawerMode, setDrawerMode] = useState(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("active");
  const [deleteTarget, setDeleteTarget] = useState(null);
  const drawerTriggerRef = useRef(null);
  const deleteTriggerRef = useRef(null);
  const { writing, setPending } = useContext(WriteContext);

  useEffect(() => {
    apiRequest(`/api/v1/events/${event.id}/troupes`).then(setTroupes).catch(() => {});
    apiRequest(`/api/v1/events/${event.id}/categories`).then(setCategories).catch(() => {});
  }, [event.id]);

  const locked = event.status === "OPEN";
  const activeCategories = categories.filter((c) => c.active !== false);

  const save = async (path, body, method = "POST") => {
    try {
      const saved = await apiRequest(path, { method, body: JSON.stringify(body) });
      const fresh = await apiRequest(`/api/v1/events/${event.id}/troupes`).catch(() => null);
      if (fresh) setTroupes(fresh);
      else setTroupes((prev) => {
        if (method === "POST") return [...prev, saved];
        return prev.map((t) => t.id === saved.id ? { ...t, ...saved } : t);
      });
      setMessage("Guardado.");
      setDrawerMode(null);
      return true;
    } catch (e) {
      if (e.code === "CATEGORY_INACTIVE") setMessage("La categoria seleccionada esta inactiva.");
      else if (e.code === "VALIDATION_ERROR") setMessage("Revisa los campos: el nombre y el tipo son obligatorios y el color debe tener formato #RRGGBB.");
      else if (e.code === "EVENT_LOCKED") setMessage("El evento ya no permite modificar su configuracion.");
      else setMessage("No se pudo guardar.");
      return false;
    }
  };

  const submitTroupe = async (body) => {
    if (writing.current) return;
    writing.current = true;
    setPending(true);
    setSaving(true);
    try {
      if (drawerMode?.mode === "edit") {
        await save(`/api/v1/troupes/${drawerMode.troupeId}`, body, "PATCH");
      } else {
        await save(`/api/v1/events/${event.id}/troupes`, body);
      }
    } finally {
      writing.current = false;
      setPending(false);
      setSaving(false);
    }
  };

  const confirmDeleteTroupe = async () => {
    const target = deleteTarget;
    setDeleteTarget(null);
    if (!target || writing.current) return;
    writing.current = true;
    setPending(true);
    try {
      await apiRequest(`/api/v1/troupes/${target.id}`, { method: "PATCH", body: JSON.stringify({ active: false }) });
      const fresh = await apiRequest(`/api/v1/events/${event.id}/troupes`).catch(() => null);
      if (fresh) setTroupes(fresh);
      else setTroupes((prev) => prev.map((t) => t.id === target.id ? { ...t, active: false } : t));
      setMessage(`Comparsa ${target.name} eliminada (desactivada en BD).`);
    } catch {
      setMessage("No se pudo eliminar la comparsa.");
    } finally {
      writing.current = false;
      setPending(false);
    }
  };

  const reactivateTroupe = async (troupe) => {
    if (writing.current) return;
    writing.current = true;
    setPending(true);
    try {
      await apiRequest(`/api/v1/troupes/${troupe.id}`, { method: "PATCH", body: JSON.stringify({ active: true }) });
      const fresh = await apiRequest(`/api/v1/events/${event.id}/troupes`).catch(() => null);
      if (fresh) setTroupes(fresh);
      else setTroupes((prev) => prev.map((t) => t.id === troupe.id ? { ...t, active: true } : t));
      setMessage(`Comparsa ${troupe.name} reactivada.`);
    } catch (e) {
      setMessage(e.code === "CATEGORY_INACTIVE" ? "No se puede reactivar: la categoria esta inactiva." : "No se pudo reactivar la comparsa.");
    } finally {
      writing.current = false;
      setPending(false);
    }
  };

  const filtered = troupes.filter((troupe) => {
    if (statusFilter === "active" && troupe.active === false) return false;
    if (statusFilter === "inactive" && troupe.active !== false) return false;
    if (categoryFilter !== "all" && troupe.categoryId !== categoryFilter) return false;
    const query = search.trim().toLowerCase();
    if (query && !(troupe.name ?? "").toLowerCase().includes(query)) return false;
    return true;
  });

  const editingTroupe = drawerMode?.mode === "edit" ? troupes.find((t) => t.id === drawerMode.troupeId) : null;

  return (
    <section className="config-section">
      <div className="section-heading">
        <h2>Comparsas</h2>
        <p>Eliminar oculta la comparsa de la vista y la conserva desactivada en BD. Para verlas usa el filtro de estado.</p>
      </div>
      <p className="feedback" role="status">{message}</p>
      {!locked && <button type="button" onClick={(event) => { drawerTriggerRef.current = event.currentTarget; setDrawerMode({ mode: "create" }); }}>+ Nueva comparsa</button>}
      <div className="troupe-filters">
        <label>Buscar<input type="search" value={search} onChange={(e) => setSearch(e.target.value)} aria-label="Buscar comparsa por nombre" placeholder="Buscar por nombre" /></label>
        <label>Tipo<select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)} aria-label="Filtrar comparsas por tipo">
          <option value="all">Todos los tipos</option>
          {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select></label>
        <label>Estado<select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} aria-label="Filtrar comparsas por estado">
          <option value="all">Todas</option>
          <option value="active">Activas</option>
          <option value="inactive">Inactivas</option>
        </select></label>
        <span className="filter-count" role="status">{filtered.length} de {troupes.length} comparsas</span>
      </div>
      {filtered.length === 0 ? (
        <p className="empty-state">Sin comparsas para los filtros actuales.</p>
      ) : (
        <div className="table-wrapper">
          <table className="data-table">
            <thead>
              <tr>
                <th scope="col">Comparsa</th>
                <th scope="col">Tipo</th>
                <th scope="col">Estado</th>
                {!locked && <th scope="col">Acción</th>}
              </tr>
            </thead>
            <tbody>
              {filtered.map((troupe) => (
                <tr key={troupe.id}>
                  <td>
                    <span className="troupe-cell">
                      {troupe.brandColor && <span className="troupe-swatch" role="img" aria-label={`Color ${troupe.brandColor}`} style={{ backgroundColor: troupe.brandColor }} />}
                      <span>
                        <strong>{troupe.name}</strong>
                        <span className="troupe-preview" aria-label={`Vista jurado de ${troupe.name}`}>Vista jurado: {troupe.name}{troupe.brandColor ? ` (${troupe.brandColor})` : " (sin color)"}</span>
                      </span>
                    </span>
                  </td>
                  <td>{troupe.categoryName ?? "Sin tipo"}</td>
                  <td><StatusPill status={troupe.active ? "ACTIVE" : "SUSPENDED"} label={troupe.active ? "Activa" : "Inactiva"} /></td>
                  {!locked && (
                    <td>
                      <button className="secondary" type="button" aria-label={`Editar comparsa ${troupe.name}`} onClick={(event) => { drawerTriggerRef.current = event.currentTarget; setDrawerMode({ mode: "edit", troupeId: troupe.id }); }}>
                        Editar
                      </button>{" "}
                      {troupe.active !== false ? (
                        <button className="secondary danger-action" type="button" aria-label={`Eliminar comparsa ${troupe.name}`} onClick={(event) => { deleteTriggerRef.current = event.currentTarget; setDeleteTarget(troupe); }}>
                          Eliminar
                        </button>
                      ) : (
                        <button className="secondary" type="button" aria-label={`Reactivar comparsa ${troupe.name}`} onClick={() => reactivateTroupe(troupe)}>
                          Reactivar
                        </button>
                      )}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <EntityDrawer
        isOpen={drawerMode !== null && !locked}
        onClose={() => setDrawerMode(null)}
        title={drawerMode?.mode === "edit" ? `Editar comparsa${editingTroupe ? ` — ${editingTroupe.name}` : ""}` : "Nueva comparsa"}
        description={drawerMode?.mode === "edit" ? "Modificá los datos de la comparsa." : "Completá los datos de la comparsa."}
        focusReturnRef={drawerTriggerRef}
      >
        <TroupeForm
          key={drawerMode?.mode === "edit" ? `edit-${drawerMode.troupeId}` : "create"}
          initialValue={editingTroupe ?? {}}
          categories={activeCategories}
          submitting={saving}
          submitLabel={drawerMode?.mode === "edit" ? "Guardar comparsa" : "Agregar comparsa"}
          showActive={drawerMode?.mode === "edit"}
          onSubmit={submitTroupe}
        />
        <DialogFooter>
          <button type="button" className="secondary" onClick={() => setDrawerMode(null)}>Cancelar</button>
        </DialogFooter>
      </EntityDrawer>
      <Dialog
        isOpen={deleteTarget !== null && !locked}
        onClose={() => setDeleteTarget(null)}
        title={deleteTarget ? `Eliminar ${deleteTarget.name}` : "Eliminar comparsa"}
        description="Se ocultara de la lista y quedara desactivada en BD (active=false). Podras verla con el filtro Inactivas y reactivarla. No se borra el historial."
        focusReturnRef={deleteTriggerRef}
      >
        <div className="dialog-actions">
          <button type="button" className="secondary" onClick={() => setDeleteTarget(null)}>Cancelar</button>
          <button type="button" className="danger-action" onClick={confirmDeleteTroupe}>Eliminar (desactivar)</button>
        </div>
      </Dialog>
    </section>
  );
}

function TroupeScheduleSection({ event }) {
  const [nights, setNights] = useState([]);
  const [schedule, setSchedule] = useState([]);
  const [troupes, setTroupes] = useState([]);
  const [nightId, setNightId] = useState("");
  const [troupeToAdd, setTroupeToAdd] = useState("");
  const [quitTarget, setQuitTarget] = useState(null);
  const [message, setMessage] = useState("");
  const { writing, setPending } = useContext(WriteContext);
  const locked = event.status === "OPEN";

  useEffect(() => {
    apiRequest(`/api/v1/events/${event.id}/nights`).then((loaded) => {
      setNights(loaded ?? []);
      setNightId((loaded ?? [])[0]?.id ?? "");
    }).catch(() => {});
    apiRequest(`/api/v1/events/${event.id}/troupes`).then((loaded) => setTroupes(loaded ?? [])).catch(() => {});
  }, [event.id]);

  useEffect(() => {
    if (!nightId) { setSchedule([]); return; }
    apiRequest(`/api/v1/events/${event.id}/schedule?nightId=${nightId}`)
      .then(setSchedule)
      .catch(() => setMessage("No se pudo cargar el orden de pasada."));
  }, [event.id, nightId]);

  const ordered = [...schedule].sort((a, b) => a.presentationOrder - b.presentationOrder);
  const nightName = nights.find((n) => n.id === nightId)?.name ?? "";
  const unprogrammed = troupes.filter((t) => t.active !== false && !schedule.some((s) => s.troupeId === t.id));

  const reorder = async (current, neighbor, direction) => {
    if (writing.current || locked || !neighbor) return;
    writing.current = true;
    setPending(true);
    try {
      const { changes } = await apiRequest(`/api/v1/schedule/${current.id}/reorder`, {
        method: "POST",
        body: JSON.stringify({ direction, neighborId: neighbor.id, expectedOrder: current.presentationOrder, expectedNeighborOrder: neighbor.presentationOrder }),
      });
      setSchedule((previous) => previous.map((entry) => ({ ...entry, ...changes.find((change) => change.id === entry.id) })));
      setMessage("Orden de pasada actualizado.");
    } catch (error) {
      if (["ORDER_CONFLICT", "ORDER_BOUNDARY"].includes(error.code)) {
        try {
          const fresh = await apiRequest(`/api/v1/events/${event.id}/schedule?nightId=${nightId}`);
          setSchedule(fresh);
          setMessage("El orden cambio. Recargamos la jornada; revisa antes de reintentar.");
        } catch {
          setMessage("No se pudo actualizar el orden. Recarga antes de reintentar.");
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
    <section className="config-section" aria-label="Orden de pasada por jornada">
      <div className="section-heading">
        <h2>Orden de pasada</h2>
        <p>Programá las comparsas en cada jornada y ordená la salida. Sin comparsas programadas, la votación abre planillas vacías. No abre votacion ni crea planillas.</p>
      </div>
      <p className="feedback" role="status">{message}</p>
      {nights.length === 0 && <p>Cargando jornadas...</p>}
      {nights.length > 0 && (
        <label>Jornada<select value={nightId} onChange={(e) => setNightId(e.target.value)} aria-label="Jornada para el orden de pasada">
          {nights.map((night) => <option key={night.id} value={night.id}>{night.name}</option>)}
        </select></label>
      )}
      {!locked && nightId && unprogrammed.length > 0 && (
        <form
          className="inline-item-form"
          onSubmit={async (e) => {
            e.preventDefault();
            if (writing.current || !troupeToAdd) return;
            writing.current = true;
            setPending(true);
            try {
              const saved = await apiRequest(`/api/v1/events/${event.id}/schedule`, {
                method: "POST",
                body: JSON.stringify({ nightId, troupeId: troupeToAdd }),
              });
              const troupe = troupes.find((t) => t.id === troupeToAdd);
              setSchedule((prev) => [...prev, { ...saved, troupeName: troupe?.name ?? "", troupeBrandColor: troupe?.brandColor ?? null }]);
              setTroupeToAdd("");
              setMessage("Comparsa programada en la jornada.");
            } catch (error) {
              setMessage(error.code === "SCHEDULE_CONFLICT"
                ? "Esa comparsa ya está programada en la jornada."
                : error.code === "EVENT_LOCKED"
                  ? "El evento ya no permite modificar su configuracion."
                  : "No se pudo programar la comparsa.");
            } finally {
              writing.current = false;
              setPending(false);
            }
          }}
        >
          <select value={troupeToAdd} onChange={(e) => setTroupeToAdd(e.target.value)} aria-label="Comparsa para programar en la jornada" required>
            <option value="">Comparsa para programar…</option>
            {unprogrammed.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
          <button type="submit">Programar comparsa</button>
        </form>
      )}
      <ol className="schedule-list">
        {ordered.map((entry, index) => (
          <li key={entry.id} className="schedule-row">
            <span className="mono-text">{entry.presentationOrder}</span>
            {entry.troupeBrandColor && <span className="troupe-swatch" role="img" aria-label={`Color ${entry.troupeBrandColor}`} style={{ backgroundColor: entry.troupeBrandColor }} />}
            <strong>{entry.troupeName}</strong>
            <ScheduledPassTime scheduledAt={entry.scheduledAt} scheduledTimezone={entry.scheduledTimezone} />
            {!locked && <>
              <button className="secondary" type="button" aria-label={`Subir ${entry.troupeName} en ${nightName}`} disabled={index === 0} onClick={() => reorder(entry, ordered[index - 1], "UP")}>Subir</button>
              <button className="secondary" type="button" aria-label={`Bajar ${entry.troupeName} en ${nightName}`} disabled={index === ordered.length - 1} onClick={() => reorder(entry, ordered[index + 1], "DOWN")}>Bajar</button>
              <button className="secondary" type="button" aria-label={`Quitar ${entry.troupeName} de ${nightName}`} onClick={() => setQuitTarget(entry)}>Quitar</button>
            </>}
          </li>
        ))}
      </ol>
      {ordered.some((entry) => entry.orderSource === "TEST_SIMULATED_DRAW") && (
        <p>Horarios y orden simulados para pruebas; no son un cronograma oficial de la COC.</p>
      )}
      {nightId && ordered.length === 0 && <p>Sin comparsas programadas en esta jornada. Programá al menos una para poder abrir la votación.</p>}
      {quitTarget && (
        <Dialog
          isOpen={Boolean(quitTarget)}
          onClose={() => setQuitTarget(null)}
          title={`Quitar ${quitTarget.troupeName} de ${nightName}`}
          description="La comparsa sale del orden de pasada pero no se elimina del evento."
        >
          <DialogFooter>
            <Button variant="secondary" onClick={() => setQuitTarget(null)}>Cancelar</Button>
            <Button
              variant="danger"
              onClick={async () => {
                const target = quitTarget;
                setQuitTarget(null);
                if (writing.current) return;
                writing.current = true;
                setPending(true);
                try {
                  await apiRequest(`/api/v1/schedule/${target.id}`, { method: "DELETE" });
                  setSchedule((prev) => prev.filter((s) => s.id !== target.id));
                  setMessage("Comparsa quitada de la jornada.");
                } catch {
                  setMessage("No se pudo quitar la comparsa de la jornada.");
                } finally {
                  writing.current = false;
                  setPending(false);
                }
              }}
            >
              Quitar de la jornada
            </Button>
          </DialogFooter>
        </Dialog>
      )}
    </section>
  );
}

function AdminCategoriesSection({ event }) {
  const [categories, setCategories] = useState([]);
  const [drawerMode, setDrawerMode] = useState(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const drawerTriggerRef = useRef(null);
  const { writing, setPending } = useContext(WriteContext);

  useEffect(() => { apiRequest(`/api/v1/events/${event.id}/categories`).then(setCategories).catch(() => {}); }, [event.id]);
  const locked = event.status === "OPEN";

  const save = async (path, body, method = "POST") => {
    try {
      const saved = await apiRequest(path, { method, body: JSON.stringify(body) });
      const fresh = await apiRequest(`/api/v1/events/${event.id}/categories`).catch(() => null);
      if (fresh) setCategories(fresh);
      else setCategories((prev) => method === "POST" ? [...prev, saved] : prev.map((category) => category.id === saved.id ? { ...category, ...saved } : category));
      setMessage("Guardado.");
      setDrawerMode(null);
      return true;
    } catch (e) {
      setMessage(e.code === "RESOURCE_CONFLICT" ? "Ese nombre u orden ya está en uso." : "No se pudo guardar.");
      return false;
    }
  };

  const submitCategory = async (body) => {
    if (writing.current) return;
    writing.current = true;
    setPending(true);
    setSaving(true);
    try {
      if (drawerMode?.mode === "edit") {
        await save(`/api/v1/categories/${drawerMode.categoryId}`, body, "PATCH");
      } else {
        await save(`/api/v1/events/${event.id}/categories`, body);
      }
    } finally {
      writing.current = false;
      setPending(false);
      setSaving(false);
    }
  };

  const ordered = [...categories].sort((a, b) => (a.displayOrder ?? 0) - (b.displayOrder ?? 0));
  const nextOrder = ordered.length === 0 ? 1 : Math.max(...ordered.map((c) => c.displayOrder ?? 0)) + 1;
  const editingCategory = drawerMode?.mode === "edit" ? categories.find((c) => c.id === drawerMode.categoryId) : null;

  return (
    <section className="config-section">
      <div className="section-heading"><h2>Tipos de participacion</h2><p>Cada comparsa elige uno de estos tipos al darse de alta: crealos antes de cargar comparsas.</p></div>
      <p className="feedback" role="status">{message}</p>
      {!locked && <button type="button" onClick={(event) => { drawerTriggerRef.current = event.currentTarget; setDrawerMode({ mode: "create" }); }}>+ Nuevo tipo</button>}
      {ordered.length === 0 ? (
        <p className="empty-state">Todavía no hay tipos de participación.</p>
      ) : (
        <div className="table-wrapper">
          <table className="data-table">
            <thead>
              <tr>
                <th scope="col">#</th>
                <th scope="col">Tipo</th>
                <th scope="col">Código</th>
                <th scope="col">Estado</th>
                {!locked && <th scope="col">Acción</th>}
              </tr>
            </thead>
            <tbody>
              {ordered.map((category) => (
                <tr key={category.id}>
                  <td>{category.displayOrder}</td>
                  <td><strong>{category.name}</strong></td>
                  <td><span className="mono-text">{category.code}</span></td>
                  <td><StatusPill status={category.active ? "ACTIVE" : "SUSPENDED"} label={category.active ? "Activa" : "Inactiva"} /></td>
                  {!locked && (
                    <td>
                      <button className="secondary" type="button" aria-label={`Editar tipo ${category.name}`} onClick={(event) => { drawerTriggerRef.current = event.currentTarget; setDrawerMode({ mode: "edit", categoryId: category.id }); }}>
                        Editar
                      </button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <EntityDrawer
        isOpen={drawerMode !== null && !locked}
        onClose={() => setDrawerMode(null)}
        title={drawerMode?.mode === "edit" ? `Editar tipo${editingCategory ? ` — ${editingCategory.name}` : ""}` : "Nuevo tipo de participación"}
        description={drawerMode?.mode === "edit" ? "Modificá los datos del tipo." : "Completá los datos del tipo."}
        focusReturnRef={drawerTriggerRef}
      >
        <CatalogForm
          key={drawerMode?.mode === "edit" ? `edit-${drawerMode.categoryId}` : "create"}
          initialValue={editingCategory ?? {}}
          defaultOrder={nextOrder}
          showOrder={drawerMode?.mode === "edit"}
          submitting={saving}
          submitLabel={drawerMode?.mode === "edit" ? "Guardar" : "Agregar tipo"}
          showActive={drawerMode?.mode === "edit"}
          idPrefix="category"
          onSubmit={submitCategory}
        />
        <DialogFooter>
          <button type="button" className="secondary" onClick={() => setDrawerMode(null)}>Cancelar</button>
        </DialogFooter>
      </EntityDrawer>
    </section>
  );
}

function AdminSpecialtiesSection({ event }) {
  const [specialties, setSpecialties] = useState([]);
  const [drawerMode, setDrawerMode] = useState(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const drawerTriggerRef = useRef(null);
  const { writing, setPending } = useContext(WriteContext);

  useEffect(() => { apiRequest(`/api/v1/events/${event.id}/specialties`).then(setSpecialties).catch(() => {}); }, [event.id]);
  const locked = event.status === "OPEN";

  const save = async (path, body, method = "POST") => {
    try {
      const saved = await apiRequest(path, { method, body: JSON.stringify(body) });
      const fresh = await apiRequest(`/api/v1/events/${event.id}/specialties`).catch(() => null);
      if (fresh) setSpecialties(fresh);
      else setSpecialties((prev) => method === "POST" ? [...prev, saved] : prev.map((s) => s.id === saved.id ? { ...s, ...saved } : s));
      setMessage("Guardado.");
      setDrawerMode(null);
      return true;
    } catch (e) {
      setMessage(e.code === "RESOURCE_CONFLICT" ? "Ese nombre u orden ya está en uso." : "No se pudo guardar.");
      return false;
    }
  };

  const submitSpecialty = async (body) => {
    if (writing.current) return;
    writing.current = true;
    setPending(true);
    setSaving(true);
    try {
      if (drawerMode?.mode === "edit") {
        await save(`/api/v1/specialties/${drawerMode.specialtyId}`, body, "PATCH");
      } else {
        await save(`/api/v1/events/${event.id}/specialties`, body);
      }
    } finally {
      writing.current = false;
      setPending(false);
      setSaving(false);
    }
  };

  const ordered = [...specialties].sort((a, b) => (a.displayOrder ?? 0) - (b.displayOrder ?? 0));
  const nextOrder = ordered.length === 0 ? 1 : Math.max(...ordered.map((s) => s.displayOrder ?? 0)) + 1;
  const editingSpecialty = drawerMode?.mode === "edit" ? specialties.find((s) => s.id === drawerMode.specialtyId) : null;

  return (
    <section className="config-section">
      <div className="section-heading"><h2>Especialidades</h2><p>Cada ítem puntuable pertenece a una especialidad activa: creá al menos una antes de cargar ítems en el paso 3.</p></div>
      <p className="feedback" role="status">{message}</p>
      {!locked && <button type="button" onClick={(event) => { drawerTriggerRef.current = event.currentTarget; setDrawerMode({ mode: "create" }); }}>+ Nueva especialidad</button>}
      {ordered.length === 0 ? (
        <p className="empty-state">Todavía no hay especialidades.</p>
      ) : (
        <div className="table-wrapper">
          <table className="data-table">
            <thead>
              <tr>
                <th scope="col">#</th>
                <th scope="col">Especialidad</th>
                <th scope="col">Código</th>
                <th scope="col">Estado</th>
                {!locked && <th scope="col">Acción</th>}
              </tr>
            </thead>
            <tbody>
              {ordered.map((spec) => (
                <tr key={spec.id}>
                  <td>{spec.displayOrder}</td>
                  <td><strong>{spec.name}</strong></td>
                  <td><span className="mono-text">{spec.code}</span></td>
                  <td><StatusPill status={spec.active ? "ACTIVE" : "SUSPENDED"} label={spec.active ? "Activa" : "Inactiva"} /></td>
                  {!locked && (
                    <td>
                      <button className="secondary" type="button" aria-label={`Editar especialidad ${spec.name}`} onClick={(event) => { drawerTriggerRef.current = event.currentTarget; setDrawerMode({ mode: "edit", specialtyId: spec.id }); }}>
                        Editar
                      </button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <EntityDrawer
        isOpen={drawerMode !== null && !locked}
        onClose={() => setDrawerMode(null)}
        title={drawerMode?.mode === "edit" ? `Editar especialidad${editingSpecialty ? ` — ${editingSpecialty.name}` : ""}` : "Nueva especialidad"}
        description={drawerMode?.mode === "edit" ? "Modificá los datos de la especialidad." : "Completá los datos de la especialidad."}
        focusReturnRef={drawerTriggerRef}
      >
        <CatalogForm
          key={drawerMode?.mode === "edit" ? `edit-${drawerMode.specialtyId}` : "create"}
          initialValue={editingSpecialty ?? {}}
          defaultOrder={nextOrder}
          showOrder={drawerMode?.mode === "edit"}
          submitting={saving}
          submitLabel={drawerMode?.mode === "edit" ? "Guardar" : "Agregar especialidad"}
          showActive={drawerMode?.mode === "edit"}
          idPrefix="specialty"
          onSubmit={submitSpecialty}
        />
        <DialogFooter>
          <button type="button" className="secondary" onClick={() => setDrawerMode(null)}>Cancelar</button>
        </DialogFooter>
      </EntityDrawer>
    </section>
  );
}

function AdminRubricsSection({ event, focusRubricId = null }) {
  const [rubrics, setRubrics] = useState([]);
  const [specialties, setSpecialties] = useState([]);
  const [expanded, setExpanded] = useState(null);
  const [highlightItemId, setHighlightItemId] = useState(null);
  const [editingItem, setEditingItem] = useState(null);
  const [editingCriterion, setEditingCriterion] = useState(null);
  const [message, setMessage] = useState("");
  const { writing, setPending } = useContext(WriteContext);

  const scrollToSelector = (selector) => {
    requestAnimationFrame(() => {
      document.querySelector(selector)?.scrollIntoView?.({ behavior: "smooth", block: "start" });
    });
  };

  useEffect(() => {
    apiRequest(`/api/v1/events/${event.id}/rubrics`).then(setRubrics).catch(() => {});
    apiRequest(`/api/v1/events/${event.id}/specialties`).then(setSpecialties).catch(() => {});
  }, [event.id]);

  useEffect(() => {
    if (focusRubricId) {
      setExpanded(focusRubricId);
      setHighlightItemId(null);
      scrollToSelector(`[data-rubric-id="${focusRubricId}"]`);
    }
  }, [focusRubricId]);

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
      const fresh = await apiRequest(`/api/v1/events/${event.id}/rubrics`).catch(() => null);
      if (fresh) setRubrics(fresh);
      else setRubrics((prev) => method === "POST" ? [...prev, { ...saved, items: [], criteria: [], specialties: [] }] : prev.map((r) => r.id === saved.id ? { ...r, ...saved } : r));
      setMessage("Rubro guardado.");
      if (method === "POST" && saved?.id) {
        // El rubro recién creado se abre solo para seguir cargando ítems.
        setExpanded(saved.id);
        setHighlightItemId(null);
        scrollToSelector(`[data-rubric-id="${saved.id}"]`);
      }
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
      if (method === "POST" && saved?.id) {
        setHighlightItemId(saved.id);
        scrollToSelector(`[data-item-id="${saved.id}"]`);
      }
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

      <h3>Qué puntúa el jurado</h3>
      <RubricTree rubrics={rubrics} specialties={specialties} />

      <p id="resolution-metadata">El metodo de resolucion es metadata futura: no ejecuta formulas ni decisiones automaticas o de Comision Organizadora.</p>
      <p id="item-metadata">Obligatorio (required) y Permite No presentado (allowNotPresented) son metadata futura: todos los items generados deben resolverse y admiten No se presento (NOT_PRESENTED). Los pendientes bloquean confirmacion y cierre, sin importar estas opciones.</p>
      <p id="subject-type-help">El tipo de sujeto solo aplica al objetivo Nominacion; para Comparsa se guarda sin tipo de sujeto.</p>
      {!locked && (
        <SaveForm resetOnSuccess className="config-card" onSubmit={(e) => { const fd = new FormData(e.currentTarget); return saveRubric(`/api/v1/events/${event.id}/rubrics`, { name: fd.get("name"), evaluationTarget: fd.get("evaluationTarget"), rubricType: fd.get("rubricType"), resolutionMethod: fd.get("resolutionMethod"), evaluationObjective: fd.get("evaluationObjective") || null, expectedSubjectType: fd.get("evaluationTarget") === "NOMINATION" ? fd.get("expectedSubjectType") : null }); }}>
          <h3>Nuevo rubro</h3>
          <label>Nombre<input name="name" required /></label>
          <label>A quién se evalúa<select name="evaluationTarget"><option value="TROUPE">Comparsa</option><option value="NOMINATION">Nominacion</option></select></label>
          <label>Tipo de rubro<select name="rubricType">{RUBRIC_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}</select></label>
          <label>Detalle del objetivo (texto libre, opcional)<input name="evaluationObjective" placeholder="Ej: Figura / participante" /></label>
          <details className="advanced-options">
            <summary>Opciones avanzadas (sin efecto operativo)</summary>
            <label>Tipo de sujeto<select name="expectedSubjectType" aria-describedby="subject-type-help">{SUBJECT_TYPES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}</select></label>
            <label>Metodo de resolucion<select name="resolutionMethod" aria-describedby="resolution-metadata">{RESOLUTION_METHODS.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}</select></label>
          </details>
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
            <article className="rubric-card" key={rubric.id} data-rubric-id={rubric.id}>
              <div className="rubric-card-header">
                <div>
                  <h3>{rubric.name}</h3>
                  <span className="rubric-meta">{rubricTypeLabel} &middot; {resolutionLabel}</span>
                  {rubric.evaluationObjective && <span className="rubric-meta">{rubric.evaluationObjective}</span>}
                  <span className="rubric-meta">{derived.map((s) => s.name).join(", ") || "Sin items activos"}</span>
                </div>
                <button className="secondary" type="button" aria-label={`${isExpanded ? "Contraer" : "Expandir"} ${rubric.name}`} aria-expanded={isExpanded} onClick={() => { setHighlightItemId(null); setExpanded(isExpanded ? null : rubric.id); }}>
                  {isExpanded ? "Contraer" : "Expandir"}
                </button>
              </div>

              {isExpanded && (
                <div className="rubric-expanded">
                  {!locked && (
                    <SaveForm className="rubric-edit-form" onSubmit={(e) => { const fd = new FormData(e.currentTarget); return saveRubric(`/api/v1/rubrics/${rubric.id}`, { name: fd.get("name"), evaluationTarget: fd.get("evaluationTarget"), expectedSubjectType: fd.get("evaluationTarget") === "NOMINATION" ? fd.get("expectedSubjectType") : null, rubricType: fd.get("rubricType"), resolutionMethod: fd.get("resolutionMethod"), evaluationObjective: fd.get("evaluationObjective") || null, active: fd.get("active") === "on" }, "PATCH"); }}>
                      <label>Nombre<input name="name" defaultValue={rubric.name} required /></label>
                      <label>A quién se evalúa<select name="evaluationTarget" defaultValue={rubric.evaluationTarget}><option value="TROUPE">Comparsa</option><option value="NOMINATION">Nominacion</option></select></label>
                      <label>Tipo<select name="rubricType" defaultValue={rubric.rubricType}>{RUBRIC_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}</select></label>
                      <label>Detalle del objetivo (texto libre, opcional)<input name="evaluationObjective" defaultValue={rubric.evaluationObjective ?? ""} /></label>
                      <details className="advanced-options">
                        <summary>Opciones avanzadas (sin efecto operativo)</summary>
                        <label>Tipo de sujeto<select name="expectedSubjectType" defaultValue={rubric.expectedSubjectType ?? "PERSON"} aria-describedby="subject-type-help">{SUBJECT_TYPES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}</select></label>
                        <label>Resolucion<select name="resolutionMethod" defaultValue={rubric.resolutionMethod} aria-describedby="resolution-metadata">{RESOLUTION_METHODS.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}</select></label>
                      </details>
                      <label className="check"><input name="active" type="checkbox" defaultChecked={rubric.active} /> Activo</label>
                      <button type="submit">Guardar rubro</button>
                    </SaveForm>
                  )}

                  <h4>Items puntuables</h4>
                  {orderedItems.map((item, itemIndex) => (
                    <article className={`subrecord${highlightItemId === item.id ? " is-target" : ""}`} key={item.id} data-item-id={item.id}>
                      {editingItem === item.id ? (
                        <SaveForm onSubmit={(e) => { const fd = new FormData(e.currentTarget); return saveItem(rubric.id, { name: fd.get("name"), specialtyId: fd.get("specialtyId"), displayOrder: Number(fd.get("displayOrder")), required: fd.get("required") === "on", allowNotPresented: fd.get("allowNotPresented") === "on", active: fd.get("active") === "on" }, "PATCH", item.id); }}>
                          <label>Nombre<input name="name" defaultValue={item.name} required /></label>
                          <label>Especialidad<select name="specialtyId" defaultValue={item.specialtyId}>{activeSpecialties.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select></label>
                          <label>Orden<input name="displayOrder" type="number" min="1" defaultValue={item.displayOrder} required /></label>
                          <details className="advanced-options">
                            <summary>Opciones avanzadas (sin efecto operativo)</summary>
                            <label className="check"><input name="required" type="checkbox" defaultChecked={item.required} aria-describedby="item-metadata" /> Obligatorio</label>
                            <label className="check"><input name="allowNotPresented" type="checkbox" defaultChecked={item.allowNotPresented} aria-describedby="item-metadata" /> Permite No presentado</label>
                          </details>
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
                      <details className="advanced-options">
                        <summary>Opciones avanzadas (sin efecto operativo)</summary>
                        <label className="check"><input name="required" type="checkbox" defaultChecked aria-describedby="item-metadata" /> Obligatorio</label>
                        <label className="check"><input name="allowNotPresented" type="checkbox" defaultChecked aria-describedby="item-metadata" /> Permite No presentado</label>
                      </details>
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

function MatrizPlanillasSection({ event, onResolveRubric }) {
  const [rubrics, setRubrics] = useState([]);
  const [specialties, setSpecialties] = useState([]);
  const [selected, setSelected] = useState(null);

  useEffect(() => {
    apiRequest(`/api/v1/events/${event.id}/rubrics`).then(setRubrics).catch(() => {});
    apiRequest(`/api/v1/events/${event.id}/specialties`).then(setSpecialties).catch(() => {});
  }, [event.id]);

  const activeSpecialties = specialties.filter((s) => s.active !== false);
  const activeRubrics = rubrics.filter((r) => r.active !== false);
  const missingRubrics = activeRubrics.filter(
    (r) => !(r.items ?? []).some((i) => i.active !== false),
  );
  const uncoveredSpecialties = activeSpecialties.filter(
    (s) => !activeRubrics.some((r) => (r.items ?? []).some((i) => i.active !== false && i.specialtyId === s.id)),
  );

  return (
    <section className="config-section">
      <div className="section-heading"><h2>Planillas de evaluación</h2><p>Qué especialidad evalúa qué rubro. Se genera automaticamente desde la configuracion.</p></div>
      {(missingRubrics.length > 0 || uncoveredSpecialties.length > 0) && (
        <div className="overview-alert" role="alert">
          <strong>⚠ Te faltan {missingRubrics.length + uncoveredSpecialties.length} asignaciones para completar la matriz.</strong>
          <ul>
            {missingRubrics.map((r) => (
              <li key={r.id}>
                El rubro “{r.name}” no tiene ítems puntuables.{" "}
                {onResolveRubric && (
                  <button className="secondary" type="button" aria-label={`Resolver rubro ${r.name}`} onClick={() => onResolveRubric(r.id)}>
                    Resolver
                  </button>
                )}
              </li>
            ))}
            {uncoveredSpecialties.map((s) => (
              <li key={s.id}>La especialidad “{s.name}” todavía no evalúa ningún rubro.</li>
            ))}
          </ul>
        </div>
      )}
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
import { ScheduledPassTime } from "../components/ScheduledPassTime.jsx";
