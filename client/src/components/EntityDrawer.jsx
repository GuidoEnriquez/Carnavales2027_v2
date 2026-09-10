import { Dialog } from "./Dialog.jsx";

/**
 * EntityDrawer — Edición de un registro en panel lateral accesible
 * (Spec 027/RF-UX-03). Para formularios simples se usa modal;
 * para edición de registro, drawer. Implementado sobre `Dialog`
 * nativo para reutilizar foco/Escape/backdrop sin duplicar lógica.
 */
export function EntityDrawer({
  isOpen,
  onClose,
  title,
  description,
  children,
  focusReturnRef,
  className = "",
}) {
  return (
    <Dialog
      isOpen={isOpen}
      onClose={onClose}
      title={title}
      description={description}
      focusReturnRef={focusReturnRef}
      className={`entity-drawer ${className}`.trim()}
    >
      {children}
    </Dialog>
  );
}
