/**
 * DialogFooter — Acciones alineadas al pie de un diálogo (Spec 026/T08).
 *
 * Centraliza la clase `.dialog-footer-actions` en un solo componente
 * para no repetir el contenedor en cada modal.
 */
export function DialogFooter({ children }) {
  return <div className="dialog-footer-actions">{children}</div>;
}
