import { useCallback, useEffect, useRef, useState } from "react";
import { apiRequest } from "../../api/http.js";

function getErrorMessage(error) {
  if (error?.code === "RESULTS_ALREADY_RELEASED") {
    return "Los resultados ya fueron liberados. No se puede revocar la penalización.";
  }
  if (error?.code === "RESULTS_ACCESS_DENIED" || error?.code === "PENALTIES_ACCESS_DENIED") {
    return "No tenés permisos para revocar penalizaciones.";
  }
  if (error?.code === "TWO_FACTOR_REQUIRED") {
    return "Se requiere verificación en dos pasos (2FA).";
  }
  if (error?.code === "CANNOT_MUTATE_REVOKED_PENALTY") {
    return "La penalización ya fue revocada previamente.";
  }
  if (error?.code === "VALIDATION_ERROR") {
    return "El motivo de revocación es obligatorio.";
  }
  return error?.message || "No se pudo revocar la penalización.";
}

export function RevokePenaltyModal({
  penalty,
  eventId,
  triggerRef,
  onClose,
  onRevoked,
}) {
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const dialogRef = useRef(null);
  const reasonInputRef = useRef(null);

  const close = useCallback(() => {
    if (triggerRef?.current instanceof HTMLElement) {
      triggerRef.current.focus();
    }
    onClose?.();
  }, [onClose, triggerRef]);

  useEffect(() => {
    reasonInputRef.current?.focus();

    const onKeyDown = (event) => {
      if (event.key === "Escape") {
        event.preventDefault();
        close();
        return;
      }
      if (event.key !== "Tab") return;

      const focusable = Array.from(
        dialogRef.current?.querySelectorAll(
          'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
        ) ?? [],
      );
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
  }, [close]);

  const handleSubmit = async (event) => {
    event.preventDefault();
    const cleanReason = reason.trim();
    if (!cleanReason) {
      setError("El motivo de revocación es obligatorio.");
      return;
    }

    setSubmitting(true);
    setError("");
    try {
      const revoked = await apiRequest(
        `/api/v1/events/${eventId}/penalties/${penalty.id}/revoke`,
        {
          method: "POST",
          body: JSON.stringify({ revocationReason: cleanReason }),
        },
      );
      onRevoked?.(revoked);
      close();
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="penalty-modal-overlay" role="presentation">
      <section
        className="penalty-modal"
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="revoke-modal-title"
        aria-describedby="revoke-modal-desc"
      >
        <form onSubmit={handleSubmit} className="penalty-modal-content">
          <p className="eyebrow">Comisariato · Auditoría</p>
          <h2 id="revoke-modal-title">Revocar sanción</h2>
          <p id="revoke-modal-desc">
            Estás por anular la sanción de <strong>{penalty.penaltyPoints} pts</strong> a{" "}
            <strong>{penalty.troupeName}</strong> ({penalty.nightName}). Esta acción transicionará la
            penalización a estado REVOKED y quedará asentada en el registro de auditoría.
          </p>

          <div className="penalty-summary-box">
            <p className="summary-item">
              <span>Motivo original:</span> <em>"{penalty.reason}"</em>
            </p>
          </div>

          <label htmlFor="revocation-reason">
            Motivo reglamentario de la revocación
            <textarea
              id="revocation-reason"
              ref={reasonInputRef}
              value={reason}
              onChange={(e) => {
                setReason(e.target.value);
                if (error) setError("");
              }}
              rows={3}
              placeholder="Describí el motivo o justificación de la revocación..."
              required
            />
          </label>

          {error && (
            <p className="penalty-modal-error" role="alert">
              {error}
            </p>
          )}

          <div className="penalty-modal-actions">
            <button type="submit" disabled={submitting || !reason.trim()}>
              {submitting ? "Revocando..." : "Confirmar revocación"}
            </button>
            <button
              type="button"
              className="secondary"
              onClick={close}
              disabled={submitting}
            >
              Cancelar
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}
