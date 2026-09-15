# Tareas — Spec 028

- [x] TAREA 1: partición AHORA / EVALUADAS / PRÓXIMAS en `JudgeHomePage.jsx` (lógica intacta, tests visuales actualizados).
- [x] TAREA 2: responsive home (<900 una columna, ≥1280 dos columnas, CTA full width, sin online simulado).
- [x] FASE 1: tarjeta única en `JudgeBallotPage.jsx` (fuera lista/toggle/barra fija; header, progreso, nav integrada, resuelto compacto).
- [x] FASE 2: táctil tablet-first (64px), sin sticky, `aria-pressed` descartado con fundamento, test readonly.
- [x] FASE 3: rail desktop, resumen con salto, banner Lista para revisar, readonly como resumen, hint atajos.
- [x] FIX: rail lateral único sticky (hijos estáticos, scroll interno, grid 2 col).
- [x] Ratificación documental (esta spec) + entrada en `sdd-status.md`.
- [x] Comprobación manual responsive/teclado/táctil por el producto (aprobada, 2026-09-11).

## Corrección del home — 2026-09-15

- [x] FIX-HOME: jerarquía, consulta, progreso y revisión (RF-HOME-01–04), con
  regresión automatizada, suite cliente, build y revisión del diff.
- [x] FIX-RAIL: evitar desborde horizontal de nombres extensos en el rail
  desktop y preservar elipsis/scroll interno.
- [x] FIX-SHELL: desplazar 48px hacia la izquierda el shell operativo en
  desktop amplio; móvil y tablet conservan el centrado original.
- [x] FIX-HEADER: compartir ancho/eje del shell entre logo superior y planilla.
- [x] FIX-SHIFT-LEFT: desplazar ambos ~150px a la izquierda (≈198px del centro),
  con piso en cero para viewports angostos; móvil y tablet intactos.
- [ ] Comprobación visual de esta corrección en 390x844, 768x1024 y 1440x900,
  teclado y táctil (la aprobación histórica no cubre este cambio).
