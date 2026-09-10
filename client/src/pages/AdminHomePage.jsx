import { useEffect, useMemo, useState } from "react";
import { apiRequest } from "../api/http.js";
import { PageShell } from "../components/PageShell.jsx";
import { PageHeader } from "../components/PageHeader.jsx";
import { EventStatusBanner } from "../components/EventStatusBanner.jsx";
import { ConfigurationProgress } from "../components/ConfigurationProgress.jsx";
import { uxStatusLabel } from "../components/admin-ux-labels.js";
import { useAdminEvent } from "../context/AdminEventContext.jsx";

const READINESS_LABELS = {
  COMPETITION_NIGHT: { label: "Jornadas de competencia", href: "#/admin/events" },
  ACTIVE_TROUPE: { label: "Comparsas activas", href: "#/admin/competencia" },
  ACTIVE_SPECIALTY: { label: "Especialidades activas", href: "#/admin/competencia" },
  ACTIVE_RUBRIC: { label: "Rubros con ítems válidos", href: "#/admin/competencia" },
};

function countActive(items) {
  return (items ?? []).filter((item) => item.active !== false).length;
}

const OPERATIONAL_LINKS = {
  CONFIGURING: [
    { label: "Agregar comparsa", href: "#/admin/competencia" },
    { label: "Registrar jurado", href: "#/admin/judges" },
    { label: "Crear asignación", href: "#/admin/assignments" },
    { label: "Revisar configuración", href: "#/admin/events" },
  ],
  OPEN: [
    { label: "Ver votación", href: "#/admin/voting" },
    { label: "Ver personas", href: "#/admin/judges" },
    { label: "Ver competencia", href: "#/admin/competencia" },
    { label: "Revisar jornadas", href: "#/admin/events" },
  ],
  CLOSED: [
    { label: "Ver escrutinio", href: "#/admin/results" },
    { label: "Ver acta oficial", href: "#/admin/record" },
    { label: "Ver personas", href: "#/admin/judges" },
    { label: "Revisar evento", href: "#/admin/events" },
  ],
};

const NEXT_STEP_COPY = {
  nights: {
    title: "Configurar jornadas",
    description: "Definí las noches de competencia antes de cargar las participantes.",
    action: "Configurar jornadas",
  },
  troupes: {
    title: "Configurar comparsas",
    description: "Todavía no hay comparsas activas para este evento. Agregá las participantes antes de configurar la evaluación.",
    action: "Configurar comparsas",
  },
  rubrics: {
    title: "Configurar evaluación",
    description: "Agregá rubros e ítems puntuables para que el jurado pueda evaluar la competencia.",
    action: "Configurar evaluación",
  },
  judges: {
    title: "Registrar jurados",
    description: "Registrá las personas que van a participar como jurados en este evento.",
    action: "Registrar jurados",
  },
  assignments: {
    title: "Crear asignaciones",
    description: "Asigná jurados a cada jornada y especialidad para completar la preparación.",
    action: "Crear asignaciones",
  },
  validation: {
    title: "Resolver la validación",
    description: "Revisá los requisitos pendientes antes de abrir la competencia.",
    action: "Revisar validación",
  },
  opening: {
    title: "Abrir la competencia",
    description: "La configuración está lista. Revisá el evento y abrí la competencia cuando corresponda.",
    action: "Abrir competencia",
  },
};

/**
 * AdminHomePage — Panel de solo lectura (Spec 027/Fase B).
 * Responde: estado, qué está configurado, qué falta, próximo paso,
 * problemas bloqueantes. Sin escrituras: ningún POST/PUT/PATCH.
 */
