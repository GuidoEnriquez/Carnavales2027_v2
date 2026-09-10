import { useEffect, useRef, useId } from "react";

/**
 * Dialog — Componente modal nativo y plenamente accesible (Spec 020 / RF-178)
 * Basado en <dialog> HTML5 con focus trap nativo, retorno de foco (focusReturnRef),
 * cierre por Escape o click en backdrop, y vinculación de ARIA labels.
 */
export function Dialog({
  isOpen,
  onClose,
  title,
  description,
  children,
  focusReturnRef,
  className = "",
  ariaLabel,
}) {
  const dialogRef = useRef(null);
  const titleId = useId();
  const descId = useId();
  const prevOpenRef = useRef(false);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (isOpen && !dialog.open) {
      dialog.showModal();
      prevOpenRef.current = true;
    } else if (!isOpen && dialog.open) {
      dialog.close();
      if (prevOpenRef.current && focusReturnRef?.current) {
        focusReturnRef.current.focus();
      }
      prevOpenRef.current = false;
    }
  }, [isOpen, focusReturnRef]);

  // Manejar el evento nativo de cancelación (tecla ESC)
  const handleCancel = (event) => {
    event.preventDefault();
    if (onClose) onClose();
  };

  // Manejar click en el backdrop (fuera de la caja modal)
  const handleClick = (event) => {
    if (event.target === dialogRef.current && onClose) {
      onClose();
    }
  };

  if (!isOpen && !dialogRef.current?.open) {
    return null;
  }

  return (
    <dialog
      ref={dialogRef}
      className={`app-dialog ${className}`.trim()}
      aria-modal="true"
      onCancel={handleCancel}
      onClick={handleClick}
      aria-labelledby={title ? titleId : undefined}
      aria-describedby={description ? descId : undefined}
      aria-label={!title && ariaLabel ? ariaLabel : undefined}
    >
      <div className="app-dialog-content">
        {title && (
          <header className="app-dialog-header">
            <h2 id={titleId} className="app-dialog-title">
              {title}
            </h2>
            {onClose && (
              <button
                type="button"
                className="app-dialog-close-btn"
                onClick={onClose}
                aria-label="Cerrar diálogo"
              >
                ✕
              </button>
            )}
          </header>
        )}
        {description && (
          <p id={descId} className="app-dialog-description">
            {description}
          </p>
        )}
        <div className="app-dialog-body">{children}</div>
      </div>
    </dialog>
  );
}
