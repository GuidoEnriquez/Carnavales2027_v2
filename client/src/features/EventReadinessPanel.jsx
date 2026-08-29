import { useCallback, useEffect, useState } from "react";
import { apiRequest } from "../api/http.js";

export function EventReadinessPanel({ event, locked, onOpened, refreshKey = 0 }) {
  const [readiness, setReadiness] = useState(null);
  const [message, setMessage] = useState("");

  const load = useCallback(async ({ isCurrent = () => true } = {}) => {
    try {
      const nextReadiness = await apiRequest(`/api/v1/events/${event.id}/readiness`);
      if (isCurrent()) {
        setReadiness(nextReadiness);
        setMessage("");
      }
    } catch {
      if (isCurrent()) setMessage("No se pudo consultar readiness.");
    }
  }, [event.id]);

  useEffect(() => {
    let current = true;
    void load({ isCurrent: () => current });
    return () => { current = false; };
  }, [load, refreshKey]);

  const open = async () => {
    try {
      const openedEvent = await apiRequest(`/api/v1/events/${event.id}/open`, { method: "POST" });
      setMessage("Evento abierto.");
      onOpened?.(openedEvent);
      await load();
    } catch {
      setMessage("El evento todavía no está listo.");
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
          <button disabled={locked || !readiness.ready} onClick={open}>Abrir evento</button>
        </>
      )}
      <p>{message}</p>
    </section>
  );
}
