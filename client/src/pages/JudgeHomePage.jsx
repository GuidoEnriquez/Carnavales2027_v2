import { useEffect, useState } from "react";
import { apiRequest } from "../api/http.js";

export function JudgeHomePage({ session }) {
  const profile = session.judgeProfile;
  const [assignments, setAssignments] = useState([]);
  useEffect(() => {
    if (!session.user?.id || profile?.registrationStatus !== "REGISTERED") return undefined;
    let current = true;
    void apiRequest("/api/v1/judge/assignments").then((items) => { if (current) setAssignments(items); }).catch(() => { if (current) setAssignments([]); });
    return () => { current = false; };
  }, [profile?.registrationStatus, session.user?.id]);
  return (
    <main className="container judge-home">
      <div className="card">
        <p className="eyebrow">Acceso de jurado</p>
        <h1>Mi panel</h1>
        {!profile && <p>Tu cuenta tiene rol JUDGE, pero no está vinculada a un perfil del padrón. Contactá a un administrador.</p>}
        {profile?.registrationStatus === "SUSPENDED" && <div className="suspension-notice" role="alert"><h2>Acceso suspendido</h2><p>Tus sesiones operativas fueron revocadas. Contactá a la administración para revisar tu estado.</p></div>}
         {profile?.registrationStatus === "REGISTERED" && assignments.length === 0 && <div className="empty-state"><h2>Registro completo</h2><p>Todavía no tenés asignaciones activas. El registro y el rol JUDGE no habilitan votación.</p></div>}
         {profile?.registrationStatus === "REGISTERED" && assignments.length > 0 && <section aria-label="Mis asignaciones"><h2>Mis asignaciones activas</h2><div className="assignment-grid">{assignments.map((assignment) => <article className="assignment-card" key={assignment.id}><p className="eyebrow">{assignment.eventName}</p><h3>{assignment.nightName}</h3><p>{assignment.specialtyName} · {assignment.assignmentType === "SUBSTITUTE" ? "Suplente" : "Titular"}</p><p className="muted">La carga de puntuaciones se habilitará en un incremento posterior.</p></article>)}</div></section>}
      </div>
    </main>
  );
}
