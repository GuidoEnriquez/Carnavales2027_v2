import { useCallback, useEffect, useRef, useState } from "react";
import { apiRequest } from "../api/http.js";
import { ConfirmDialog } from "../components/ConfirmDialog.jsx";

const READINESS_LABELS = {
  COMPETITION_NIGHT: "No existe ninguna jornada de competencia configurada",
  ACTIVE_TROUPE: "No hay comparsas activas registradas",
  ACTIVE_SPECIALTY: "No hay especialidades activas configuradas",
  ACTIVE_RUBRIC: "No existe ningun rubro activo",
  INCOMPLETE_TROUPES: "Existen comparsas sin categoria activa",
  INCOMPLETE_RUBRICS: "Existen rubros sin items puntuables o con especialidades inactivas",
};

export function EventReadinessPanel({ event, locked, onOpened, onGoToNights, refreshKey = 0 }) {
  const [readiness, setReadiness] = useState(null);
  const [message, setMessage] = useState("");
  const [opening, setOpening] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const openTriggerRef = useRef(null);
  const requestRevision = useRef(0);

  const load = useCallback(async ({ isCurrent = () => true } = {}) => {
    const revision = ++requestRevision.current;
    try {
      const nextReadiness = await apiRequest(`/api/v1/events/${event.id}/readiness`);
      if (isCurrent() && revision === requestRevision.current) {
        setReadiness(nextReadiness);
        setMessage("");
      }
    } catch {
      if (isCurrent() && revision === requestRevision.current) setMessage("No se pudo consultar preparacion.");
    }
  }, [event.id]);

  useEffect(() => {
    let current = true;
    void load({ isCurrent: () => current });
    return () => { current = false; };
  }, [load, refreshKey]);

  const open = async () => {
    requestRevision.current += 1;
    setConfirmOpen(false);
    setOpening(true);
    try {
      const openedEvent = await apiRequest(`/api/v1/events/${event.id}/open`, { method: "POST" });
      setMessage("Evento abierto.");
      onOpened?.(openedEvent);
      await load();
    } catch (error) {
      if (error.code === "EVENT_CONFIGURATION_INCOMPLETE" && error.details) setReadiness(error.details);
      setMessage(error.code === "EVENT_CONFIGURATION_INCOMPLETE"
        ? "La configuracion cambio y ya no esta completa."
        : "No se pudo abrir el evento.");
    } finally {
      setOpening(false);
    }
  };

  return (
    <section className="config-section readiness-panel">
      <div className="section-heading">
        <h2>Preparacion del evento</h2>
      </div>
      {readiness && (
        <>
          <div className="readiness-summary">
            {readiness.ready ? (
              <p className="readiness-ok">Configuracion completa. El evento esta listo para abrir.</p>
            ) : (
               <p className="readiness-pending">{(readiness.missing?.length ?? 0) + (readiness.incompleteTroupes?.length ?? 0) + (readiness.incompleteRubrics?.length ?? 0)} problema(s) impiden abrir la configuracion.</p>
            )}
          </div>
          <ul className="readiness-checklist">
            {(readiness.missing ?? []).map((code) => (
              <li key={code} className="readiness-fail">
                <span className="readiness-icon">&#x2717;</span>
                {READINESS_LABELS[code] ?? code}{" "}
                {code === "COMPETITION_NIGHT" && onGoToNights ? (
                  <button type="button" className="secondary" onClick={onGoToNights}>Ir al problema</button>
                ) : (
                  <a href="#/admin/competencia">Ir al problema</a>
                )}
              </li>
            ))}
            {(readiness.incompleteTroupes ?? []).map((troupe) => (
              <li key={troupe.id} className="readiness-fail">
                <span className="readiness-icon">&#x2717;</span>
                La comparsa &ldquo;{troupe.name}&rdquo; no tiene categoria activa{" "}
                <a href="#/admin/competencia">Ir al problema</a>
              </li>
            ))}
            {(readiness.incompleteRubrics ?? []).map((rubric) => (
              <li key={rubric.id} className="readiness-fail">
                <span className="readiness-icon">&#x2717;</span>
                El rubro &ldquo;{rubric.name}&rdquo; no tiene items puntuables validos{" "}
                <a href="#/admin/competencia">Ir al problema</a>
              </li>
            ))}
            {readiness.ready && (
              <>
                <li className="readiness-ok-item"><span className="readiness-icon">&#x2713;</span> Jornadas de competencia configuradas</li>
                <li className="readiness-ok-item"><span className="readiness-icon">&#x2713;</span> Comparsas activas</li>
                <li className="readiness-ok-item"><span className="readiness-icon">&#x2713;</span> Especialidades activas</li>
                <li className="readiness-ok-item"><span className="readiness-icon">&#x2713;</span> Rubros activos con items validos</li>
              </>
            )}
          </ul>
          <button ref={openTriggerRef} className="danger-action" disabled={locked || opening || !readiness.ready} onClick={() => setConfirmOpen(true)}>
            {opening ? "Abriendo..." : "Abrir evento"}
          </button>
          <ConfirmDialog
            isOpen={confirmOpen}
            onClose={() => setConfirmOpen(false)}
            onConfirm={() => void open()}
            title="Abrir evento"
            description="Abrir el evento bloqueará toda su configuración. ¿Querés continuar?"
            confirmLabel="Abrir evento"
            confirming={opening}
            danger
            focusReturnRef={openTriggerRef}
          />
        </>
      )}
      <p role="status" aria-live="polite">{message}</p>
    </section>
  );
}
