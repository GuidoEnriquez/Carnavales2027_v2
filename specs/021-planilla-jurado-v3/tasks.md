# Tareas — Spec 021: Planilla del Jurado v3

## T01 — Migración de color de identidad y consulta de progreso en API (RF-182, RF-183)

- [x] Crear migración `069_troupe_brand_color.sql` añadiendo `brand_color VARCHAR(32)` a `event_troupe` con check de formato hexadecimal.
- [x] Actualizar whitelist de migraciones en `api/src/db/tests/migrate.test.js`.
- [x] Aplicar migración en bases de datos `carnavales2027_v2` y `carnavales2027_v2_test`.
- [x] Modificar `ballot-service.js` y `voting.routes.js` para admitir `include=progress` retornando `totalScores` y `resolvedScores`.
- [x] Crear prueba automatizada en `api/src/tests/` verificando `include=progress` y la restricción de `brand_color`.

## T02 — Flujo móvil tarjeta a tarjeta y barra de navegación inferior fija (RF-184, RF-188)

- [x] Modificar `JudgeBallotPage.jsx` para soportar vista enfocada por ítem en móvil con Comparsa, Rubro e Ítem visibles.
- [x] Implementar interruptor de vista (Tarjeta única vs Lista completa).
- [x] Implementar barra de navegación inferior fija con avance "X / Y", `← Anterior`, `Siguiente →` y botón "Faltantes".
- [x] Implementar diálogo modal accesible (`<Dialog>`) para "Faltantes" con salto directo al ítem pendiente.

## T03 — Grilla 1–10 con solo números y confirmación por modal (RF-185 → Spec 007 RF-77)

- [x] Implementar grilla `radiogroup` accesible 2×5 con altura ≥ 56px por botón.
- [x] Reemplazar doble tap in situ por modal de confirmación `<Dialog>` (Spec 007 RF-77) con "Confirmar"/"Cancelar".
- [x] Manejar atajos de teclado en desktop (1–9, 0 para 10) que abren el modal de confirmación.
- [x] (2026-09-11) Confirmar en modo tarjeta no regresa a la primera tarjeta; controles de votación centrados en la vista de lista.

## T04 — Segregación de "No se presentó" y persistencia granular por fila (RF-186, RF-187)

- [x] Mover acción "No se presentó" a sección propia bajo la grilla con estilo de advertencia.
- [x] Integrar modal accesible `<Dialog>` para confirmación de "No se presentó" advirtiendo el cómputo de 0 puntos.
- [x] Implementar estado granular por fila (`idle`, `saving`, `saved`, `error`) con botón "Reintentar" aislado, eliminando el congelamiento global `busy`.

## T05 — Color de comparsa e integración en JudgeHomePage (RF-182, RF-183, RF-189)

- [x] Mostrar banda de color (`troupe.brandColor`) en las tarjetas y en la barra lateral de comparsas.
- [x] Actualizar `JudgeHomePage.jsx` para consumir `include=progress` mostrando `<ProgressBar>` y `<StatusPill>` sin peticiones N+1.
- [x] Adaptar layouts responsive en `components.css`: móvil (tarjeta), tablet (2 columnas), desktop (3 columnas con sidebar).

## T06 — Pruebas, validación integral y reporte

- [x] Crear pruebas automatizadas en `client/src/tests/` para `JudgeBallotPage` v3 (tarjeta a tarjeta, doble tap, reintento aislado, faltantes).
- [x] Ejecutar suites completas de tests: `npm test` en `api/`, `npm run db:test` en `api/`, `npm test` en `client/`.
- [x] Ejecutar build de producción del cliente (`npm run build`).
- [x] Documentar evidencias en `specs/021-planilla-jurado-v3/validation.md`.
- [x] Actualizar `docs/sdd-status.md` y `docs/source-map.md`.

## T07 — Capa Instrumento y Tokens Semánticos en Panel de Jurados y Planilla (RF-176, RF-177, RF-184)

- [x] Añadir `data-layer="instrument"` en `JudgeHomePage.jsx`.
- [x] Migrar variables legacy y colores hardcodeados de `.judge-ballot-card`, `.locked-score`, `.locked-sheet` y `.ballot-troupe` en `index.css` a tokens semánticos.
- [x] Sustituir `min-block-size: 19rem` por `min-block-size: auto` con `padding: clamp(1rem, 3vw, 1.6rem)` en `.judge-ballot-card`.
- [x] Agregar regresiones de adopción de tokens en `tokens.test.js` y verificar atributo `data-layer` en `JudgeHomePage.test.jsx`.
- [x] Ejecutar suite completa de tests de cliente y build de producción.
- [x] Documentar evidencias en `validation.md`.

## T08 — Ergonomía Móvil 390px y Compensación de Scroll para Barra Fija Inferior (RF-188, RF-189)

- [x] Añadir compensación de scroll `padding-block-end` en `.judge-ballot-page` para evitar que la barra fija inferior oculte el contenido o el pie.
- [x] Aplicar `min-block-size: var(--touch-target-min)` (48px) y estilos de interacción táctil en `.nav-btn` y `.faltantes-btn`.
- [x] Implementar reglas responsive en `@media (max-width: 480px)` para que la barra inferior encaje sin desborde ni cortes en 390×844.
- [x] Añadir pruebas de regresión en `tokens.test.js`.
- [x] Ejecutar suite completa de tests de cliente y build de producción.
- [x] Documentar evidencias en `validation.md`.

## T09 — Estabilidad Física y Eliminación de CLS en Grilla 1–10 (RF-185)

- [x] Ajustar `min-block-size: 68px` en `.score-option-btn` para absorción estable del badge de confirmación.
- [x] Aplicar `:focus-visible` con `var(--focus-ring)` y transiciones suaves.
- [x] Añadir pruebas de regresión en `tokens.test.js`.
- [x] Ejecutar suite completa de tests de cliente y build de producción.
- [x] Documentar evidencias en `validation.md`.

## T10 — Pulido Accesible del Diálogo de Faltantes y Touch Targets de Salto Directo (RF-188)

- [x] Aplicar `min-block-size: var(--touch-target-min)` (48px) y `border-inline-start: 3px solid var(--warning)` en `.pending-item-jump-btn`.
- [x] Configurar `:focus-visible` con `box-shadow: var(--focus-ring)` en `.pending-item-jump-btn`.
- [x] Añadir pruebas de regresión en `tokens.test.js`.
- [x] Ejecutar suite completa de tests de cliente y build de producción.
- [x] Documentar evidencias en `validation.md`.
