import { useEffect, useState } from "react";
import { apiRequest } from "../api/http.js";

function BuildingIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect width="16" height="20" x="4" y="2" rx="2" ry="2" />
      <path d="M9 22v-4h6v4" />
      <path d="M8 6h.01" /><path d="M16 6h.01" />
      <path d="M12 6h.01" /><path d="M12 10h.01" />
      <path d="M12 14h.01" /><path d="M16 10h.01" />
      <path d="M16 14h.01" /><path d="M8 10h.01" />
      <path d="M8 14h.01" />
    </svg>
  );
}

function ShieldIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
      <path d="m9 12 2 2 4-4" />
    </svg>
  );
}

function UserIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </svg>
  );
}

function HangerIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
    </svg>
  );
}

function GroupIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  );
}

function LockIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect width="18" height="11" x="3" y="11" rx="2" ry="2" />
      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </svg>
  );
}

export function JudgeAssignmentPage({ session, onConfirmed }) {
  const profile = session.judgeProfile;
  const [assignments, setAssignments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!session.user?.id || profile?.registrationStatus !== "REGISTERED") {
      setLoading(false);
      return;
    }
    let current = true;
    void apiRequest("/api/v1/judge/ballots")
      .then(async (items) => {
        if (current) setAssignments(items);
      })
      .catch(() => {
        if (current) setError("No se pudieron cargar las asignaciones.");
      })
      .finally(() => {
        if (current) setLoading(false);
      });
    return () => { current = false; };
  }, [profile?.registrationStatus, session.user?.id]);

  const firstName = session.user?.name?.split(" ")[0] ?? "Jurado";
  const specialtyName = assignments[0]?.specialtyName ?? "Especialidad";
  const nightName = assignments[0]?.nightName ?? "Noche";
  const dateStr = assignments[0]?.eventDate
    ? new Date(assignments[0].eventDate).toLocaleDateString("es-AR", { weekday: "long", day: "numeric", month: "long" })
    : "";

  const handleConfirm = () => {
    if (onConfirmed) onConfirmed();
    else window.location.hash = "#/judge";
  };

  return (
    <main className="assignment-confirm-page">
      <header className="assignment-confirm-header">
        <div className="assignment-confirm-brand">
          <span className="assignment-confirm-icon" aria-hidden="true"><BuildingIcon /></span>
          <div>
            <strong>Carnavales</strong>
            <strong>2027</strong>
          </div>
        </div>
        <span className="status-pill assignment-confirm-online">Sistema online</span>
      </header>

      <section className="assignment-confirm-content">
        <p className="eyebrow">Confirmación de asignación</p>
        <h1>{nightName}</h1>
        {dateStr && <p className="assignment-confirm-date">{dateStr}</p>}

        <div className="assignment-confirm-card">
          <div className="assignment-confirm-card-header">
            <span className="assignment-confirm-shield" aria-hidden="true"><ShieldIcon /></span>
            <h2>Verificación de identidad</h2>
          </div>

          <div className="assignment-confirm-field">
            <span className="assignment-confirm-field-icon" aria-hidden="true"><UserIcon /></span>
            <div>
              <span className="assignment-confirm-field-label">Jurado Designado</span>
              <strong>{session.user?.name ?? "Jurado"}</strong>
            </div>
          </div>

          <div className="assignment-confirm-field">
            <span className="assignment-confirm-field-icon" aria-hidden="true"><HangerIcon /></span>
            <div>
              <span className="assignment-confirm-field-label">Especialidad a Evaluar</span>
              <strong>{specialtyName}</strong>
            </div>
          </div>

          <div className="assignment-confirm-field">
            <span className="assignment-confirm-field-icon" aria-hidden="true"><GroupIcon /></span>
            <div>
              <span className="assignment-confirm-field-label">Comparsas Habilitadas Hoy</span>
              <div className="assignment-confirm-troupe-count">
                <span>Total comparsas a calificar</span>
                <strong>{assignments.length}</strong>
              </div>
            </div>
          </div>

          <p className="assignment-confirm-disclaimer">
            Al confirmar, certifica que usted es el juez asignado para esta noche y
            especialidad. Toda calificación será registrada bajo esta identidad.
          </p>

          <button className="primary-action assignment-confirm-btn" disabled={loading || Boolean(error)} onClick={handleConfirm}>
            <span className="assignment-confirm-btn-icon" aria-hidden="true"><LockIcon /></span>
            {loading ? "Cargando…" : "Confirmar y comenzar"}
          </button>

          <button className="secondary assignment-report-error" type="button">
            Reportar error en asignación
          </button>
        </div>

        <p className="assignment-confirm-footer">Conexión Segura - Protocolo de Jueces V2.4</p>
      </section>
    </main>
  );
}
