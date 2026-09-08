# Spec 026 — Optimización de Diseño sin Framework (Deuda Técnica)

## Estado

- **Fase SDD:** Especificación propuesta / pendiente de aprobación (2026-09-08).
- **Fuente:** Auditoría del working tree del 2026-09-08; Specs 020 (sistema de diseño) y 023 (capas Marca/Instrumento).
- **Relación:** Continúa la consolidación CSS de Spec 020 (T07–T18, cerradas) sin reabrirlas. No altera reglas de negocio, autenticación, votación, resultados, penalizaciones, actas, API ni BD.

---

## Objetivo

Reducir la redundancia del cliente (CSS duplicado, hex fuera de tokens, patrones JSX repetidos) sin cambio visual ni funcional y sin introducir Bootstrap, Tailwind ni ninguna dependencia nueva.

---

## Alcance

### Incluye

1. **Inventario y código muerto:** mapa selector → páginas, eliminación solo de lo probadamente sin uso.
2. **Fuente única por selector:** unificar `.ballot-status-*` (hoy en `index.css` y `judge.css`), login base + override de marca, badges de monitor/workflow.
3. **Tokenización restante:** hex fuera de `tokens.css` en `index.css`, `components.css` (portal/resultados), `judge.css`; fallbacks `var(--x, #hex)` normalizados.
4. **Utilidades internas mínimas:** nuevo `client/src/styles/utilities.css` solo con clases probadamente repetidas (layout/gap/alineación sobre tokens), sin colores literales ni estilos de componente.
5. **Consolidación JSX:** `PageShell` (`data-layer` + `<main>`), footers de diálogo, tarjeta de estado, campo de formulario, tabla/estado vacío, hook `useApiResource` y helpers de formato — cada uno solo tras inventario que lo justifique.
6. **Deuda menor de tests:** corregir el título desactualizado de `AdminResultsPage.test.jsx` (dice `brand`, afirma `instrument`) sin cambiar comportamiento.

### Excluye

- Bootstrap, Tailwind o cualquier dependencia nueva.
- Cambios visuales intencionales, rediseños o nuevas variantes.
- Lógica de autenticación, 2FA, votación, escrutinio, penalizaciones, actas o API.
- Rediseño de la hoja de impresión notarial (`@media print` en `scrutiny.css`) y del contraste del wallboard: solo tokenización con equivalencia verificada.
- Los borrados staged en `.hermes/plans/` y cualquier commit/push (requieren autorización aparte).

---

## Requisitos

> Se usa prefijo `RNF-OPT` (no funcional, específico del incremento) para no colisionar con la numeración RF existente (ver `docs/rf-index.md`).

- **RNF-OPT-01 — Sin cambio visual ni funcional:** cada unidad atómica DEBE preservar píxeles y comportamiento; toda diferencia exige captura antes/después y justificación explícita.
- **RNF-OPT-02 — Fuente única:** ningún selector de componente DEBE estar definido en dos hojas con valores en conflicto; la hoja canónica queda documentada en `plan.md`.
- **RNF-OPT-03 — Tokens como única fuente de color:** fuera de `tokens.css` no DEBE haber hex literales, salvo la excepción documentada de impresión y fallbacks `var()` ya normalizados.
- **RNF-OPT-04 — Sin dependencias nuevas:** `client/package.json` NO DEBE sumar dependencias ni devDependencies.
- **RNF-OPT-05 — Atomicidad con evidencia:** cada tarea DEBE cerrarse con tests específicos, suite cliente completa, build, `git diff --check` y registro en `validation.md` antes de iniciar la siguiente.
- **RNF-OPT-06 — Reconciliación del pendiente:** el refactor sin spec del working tree (tokens, hojas CSS, páginas, `EventCard.jsx`) NO se asume válido: se revisa tarea por tarea bajo este spec; lo que cambie valores respecto a Spec 020 T07–T18 requiere validación visual explícita.

---

## Criterios de Aceptación

1. Menos selectores duplicados y menos líneas CSS/JSX repetidas, medidos contra la línea base.
2. Cero hex fuera de tokens salvo excepciones documentadas en `clarifications.md`.
3. Suite cliente en verde (base: 40 archivos / 253 tests) y build Vite exitoso tras cada unidad.
4. `git diff --check` limpio y sin secretos en cada diff.
5. Revisión en `390x844`, `768x1024` y `1440x900` para toda unidad que toque CSS; teclado + táctil para componentes interactivos.
