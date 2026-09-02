import { useCallback, useEffect, useRef, useState } from "react";
import { useCountdown } from "./useCountdown.js";
import { useCeremonialDraw } from "./useCeremonialDraw.js";

const COUNTDOWN_SECONDS = 5;

function getTroupeName(troupes, id) {
  const troupe = troupes.find((item) => (item.id ?? item.troupeId) === id);
  return troupe?.name ?? id;
}

function drawErrorMessage(error) {
  if (error?.code === "TIE_BREAKER_ALREADY_DRAWN") return "El sorteo ya fue registrado. Cerrá este cuadro para consultar el resultado.";
  if (error?.code === "TIE_BREAKER_STALE") return "El empate cambió. Cerrá y volvé a cargar los resultados antes de sortear.";
  if (error?.code === "RESULTS_NOT_RELEASED") return "Los resultados todavía no fueron liberados.";
  return "No se pudo registrar el sorteo. Reintentá.";
}

export function CeremonialDrawModal({
  eventId,
  remainingTroupeIds,
  tiedTroupeNames = [],
  onClose,
  onResolved,
  triggerRef,
}) {
  const startButtonRef = useRef(null);
  const dialogRef = useRef(null);
  const [phase, setPhase] = useState("IDLE");
  const [resolvedDraw, setResolvedDraw] = useState(null);
  const { execute, error, loadRecorded } = useCeremonialDraw();
  const countdownRunningRef = useRef(false);
  const phaseRef = useRef("IDLE");

  const close = useCallback(() => {
    if (triggerRef?.current instanceof HTMLElement) triggerRef.current.focus();
    onClose?.();
  }, [onClose, triggerRef]);

  const handleComplete = useCallback(async () => {
    setPhase("REVEALING");
    try {
      const result = await execute({ eventId, remainingTroupeIds });
      setResolvedDraw(result);
      setPhase("DONE");
      onResolved?.(result);
    } catch (nextError) {
      if (nextError.code === "TIE_BREAKER_ALREADY_DRAWN") {
        try {
          const result = await loadRecorded(eventId);
          setResolvedDraw(result);
          setPhase("DONE");
          onResolved?.(result);
          return;
        } catch {
          // Preserve the duplicate error when the recorded result cannot load.
        }
      }
      setPhase("IDLE");
    }
  }, [eventId, execute, loadRecorded, onResolved, remainingTroupeIds]);

  const countdown = useCountdown(COUNTDOWN_SECONDS, { onComplete: handleComplete });

  countdownRunningRef.current = countdown.isRunning;
  phaseRef.current = phase;

  useEffect(() => {
    startButtonRef.current?.focus();
    const onKeyDown = (event) => {
      if (event.key === "Escape") {
        event.preventDefault();
        if (phaseRef.current === "REVEALING") return;
        if (countdownRunningRef.current) countdown.cancel();
        close();
        return;
      }
      if (event.key !== "Tab") return;
      const focusable = Array.from(dialogRef.current?.querySelectorAll(
        'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
      ) ?? []);
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [close, countdown.cancel]);

  const start = () => {
    setResolvedDraw(null);
    setPhase("COUNTDOWN");
    countdown.start();
  };

  const cancel = () => {
    countdown.cancel();
    setPhase("IDLE");
    close();
  };

  const winnerName = resolvedDraw
    ? getTroupeName(tiedTroupeNames, resolvedDraw.winnerTroupeId)
    : null;

  return (
    <div className="ceremonial-draw-overlay" role="presentation">
      <section
        className="ceremonial-draw-modal"
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="ceremonial-draw-title"
        aria-describedby="ceremonial-draw-description"
      >
        <div className="ceremonial-draw-content">
          <p className="eyebrow">Desempate · Mejor Comparsa</p>
          <h2 id="ceremonial-draw-title">Sorteo ceremonial</h2>

          {phase === "IDLE" && (
            <>
              <p id="ceremonial-draw-description">
                El empate persiste después de aplicar los criterios reglamentarios.
                El sorteo se registrará en auditoría y no podrá repetirse.
              </p>
              <ul className="ceremonial-draw-pool" aria-label="Comparsas empatadas">
                {remainingTroupeIds.map((id) => (
                  <li key={id}>{getTroupeName(tiedTroupeNames, id)}</li>
                ))}
              </ul>
              {error && <p className="ceremonial-draw-error" role="alert">{drawErrorMessage(error)}</p>}
              <div className="ceremonial-draw-actions">
                <button ref={startButtonRef} type="button" onClick={start}>
                  Iniciar sorteo ceremonial
                </button>
                <button className="secondary" type="button" onClick={close}>Cerrar</button>
              </div>
            </>
          )}

          {(phase === "COUNTDOWN" || phase === "REVEALING") && (
            <>
              <p id="ceremonial-draw-description" aria-live="polite">
                {phase === "REVEALING" ? "Registrando el resultado…" : "El sorteo comenzará al llegar a cero."}
              </p>
              <output className="countdown-display" data-testid="countdown-value" aria-label={`Cuenta regresiva ${countdown.value}`}>
                {countdown.value}
              </output>
              <button className="secondary" type="button" onClick={cancel} disabled={phase === "REVEALING"}>
                Cancelar
              </button>
            </>
          )}

          {phase === "DONE" && resolvedDraw && (
            <div className="winner-reveal" aria-live="assertive">
              <p id="ceremonial-draw-description">Resultado registrado en auditoría</p>
              <span className="winner-reveal-label">La ganadora de Mejor Comparsa es</span>
              <strong>{winnerName}</strong>
              <small>Método: {resolvedDraw.method ?? "MATH_RANDOM_TRACEABLE"}</small>
              <button ref={startButtonRef} type="button" onClick={close}>Cerrar resultado</button>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
