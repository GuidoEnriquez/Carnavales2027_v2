/**
 * PageShell — Contenedor principal de página (Spec 026/T07).
 *
 * Centraliza el contrato `data-layer` (Spec 020/RF-177, Spec 023):
 * `brand` para pantallas institucionales, `instrument` para operativas.
 * Reenvía props adicionales (p. ej. `aria-busy`, `id`) al `<main>`.
 */
export function PageShell({ layer, className = "", children, ...rest }) {
  return (
    <main className={className} data-layer={layer} {...rest}>
      {children}
    </main>
  );
}
