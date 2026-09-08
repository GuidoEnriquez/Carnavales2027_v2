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
          label="Progreso general"
          sublabel={`Comparsas evaluadas ${closed} / ${troupes.length}`}
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
          <section aria-label="Mis planillas">
            <div className="judge-section-heading">
              <div>
                <p className="eyebrow">Tus comparsas</p>
                <h2>Tu noche de votación</h2>
              </div>
              <span>{troupes.length} comparsas</span>
            </div>
            <div className="judge-ballot-grid">
              {troupes.map((troupe, index) => {
                const isLocked = isTroupeLockedInSequence(index, troupes);
                const state = getState(troupe, isLocked);
                return (
                  <article
                    className={`judge-ballot-card ${state.className}`}
                    key={`${troupe.ballotId}-${troupe.troupeId}`}
                  >
                    {troupe.brandColor && (
                      <div
                        className="troupe-brand-stripe"
                        style={{ backgroundColor: troupe.brandColor }}
                        aria-hidden="true"
                      />
                    )}
                    <div className="judge-ballot-card-header">
                      <div>
                        <p className="eyebrow">{troupe.nightName} · {troupe.specialtyName}</p>
                        <h3>{troupe.troupeName}</h3>
                      </div>
                      <StatusPill status={state.statusKey} label={state.label} />
                    </div>
                    {isLocked ? (
                      <p className="judge-locked-copy is-waiting">
                        <span aria-hidden="true">🔒</span> Se habilitará al completar la comparsa anterior
                      </p>
                    ) : troupe.status === "SUBMITTED" ? (
                      <p className="judge-locked-copy"><span aria-hidden="true">🔒</span> Planilla confirmada</p>
                    ) : (
                      <p className="judge-item-count">{troupe.resolved}/{troupe.total} ítems completados</p>
                    )}
                    {isLocked ? (
                      <button
                        type="button"
                        className="button-link is-disabled"
                        disabled
                        aria-disabled="true"
                        title="Se habilitará al completar la comparsa anterior"
                      >
                        <span>🔒 En espera de pasada</span>
                      </button>
                    ) : (
                      <a
                        className="button-link"
                        href={`#/judge/ballot?ballotId=${troupe.ballotId}&troupeId=${encodeURIComponent(troupe.troupeId)}`}
                      >
                        {troupe.status === "SUBMITTED" ? "Ver planilla" : troupe.resolved === 0 ? "Comenzar" : "Continuar"}
                      </a>
                    )}
                  </article>
                );
              })}
            </div>
          </section>
        )}
      </section>
    </PageShell>
  );
}
