import { useCallback, useEffect, useRef, useState } from "react";
import { apiRequest } from "../api/http.js";

export function EventReadinessPanel({ event, locked, onOpened, refreshKey = 0 }) {
  const [readiness, setReadiness] = useState(null);
  const [message, setMessage] = useState("");
  const [opening, setOpening] = useState(false);
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
      if (isCurrent() && revision === requestRevision.current) setMessage("No se pudo consultar readiness.");
    }
  }, [event.id]);

  useEffect(() => {
    let current = true;
    void load({ isCurrent: () => current });
    return () => { current = false; };
  }, [load, refreshKey]);

  const open = async () => {
    if (!window.confirm("Abrir el evento bloqueará toda su configuración. ¿Querés continuar?")) return;
    requestRevision.current += 1;
    setOpening(true);
    try {
      const openedEvent = await apiRequest(`/api/v1/events/${event.id}/open`, { method: "POST" });
      setMessage("Evento abierto.");
      onOpened?.(openedEvent);
      await load();
    } catch (error) {
      if (error.code === "EVENT_CONFIGURATION_INCOMPLETE" && error.details) setReadiness(error.details);
      setMessage(error.code === "EVENT_CONFIGURATION_INCOMPLETE"
        ? "La configuración cambió y ya no está completa."
        : "No se pudo abrir el evento.");
    } finally {
      setOpening(false);
    }
  };

  return (
    <section>
      <h2>Readiness</h2>
      {readiness && (
        <>
          <p>{readiness.ready ? "Configuración completa" : "Faltan elementos"}</p>
          <ul>
            {readiness.missing.map((item) => <li key={item}>{item}</li>)}
            {readiness.incompleteTroupes.map((troupe) => <li key={troupe.id}>{troupe.name}</li>)}
            {readiness.incompleteRubrics.map((rubric) => <li key={rubric.id}>{rubric.code}</li>)}
          </ul>
          <button className="danger-action" disabled={locked || opening || !readiness.ready} onClick={open}>
            {opening ? "Abriendo…" : "Abrir evento"}
          </button>
        </>
      )}
      <p role="status" aria-live="polite">{message}</p>
    </section>
  );
}
