import { useEffect, useState } from "react";
import { apiRequest } from "../api/http.js";

export function JudgeHomePage({ session }) {
  const profile = session.judgeProfile;
  const [ballots, setBallots] = useState([]);
  useEffect(() => {
    if (!session.user?.id || profile?.registrationStatus !== "REGISTERED") return undefined;
    let current = true;
    void apiRequest("/api/v1/judge/ballots").then((items) => { if (current) setBallots(items); }).catch(() => { if (current) setBallots([]); });
    return () => { current = false; };
  }, [profile?.registrationStatus, session.user?.id]);
  return (
    <main className="container judge-home">
      <div className="card">
        <p className="eyebrow">Acceso de jurado</p>
        <h1>Mi panel</h1>
        {!profile && <p>Tu cuenta tiene rol JUDGE, pero no está vinculada a un perfil del padrón. Contactá a un administrador.</p>}
        {profile?.registrationStatus === "SUSPENDED" && <div className="suspension-notice" role="alert"><h2>Acceso suspendido</h2><p>Tus sesiones operativas fueron revocadas. Contactá a la administración para revisar tu estado.</p></div>}
          {profile?.registrationStatus === "REGISTERED" && ballots.length === 0 && <div className="empty-state"><h2>Registro completo</h2><p>Todavía no tenés planillas habilitadas. Una asignación no abre votación por sí sola.</p></div>}
          {profile?.registrationStatus === "REGISTERED" && ballots.length > 0 && <section aria-label="Mis planillas"><h2>Mis planillas</h2><div className="assignment-grid">{ballots.map((ballot) => <article className="assignment-card" key={ballot.id}><p className="eyebrow">{ballot.eventName}</p><h3>{ballot.nightName}</h3><p>{ballot.specialtyName} · {ballot.status === "SUBMITTED" ? "Confirmada" : ballot.status === "REOPENED" ? "Reabierta" : "En carga"}</p><a className="button-link" href={`#/judge/ballot?ballotId=${ballot.id}`}>{ballot.status === "SUBMITTED" ? "Ver planilla" : "Completar planilla"}</a></article>)}</div></section>}
      </div>
    </main>
  );
}
