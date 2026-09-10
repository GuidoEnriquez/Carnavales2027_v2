import { useRef } from "react";
import { Dialog } from "./Dialog.jsx";
import { DialogFooter } from "./DialogFooter.jsx";

/**
 * ConfirmDialog — Confirmación para acciones peligrosas/irreversibles
 * (Spec 027/RF-UX-03). Reemplazo accesible de `window.confirm()`.
 *
 * Reutiliza `Dialog` (foco, Escape, backdrop, retorno de foco).
 * Las consecuencias van en `description` (=> `aria-describedby`).
 */
export function ConfirmDialog({
  isOpen,
  onClose,
  onConfirm,
  title,
  description,
  confirmLabel = "Confirmar",
  cancelLabel = "Cancelar",
  confirming = false,
  danger = false,
  focusReturnRef,
}) {
  const confirmRef = useRef(null);

  return (
    <Dialog
      isOpen={isOpen}
      onClose={onClose}
      title={title}
      description={description}
      focusReturnRef={focusReturnRef}
      className="confirm-dialog"
    >
      <DialogFooter>
        <button type="button" className="secondary" onClick={onClose} disabled={confirming}>
          {cancelLabel}
        </button>
        <button
          ref={confirmRef}
          type="button"
          className={danger ? "danger-action" : undefined}
          onClick={onConfirm}
          disabled={confirming}
        >
          {confirming ? "Procesando…" : confirmLabel}
        </button>
      </DialogFooter>
    </Dialog>
  );
}
