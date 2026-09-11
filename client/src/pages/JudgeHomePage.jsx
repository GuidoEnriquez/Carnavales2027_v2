import { useEffect, useState } from "react";
import { PageShell } from "../components/PageShell.jsx";
import { apiRequest } from "../api/http.js";
import { ProgressBar } from "../components/ProgressBar.jsx";
import { StatusPill } from "../components/StatusPill.jsx";

function summarizeTroupes(ballot, scores) {
  const groups = scores.reduce((result, score) => {
    const id = score.nightScheduleId ?? `ballot-${ballot.id}`;
    if (!result[id]) result[id] = {
      ballotId: ballot.id,
      troupeId: id,
      troupeName: score.troupeName ?? ballot.nightName,
      brandColor: score.brandColor || null,
      nightName: ballot.nightName,
      specialtyName: ballot.specialtyName,
      eventName: ballot.eventName,
      status: ballot.status,
      total: 0,
      resolved: 0,
      presentationOrder: score.presentationOrder ?? 0,
    };
    result[id].total += 1;
    if (score.evaluationState !== "PENDING") result[id].resolved += 1;
    return result;
  }, {});
  return Object.values(groups).sort((left, right) => left.presentationOrder - right.presentationOrder);
}

export function isTroupeLockedInSequence(troupeIndex, troupesList) {
  const current = troupesList[troupeIndex];
  if (!current || current.status === "SUBMITTED") {
    return false;
  }

  for (let j = 0; j < troupeIndex; j++) {
    const prior = troupesList[j];
    const sameNight = (current.nightName && prior.nightName)
      ? current.nightName === prior.nightName
      : current.ballotId === prior.ballotId;

    if (sameNight) {
      const isPriorComplete = prior.status === "SUBMITTED" || (prior.total > 0 && prior.resolved >= prior.total);
      if (!isPriorComplete) {
        return true;
      }
    }
  }
  return false;
}

function ballotHref(troupe) {
  return `#/judge/ballot?ballotId=${troupe.ballotId}&troupeId=${encodeURIComponent(troupe.troupeId)}`;
}


