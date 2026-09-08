# Clarificaciones — Spec 026

### 1. Sin framework (2026-09-08)

Decisión del usuario (opción 1): optimizar con utilidades internas y componentes compartidos. Bootstrap queda descartado (componentes/JS y defaults ajenos al sistema). Tailwind queda como alternativa solo si una fase demuestra insuficiencia, con piloto acotado y nueva aprobación; este spec no lo autoriza.

### 2. Excepción de impresión (2026-09-08)

El bloque documental claro de `scrutiny.css` y `@media print` se preserva por fidelidad notarial (Spec 015). Solo se admite tokenización con equivalencia píxel a píxel verificada; cualquier cambio de tono del documento impreso queda fuera de alcance.

### 3. Wallboard y marca (2026-09-08)

El modo pared de sala (`is-wallboard`) y los acentos festivos de la capa `brand` (magenta `#e11d74`, dorado `#f5b301`, turquesa `#14b8a6`) se preservan. La tokenización en esas zonas debe demostrar equivalencia; no se rediseña contraste de proyectores en este incremento.

### 4. Orden de imports y `utilities.css` (2026-09-08)

`utilities.css` se importa al final de `index.css` (tras `competencia.css`) para que las utilidades de layout puedan componer sobre componentes con igual especificidad. `tokens.test.js` se actualiza para validar el nuevo orden; ningún otro módulo declara `:root`.

### 5. Reconciliación del refactor pendiente (2026-09-08)

El working tree contiene un refactor de diseño sin `spec`/`tasks` (tokens nuevos, eliminación del bloque legacy, cambios de `data-layer`, clases utilitarias, `border-radius`, `font-weight`, `EventCard.jsx`). Conforme a "Cero código sin spec", ese trabajo no se convalida en bloque: cada tarea de este spec lo re-ejecuta o lo revierte según corresponda, con evidencia propia. En particular, la eliminación del bloque legacy de `tokens.css` cambió valores efectivos (`--primary-color`, `--border-radius`, fondos de toast), por lo que excede las unidades T07–T18 y exige validación visual explícita antes de aceptarse.

### 6. `EventCard.jsx` (2026-09-08)

Componente nuevo sin seguimiento (untracked), usado por el wrapper de Competencia en `App.jsx`. La T01 decide con evidencia: adoptarlo con tests o revertirlo al listado anterior. Sin decisión registrada, no se toca.

### 7. Borrados en `.hermes/plans/` (2026-09-08)

Los 8 borrados staged de planes históricos quedan fuera de este spec; su destino requiere autorización explícita y no se mezclan con el refactor.
