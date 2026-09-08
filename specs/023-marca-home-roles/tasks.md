# Tareas — Spec 023: Capa de Marca y Home por Rol

## T01 — Tokens de Marca y Capa Dual (`data-layer`) en Estilos (RF-200, RF-205)

- [x] Verificar y asegurar tokens de marca en `client/src/styles/tokens.css` (`--brand-gold`, `--brand-magenta`, `--brand-cyan`, `--brand-seal`).
- [x] Aplicar selectores para `[data-layer="brand"]` en `client/src/styles/components.css` y `index.css`.
- [x] Incorporar reglas estrictas de `@media (prefers-reduced-motion: reduce)` en animaciones y transiciones.

## T02 — Rediseño de LoginPage con Capa de Marca y Accesibilidad (RF-201, RF-203)

- [x] Asignar `data-layer="brand"` a `LoginPage.jsx`.
- [x] Verificar soporte completo de alternancia de visibilidad de contraseña e inputs OTP con pegado completo.
- [x] Verificar y consolidar la función de redirección inteligente `goToRoleHome`.

## T03 — Home Consciente del Rol (`HomePage.jsx`) (RF-202)

- [x] Asignar `data-layer="brand"` a `HomePage.jsx`.
- [x] Refinar tarjetas operativas por rol con copy descriptivo y botones de acción directa.
- [x] Mostrar mensaje amigable y guiado si la sesión no posee roles asignados.

## T04 — Stepper y Panel de Condiciones de Escrutinio en `AdminResultsPage.jsx` (RF-204)

- [x] Asignar `data-layer="brand"` a `AdminResultsPage.jsx` y `OfficialRecordPage.jsx`.
- [x] Agregar panel descriptivo de condiciones reglamentarias previas para la liberación de resultados (RF-94a).

## T05 — Pruebas Automatizadas, Validación Integral y Reporte

- [x] Escribir o actualizar tests unitarios y de componentes para HomePage, LoginPage y AdminResultsPage.
- [x] Ejecutar `npm test` en `client/` y `api/`.
- [x] Ejecutar `npm run build` en `client/`.
- [x] Documentar evidencias en `specs/023-marca-home-roles/validation.md`.
- [x] Actualizar `docs/sdd-status.md` y `docs/source-map.md`.