export function AdminHomePage() {
  const adminEvent = useAdminEvent();
  const [localEvents, setLocalEvents] = useState([]);
  const [localEventId, setLocalEventId] = useState("");
  const [readiness, setReadiness] = useState(null);
  const [counts, setCounts] = useState({ nights: 0, troupes: 0, specialties: 0, rubrics: 0, judges: 0, assignments: 0 });
  const [localLoading, setLocalLoading] = useState(true);
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (adminEvent) return undefined;
    let active = true;
    apiRequest("/api/v1/events")
      .then((items) => {
        if (!active) return;
        setLocalEvents(items ?? []);
        setLocalEventId((items ?? [])[0]?.id ?? "");
      })
      .catch(() => {
        if (active) {
          setMessage("No se pudieron cargar los eventos.");
          setLocalLoading(false);
        }
      });
    return () => {
      active = false;
    };
  }, [adminEvent]);

  const events = adminEvent?.events ?? localEvents;
  const eventId = adminEvent?.activeEventId ?? localEventId;
  const loading = adminEvent ? adminEvent.loading || localLoading : localLoading;

  useEffect(() => {
    if (!eventId) {
      setLocalLoading(false);
      return;
    }
    let active = true;
    setLocalLoading(true);
    setMessage("");
    Promise.allSettled([
      apiRequest(`/api/v1/events/${eventId}/readiness`),
      apiRequest(`/api/v1/events/${eventId}/nights`),
      apiRequest(`/api/v1/events/${eventId}/troupes`),
      apiRequest(`/api/v1/events/${eventId}/specialties`),
      apiRequest(`/api/v1/events/${eventId}/rubrics`),
      apiRequest(`/api/v1/events/${eventId}/judge-assignments`),
      apiRequest("/api/v1/judges"),
    ]).then(([readinessRes, nightsRes, troupesRes, specialtiesRes, rubricsRes, assignmentsRes, judgesRes]) => {
      if (!active) return;
      if (readinessRes.status === "fulfilled") setReadiness(readinessRes.value);
      else setReadiness(null);
      const rubrics = rubricsRes.status === "fulfilled" ? rubricsRes.value : [];
      const assignments = assignmentsRes.status === "fulfilled" ? assignmentsRes.value?.assignments ?? [] : [];
      const judges = judgesRes.status === "fulfilled" ? judgesRes.value : [];
      setCounts({
        nights: (nightsRes.status === "fulfilled" ? nightsRes.value : []).filter((n) => n.kind === "COMPETITION").length,
        troupes: countActive(troupesRes.status === "fulfilled" ? troupesRes.value : []),
        specialties: countActive(specialtiesRes.status === "fulfilled" ? specialtiesRes.value : []),
        rubrics: countActive(rubrics),
        judges: judges.filter((j) => j.registrationStatus === "REGISTERED").length,
        assignments: assignments.filter((a) => a.status === "ACTIVE").length,
      });
      if (readinessRes.status === "rejected") setMessage("No se pudo consultar la preparación del evento.");
      setLocalLoading(false);
    });
    return () => {
      active = false;
    };
  }, [eventId, adminEvent]);

  const selected = adminEvent?.activeEvent ?? events.find((event) => event.id === eventId);
  const effectiveMessage = adminEvent?.error || message;

  const steps = useMemo(() => {
    const done = (cond) => (cond ? "done" : "pending");
    const list = [
      { key: "nights", label: "Jornadas", detail: `${counts.nights} de competencia`, state: done(counts.nights > 0), href: "#/admin/events" },
      { key: "troupes", label: "Comparsas", detail: `${counts.troupes} activas`, state: done(counts.troupes > 0), href: "#/admin/competencia" },
      { key: "rubrics", label: "Evaluación", detail: `${counts.rubrics} rubros · ${counts.specialties} especialidades`, state: done(counts.rubrics > 0 && counts.specialties > 0), href: "#/admin/competencia" },
      { key: "judges", label: "Jurados", detail: `${counts.judges} registrados`, state: done(counts.judges > 0), href: "#/admin/judges" },
      { key: "assignments", label: "Asignaciones", detail: `${counts.assignments} activas`, state: done(counts.assignments > 0), href: "#/admin/assignments" },
      { key: "validation", label: "Validación", detail: readiness?.ready ? "Completa" : "Pendiente", state: readiness?.ready ? "done" : "pending", href: "#/admin/events" },
      { key: "opening", label: "Apertura", detail: selected ? uxStatusLabel(selected.status, selected.status) : "—", state: selected?.status === "OPEN" ? "done" : "pending", href: "#/admin/voting" },
    ];
    const firstPending = list.findIndex((step) => step.state !== "done");
    if (firstPending >= 0) list[firstPending] = { ...list[firstPending], state: "current" };
    return list;
  }, [counts, readiness, selected]);

  const progress = steps.length === 0 ? 0 : (steps.filter((s) => s.state === "done").length / steps.length) * 100;
  const nextStep = steps.find((s) => s.state === "current") ?? null;

  const problems = useMemo(() => {
    const items = [];
    (readiness?.missing ?? []).forEach((code) => {
      const meta = READINESS_LABELS[code] ?? { label: code, href: "#/admin/events" };
      const copy = {
        COMPETITION_NIGHT: "Todavía no hay jornadas de competencia",
        ACTIVE_TROUPE: "Todavía no hay comparsas activas",
        ACTIVE_SPECIALTY: "La evaluación todavía no tiene especialidades activas",
        ACTIVE_RUBRIC: "La evaluación todavía no tiene rubros con ítems puntuables",
      }[code] ?? `Revisá ${meta.label.toLowerCase()}`;
      const description = {
        COMPETITION_NIGHT: "Agregá al menos una jornada para continuar con la configuración.",
        ACTIVE_TROUPE: "Agregá al menos una comparsa para continuar con la configuración.",
        ACTIVE_SPECIALTY: "Agregá una especialidad activa antes de definir los rubros.",
        ACTIVE_RUBRIC: "Necesitás al menos un rubro con ítems puntuables.",
      }[code] ?? "Revisá esta sección para continuar con la preparación.";
      const action = {
        COMPETITION_NIGHT: "Configurar jornadas",
        ACTIVE_TROUPE: "Configurar comparsas",
        ACTIVE_SPECIALTY: "Configurar evaluación",
        ACTIVE_RUBRIC: "Configurar evaluación",
      }[code] ?? "Revisar configuración";
      items.push({ key: code, title: copy, description, href: meta.href, action });
    });
    (readiness?.incompleteTroupes ?? []).forEach((troupe) => {
      items.push({
        key: `troupe-${troupe.id}`,
        title: `La comparsa "${troupe.name}" necesita un tipo activo`,
        description: "Elegí el tipo de participación para completar su configuración.",
        href: "#/admin/competencia",
        action: "Configurar comparsas",
      });
    });
    (readiness?.incompleteRubrics ?? []).forEach((rubric) => {
      items.push({
        key: `rubric-${rubric.id}`,
        title: `El rubro "${rubric.name}" necesita ítems puntuables`,
        description: "Agregá al menos un ítem para que el rubro pueda formar parte de la evaluación.",
        href: "#/admin/competencia",
        action: "Configurar evaluación",
      });
    });
    return items;
  }, [readiness]);

  const quickLinks = OPERATIONAL_LINKS[selected?.status] ?? OPERATIONAL_LINKS.CONFIGURING;
  const stats = [
    { key: "troupes", value: counts.troupes, label: "Comparsas", href: "#/admin/competencia" },
    { key: "nights", value: counts.nights, label: "Jornadas", href: "#/admin/events" },
    { key: "judges", value: counts.judges, label: "Jurados", href: "#/admin/judges" },
    { key: "rubrics", value: counts.rubrics, label: "Rubros", href: "#/admin/competencia" },
  ];

  const nextStepCopy = nextStep ? NEXT_STEP_COPY[nextStep.key] : null;

  return (
    <PageShell layer="instrument" className="admin-shell admin-home-shell">
      <PageHeader
        eyebrow="Panel de administración"
        title={selected?.name ?? "Administración"}
        status={selected?.status}
        actions={
        <label className="event-picker">
            Evento
            <select
              value={eventId}
              onChange={(event) => {
                if (adminEvent) adminEvent.setActiveEventId(event.target.value);
                else setLocalEventId(event.target.value);
              }}
              aria-label="Evento activo"
            >
              {events.map((event) => (
                <option key={event.id} value={event.id}>
                  {event.name}
                </option>
              ))}
            </select>
          </label>
        }
      />
      {selected && <EventStatusBanner status={selected.status} />}
      <p className="feedback" role="status" aria-live="polite">
        {effectiveMessage}
      </p>
      {loading ? (
        <p>Cargando panel…</p>
      ) : !selected ? (
        <p className="empty-state">Todavía no hay eventos. Creá el primero desde Evento.</p>
      ) : (
        <div className="admin-dashboard">
          <div className="admin-dashboard-main">
            <section className="config-section" aria-label="Progreso de configuración">
              <div className="section-heading">
                <h2>Camino de configuración</h2>
                <p>Completá los pasos en orden para preparar la competencia.</p>
              </div>
              <ConfigurationProgress steps={steps} value={progress} label="Preparación del evento" />
              {nextStep ? (
                <div className="admin-next-step-card">
                  <div>
                    <span className="eyebrow">Siguiente paso</span>
                    <strong>{nextStepCopy?.title ?? nextStep.label}</strong>
                    <span>{nextStepCopy?.description ?? nextStep.detail}</span>
                  </div>
                  <a className="button-link" href={nextStep.href}>
                    {nextStepCopy?.action ?? `Configurar ${nextStep.label.toLowerCase()}`}
                  </a>
                </div>
              ) : (
                <div className="admin-next-step-card is-complete">
                  <div>
                    <span className="eyebrow">Listo</span>
                    <strong>Configuración completa</strong>
                    <span>El evento está preparado para abrir o ya está en competencia.</span>
                  </div>
                  <a className="button-link secondary" href="#/admin/voting">
                    Abrir votación
                  </a>
                </div>
              )}
            </section>
          </div>

          <aside className="admin-dashboard-side" aria-label="Resumen del evento">
            <section className="config-section">
              <div className="section-heading">
                <h2>Resumen</h2>
              </div>
              <div className="competencia-overview-grid admin-stats">
                {stats.map((stat) => (
                  <a className="overview-stat" key={stat.key} href={stat.href} aria-label={`${stat.label}: ${stat.value}. Ver ${stat.label.toLowerCase()}`}>
                    <span className="overview-number">{stat.value}</span>
                    <span className="overview-label">{stat.label}</span>
                    <span className="admin-stat-link">Ver {stat.label.toLowerCase()}</span>
                  </a>
                ))}
              </div>
            </section>

            <section className="config-section admin-attention-section" aria-label="Requiere atención">
              <div className="section-heading">
                <h2>Requiere atención</h2>
                <p>Resolvé estos puntos antes de abrir la competencia.</p>
              </div>
              {problems.length === 0 ? (
                <p className="readiness-ok">
                  <span className="readiness-icon" aria-hidden="true">✓</span>
                  No hay problemas pendientes.
                </p>
              ) : (
                <ul className="readiness-checklist admin-problem-list">
                  {problems.map((problem) => (
                    <li key={problem.key} className="readiness-fail">
                      <span className="readiness-icon" aria-hidden="true">!</span>
                      <span className="admin-problem-copy">
                        <strong>{problem.title}</strong>
                        <span>{problem.description}</span>
                      </span>
                      <a href={problem.href}>{problem.action}</a>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section className="config-section" aria-label="Acciones rápidas">
              <div className="section-heading">
                <h2>Acciones rápidas</h2>
              </div>
              <div className="admin-quick-links">
                {quickLinks.map((link) => (
                  <a key={link.href} className="button-link secondary" href={link.href}>
                    {link.label}
                  </a>
                ))}
              </div>
            </section>
          </aside>
        </div>
      )}
    </PageShell>
  );
}
