import { useCallback, useEffect, useRef, useState } from "react";

function normalizeSeconds(seconds) {
  if (!Number.isFinite(seconds) || seconds < 0) return 0;
  return Math.floor(seconds);
}

/**
 * Cuenta regresivamente desde `seconds` hasta cero.
 *
 * `onComplete` se ejecuta una sola vez por cada ciclo iniciado. El callback
 * se mantiene en un ref para que pueda cambiar sin reiniciar el intervalo.
 */
export function useCountdown(seconds, { onComplete } = {}) {
  const initialSeconds = normalizeSeconds(seconds);
  const [value, setValue] = useState(initialSeconds);
  const [isRunning, setIsRunning] = useState(false);
  const timerRef = useRef(null);
  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;

  const clearTimer = useCallback(() => {
    if (timerRef.current !== null) {
      window.clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const cancel = useCallback(() => {
    clearTimer();
    setValue(initialSeconds);
    setIsRunning(false);
  }, [clearTimer, initialSeconds]);

  const start = useCallback(() => {
    clearTimer();
    setValue(initialSeconds);
    setIsRunning(true);

    timerRef.current = window.setInterval(() => {
      setValue((current) => {
        if (current <= 1) {
          clearTimer();
          setIsRunning(false);
          onCompleteRef.current?.();
          return 0;
        }
        return current - 1;
      });
    }, 1000);
  }, [clearTimer, initialSeconds]);

  useEffect(() => () => clearTimer(), [clearTimer]);

  return { value, isRunning, start, cancel };
}
