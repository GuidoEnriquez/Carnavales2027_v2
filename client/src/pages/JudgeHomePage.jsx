import { useEffect, useState } from "react";
import { apiRequest } from "../api/http.js";

function summarizeTroupes(ballot, scores) {
  const groups = scores.reduce((result, score) => {
    const id = score.nightScheduleId ?? `ballot-${ballot.id}`;
    if (!result[id]) result[id] = {
      ballotId: ballot.id,
      troupeId: id,
      troupeName: score.troupeName ?? ballot.nightName,
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

export function JudgeHomePage({ session }) {
  const profile = session.judgeProfile;
  const [ballots, setBallots] = useState([]);
  const [loading, setLoading] = useState(() => Boolean(session.user?.id && profile?.registrationStatus === "REGISTERED"));
  useEffect(() => {
    if (!session.user?.id || profile?.registrationStatus !== "REGISTERED") {
      setLoading(false);
      return undefined;
    }
    let current = true;
    void apiRequest("/api/v1/judge/ballots")
      .then(async (items) => {
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
  }, [profile?.registrationStatus, session.user?.id]);

  const troupes = ballots.flatMap((ballot) => ballot.troupes);
  const closed = troupes.filter((troupe) => troupe.status === "SUBMITTED").length;
  const resolved = troupes.reduce((sum, troupe) => sum + troupe.resolved, 0);
  const total = troupes.reduce((sum, troupe) => sum + troupe.total, 0);
  const progress = total > 0 ? Math.round((resolved / total) * 100) : 0;

  const getState = (ballot) => {
    if (ballot.status === "SUBMITTED") return { label: "Cerrada", icon: "✓", className: "is-closed" };
    if (ballot.resolved === 0) return { label: "Sin empezar", icon: "○", className: "is-pending" };
    if (ballot.resolved === ballot.total) return { label: "Lista para revisar", icon: "●", className: "is-ready" };
    return { label: "En progreso", icon: "●", className: "is-progress" };
  };

  return (
    <main className="judge-home judge-operation-shell">
      <section className="judge-home-intro">
        <p className="eyebrow">Noche de competencia</p>
        <h1>Buenas noches, {session.user?.name?.split(" ")[0] ?? "Jurado"}</h1>
        <p>{troupes[0] ? `${troupes[0].nightName} · ${troupes[0].specialtyName}` : "Tus planillas habilitadas aparecerán aquí."}</p>
      </section>
      <section className="judge-progress-card" aria-label="Progreso general">
        <div><span>Progreso general</span><span>Comparsas evaluadas {closed} / {troupes.length}</span></div>
        <div className="progress-track" aria-label={`${progress}% completado`}><span style={{ inlineSize: `${progress}%` }} /></div>
        {progress === 100 && (
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
         {profile?.registrationStatus === "REGISTERED" && troupes.length > 0 && <section aria-label="Mis planillas"><div className="judge-section-heading"><div><p className="eyebrow">Tus comparsas</p><h2>Tu noche de votación</h2></div><span>{troupes.length} comparsas</span></div><div className="judge-ballot-grid">{troupes.map((troupe) => {
           const state = getState(troupe);
           const ballotProgress = troupe.total > 0 ? Math.round((troupe.resolved / troupe.total) * 100) : 0;
           return <article className={`judge-ballot-card ${state.className}`} key={`${troupe.ballotId}-${troupe.troupeId}`}>
             <div className="judge-ballot-card-header"><div><p className="eyebrow">{troupe.nightName} · {troupe.specialtyName}</p><h3>{troupe.troupeName}</h3></div><span className="judge-status-badge"><span aria-hidden="true">{state.icon}</span> {state.label}</span></div>
             {troupe.status === "SUBMITTED" ? <p className="judge-locked-copy"><span aria-hidden="true">🔒</span> Planilla confirmada</p> : <p className="judge-item-count">{troupe.resolved}/{troupe.total} ítems completados</p>}
             <a className="button-link" href={`#/judge/ballot?ballotId=${troupe.ballotId}&troupeId=${encodeURIComponent(troupe.troupeId)}`}>{troupe.status === "SUBMITTED" ? "Ver planilla" : troupe.resolved === 0 ? "Comenzar" : "Continuar"}<span aria-hidden="true"> →</span></a>
           </article>;
         })}</div></section>}
      </section>
    </main>
  );
}