export function JudgeHomePage({ session }) {
  const profile = session?.judgeProfile;
  const [ballots, setBallots] = useState([]);
  const [loading, setLoading] = useState(() => Boolean(session?.user?.id && profile?.registrationStatus === "REGISTERED"));

  useEffect(() => {
    if (!session?.user?.id || profile?.registrationStatus !== "REGISTERED") {
      setLoading(false);
      return undefined;
    }
    let current = true;
    void apiRequest("/api/v1/judge/ballots?include=progress")
      .then(async (items) => {
        const hasDirectTroupes = Array.isArray(items) && items.length > 0 && Array.isArray(items[0].troupes);
        if (hasDirectTroupes) {
          const processed = items.map((ballot) => ({
            ...ballot,
            total: ballot.totalScores ?? 0,
            resolved: ballot.resolvedScores ?? 0,
            troupes: (ballot.troupes || []).map((t) => ({
              ballotId: ballot.id,
              troupeId: t.troupeId ?? `ballot-${ballot.id}`,
              troupeName: t.troupeName ?? ballot.nightName,
              brandColor: t.brandColor || null,
              nightName: ballot.nightName,
              specialtyName: ballot.specialtyName,
              eventName: ballot.eventName,
              status: ballot.status,
              total: t.total ?? 0,
              resolved: t.resolved ?? 0,
              presentationOrder: t.presentationOrder ?? 0,
            })),
          }));
          if (current) setBallots(processed);
          return;
        }

        // Fallback for mock test environments or legacy endpoints
        const details = await Promise.all(items.map(async (ballot) => {
          try {
            const detail = await apiRequest(`/api/v1/judge/ballots/${ballot.id}`);
            const total = detail.scores.length;
            const resolved = detail.scores.filter((score) => score.evaluationState !== "PENDING").length;
            return { ...ballot, total, resolved, troupes: summarizeTroupes(ballot, detail.scores) };
          } catch {
            return { ...ballot, total: 0, resolved: 0, troupes: [] };
          }
        }));
        if (current) setBallots(details);
      })
      .catch(() => { if (current) setBallots([]); })
      .finally(() => { if (current) setLoading(false); });
    return () => { current = false; };
  }, [profile?.registrationStatus, session?.user?.id]);

  const troupes = ballots.flatMap((ballot) => ballot.troupes || []);
  const closed = troupes.filter((troupe) => troupe.status === "SUBMITTED").length;
  const resolved = troupes.reduce((sum, troupe) => sum + troupe.resolved, 0);
  const total = troupes.reduce((sum, troupe) => sum + troupe.total, 0);
  const progress = total > 0 ? Math.round((resolved / total) * 100) : 0;

  const getState = (troupe, isLocked) => {
    if (isLocked) return { label: "En espera", icon: "🔒", className: "is-locked", statusKey: "LOCKED" };
    if (troupe.status === "SUBMITTED") return { label: "Cerrada", icon: "✓", className: "is-closed", statusKey: "SUBMITTED" };
    if (troupe.resolved === 0) return { label: "Sin empezar", icon: "○", className: "is-pending", statusKey: "PENDING" };
    if (troupe.resolved === troupe.total) return { label: "Lista para revisar", icon: "●", className: "is-ready", statusKey: "SCORED" };
    return { label: "En progreso", icon: "●", className: "is-progress", statusKey: "ACTIVE" };
  };

  // Partición puramente visual (TAREA 1): reutiliza getState + bloqueo
  // secuencial existentes. No es regla de negocio nueva.
  const entries = troupes.map((troupe, index) => {
    const locked = isTroupeLockedInSequence(index, troupes);
    return { troupe, index, locked, state: getState(troupe, locked) };
  });
  const isActionable = (entry) => !entry.locked && entry.troupe.status !== "SUBMITTED";
  const actionable = entries.filter(isActionable);
  const currentEntry = actionable.find((entry) => entry.troupe.resolved > 0)
    ?? actionable[0]
    ?? null;
  const evaluatedEntries = entries.filter((entry) => entry.troupe.status === "SUBMITTED");
  const upcomingEntries = entries.filter((entry) => entry.troupe.status !== "SUBMITTED" && entry !== currentEntry);
  const hasLockedUpcoming = upcomingEntries.some((entry) => entry.locked);

  const currentRemaining = currentEntry ? currentEntry.troupe.total - currentEntry.troupe.resolved : 0;
  const currentCta = currentEntry && currentEntry.troupe.resolved === 0
    ? "Comenzar evaluación →"
    : "Continuar evaluación →";

  return (
    <PageShell layer="instrument" className="judge-home judge-operation-shell">
      <section className="judge-home-intro">
        <p className="eyebrow">Noche de competencia</p>
        <h1>Buenas noches, {session?.user?.name?.split(" ")[0] ?? "Jurado"}</h1>
        <p>{troupes[0] ? `${troupes[0].nightName} · ${troupes[0].specialtyName}` : "Tus planillas habilitadas aparecerán aquí."}</p>
      </section>
      <section className="judge-progress-card" aria-label="Progreso general">
        <ProgressBar
          value={resolved}
          max={total}
          label="Progreso de la noche"
          sublabel={`${closed} de ${troupes.length} comparsas confirmadas`}
        />
        {progress === 100 && troupes.length > 0 && (
          <div className="judge-completion-message">
            <span className="completion-icon" aria-hidden="true">✓</span>
            <div>
              <strong>Votación completada</strong>
              <p>Confirmaste las {troupes.length} comparsas asignadas.</p>
              <p>No tenés votaciones pendientes.</p>
            </div>
          </div>
        )}
      </section>
      <section className="judge-home-content">
        {!profile && <p>Tu cuenta tiene rol JUDGE, pero no está vinculada a un perfil del padrón. Contactá a un administrador.</p>}
        {profile?.registrationStatus === "SUSPENDED" && <div className="suspension-notice" role="alert"><h2>Acceso suspendido</h2><p>Tus sesiones operativas fueron revocadas. Contactá a la administración para revisar tu estado.</p></div>}
        {profile?.registrationStatus === "REGISTERED" && loading && <p role="status">Cargando tus planillas…</p>}
        {profile?.registrationStatus === "REGISTERED" && !loading && ballots.length === 0 && <div className="empty-state"><h2>Registro completo</h2><p>Todavía no tenés planillas habilitadas. Una asignación no abre votación por sí sola.</p></div>}
        {profile?.registrationStatus === "REGISTERED" && troupes.length > 0 && (
          <>
            {currentEntry && (
              <section aria-label="Comparsa actual" className="judge-now">
                <p className="eyebrow">Ahora</p>
                <article className="judge-now-card">
                  <h2 className="sr-only">Comparsa actual</h2>
                  {currentEntry.troupe.brandColor && (
                    <div
                      className="troupe-brand-stripe"
                      style={{ backgroundColor: currentEntry.troupe.brandColor }}
                      aria-hidden="true"
                    />
                  )}
                  <div className="judge-now-header">
                    <p className="eyebrow">{currentEntry.troupe.nightName} · {currentEntry.troupe.specialtyName}</p>
                    <StatusPill status={currentEntry.state.statusKey} label={currentEntry.state.label} />
                  </div>
                  <h3>{currentEntry.troupe.troupeName}</h3>
                  <ProgressBar
                    value={currentEntry.troupe.resolved}
                    max={currentEntry.troupe.total}
                    sublabel={`${currentEntry.troupe.resolved} de ${currentEntry.troupe.total} ítems completados`}
                  />
                  {currentRemaining > 1 && <p className="judge-now-remaining">Faltan {currentRemaining} puntuaciones</p>}
                  {currentRemaining === 1 && <p className="judge-now-remaining">Falta 1 puntuación</p>}
                  {currentRemaining === 0 && <p className="judge-now-remaining">Todos los ítems puntuados. Revisá y confirmá la planilla.</p>}
                  <a className="button-link judge-now-cta" href={ballotHref(currentEntry.troupe)}>
                    {currentCta}
                  </a>
                </article>
              </section>
            )}
            {(evaluatedEntries.length > 0 || upcomingEntries.length > 0) && (
              <div className="judge-lists">
            {evaluatedEntries.length > 0 && (
              <section aria-label="Comparsas evaluadas" className="judge-evaluated">
                <h2 className="judge-section-title">Evaluadas</h2>
                <ul className="judge-list">
                  {evaluatedEntries.map((entry) => (
                    <li key={`${entry.troupe.ballotId}-${entry.troupe.troupeId}`} className="judge-list-row is-evaluated">
                      <span className="judge-list-check" aria-hidden="true">✓</span>
                      <div className="judge-list-main">
                        <h3>{entry.troupe.troupeName}</h3>
                        <p>Planilla confirmada</p>
                      </div>
                      <a className="button-link secondary judge-list-action" href={ballotHref(entry.troupe)}>
                        Ver planilla →
                      </a>
                    </li>
                  ))}
                </ul>
              </section>
            )}
            {upcomingEntries.length > 0 && (
              <section aria-label="Próximas comparsas" className="judge-upcoming">
                <h2 className="judge-section-title">Próximas</h2>
                {hasLockedUpcoming && (
                  <p className="judge-note">Las siguientes comparsas se habilitan según el orden de pasada.</p>
                )}
                <ul className="judge-list">
                  {upcomingEntries.map((entry) => (
                    <li key={`${entry.troupe.ballotId}-${entry.troupe.troupeId}`} className={`judge-list-row${entry.locked ? " is-locked" : ""}`}>
                      <span className="judge-list-order" aria-hidden="true">{entry.index + 1}</span>
                      <div className="judge-list-main">
                        <h3>{entry.troupe.troupeName}</h3>
                        <p>{entry.troupe.specialtyName}</p>
                      </div>
                      <StatusPill status={entry.state.statusKey} label={entry.state.label} />
                      {!entry.locked && (
                        <a className="button-link secondary judge-list-action" href={ballotHref(entry.troupe)}>
                          {entry.troupe.resolved === 0 ? "Comenzar evaluación →" : "Continuar evaluación →"}
                        </a>
                      )}
                    </li>
                  ))}
                </ul>
              </section>
            )}
              </div>
            )}
          </>
        )}
      </section>
    </PageShell>
  );
}
