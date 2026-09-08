# Plan de Implementación — Spec 021: Planilla del Jurado v3

## Enfoque de Implementación

### 1. Migración y Backend (RF-182, RF-183):
- Crear `api/src/db/migrations/069_troupe_brand_color.sql`.
- Actualizar `api/src/db/tests/migrate.test.js` para registrar la migración 069.
- Aplicar migración en bases de datos dev y test.
- En `api/src/modules/judges/judge-service.js` (o módulo de consulta de planillas), soportar `include=progress` en la función que obtiene las planillas del jurado, devolviendo `totalScores` y `resolvedScores`.
- Crear prueba en `api/src/tests/` validando `include=progress` y la migración.

### 2. Rediseño Operativo del Cliente (RF-184, RF-185, RF-186, RF-187, RF-188, RF-189):
- Refactorizar `client/src/pages/JudgeBallotPage.jsx`:
  - Estado granular `scoreItemStates`: mapa por `scoreId` con `{ status: 'idle'|'saving'|'saved'|'error', errorMessage: string }`.
  - Estado de selección in situ: `stagedScore`: `{ scoreId, value }`. Tocar el mismo valor dispara `saveScore`; tocar otro valor cambia `stagedScore`.
  - Integrar `<Dialog>` para "No se presentó" con advertencia de 0 puntos.
  - Integrar `<Dialog>` para el modal de cierre con faltantes y para confirmación final de planilla.
  - Implementar flujo "Tarjeta a tarjeta" con selector de modo (tarjeta / lista completa).
  - Implementar barra de navegación inferior fija (`.ballot-bottom-bar`) con progreso, botones Anterior/Siguiente y botón "Faltantes" con diálogo modal accesible de salto directo.
  - Atajos de teclado en desktop (1 a 9, 0 para 10, Enter para confirmar).
  - Banda de color de comparsa (`troupe.brandColor`).
- En `client/src/pages/JudgeHomePage.jsx`:
  - Usar los conteos `totalScores` y `resolvedScores` provistos por `include=progress` directamente con `<ProgressBar>` y `<StatusPill>`.
- En `client/src/styles/components.css`:
  - Estilos específicos de la planilla v3 (`.ballot-card-mode`, `.ballot-bottom-bar`, `.troupe-brand-stripe`, `.score-grid-v3`).

### 3. Pruebas y Validación:
- Pruebas unitarias de `JudgeBallotPage` verificando doble tap, "No se presentó", estado granular y barra fija.
- Verificación en viewports operativos (390×844, 768×1024, 1440×900).
- Suite completa de tests API, BD y Cliente.

### 4. T07 — Refinamiento Visual y Tokens Semánticos en Flujo de Jurados:
- Aplicar `data-layer="instrument"` en `JudgeHomePage.jsx`.
- Sustituir variables legacy (`--primary-color`, `--line-color`, `--surface`, `--muted-color`) y colores hexadecimales fijos en `client/src/index.css` por tokens semánticos oficiales (`--surface-card`, `--border-default`, `--border-subtle`, `--text-primary`, `--success-text`, `--warning-text`).
- Reemplazar altura fija de 19rem en `.judge-ballot-card` por `min-block-size: auto` con padding fluido `clamp(1rem, 3vw, 1.6rem)`.
- Añadir pruebas de regresión en `client/src/tests/tokens.test.js` y `client/src/tests/JudgeHomePage.test.jsx`.

### 5. T08 — Ergonomía Móvil 390px y Compensación de Scroll para Barra Fija Inferior:
- Declarar `padding-block-end: calc(5.5rem + env(safe-area-inset-bottom, 0px))` en `.judge-ballot-page`.
- Asegurar `min-block-size: var(--touch-target-min)` (48px) en `.nav-btn` y `.faltantes-btn`.
- Implementar adaptación fluida responsive en `@media (max-width: 480px)` para `.ballot-bottom-bar`, `.bottom-bar-content` y `.bottom-bar-nav-btns`.
- Añadir regresiones automatizadas en `client/src/tests/tokens.test.js`.

### 6. T09 — Estabilidad Física y Eliminación de CLS en Grilla 1–10:
- Fijar `min-block-size: 68px` en `.score-option-btn` para absorber el badge de confirmación sin deformar la grilla.
- Configurar transiciones suaves y focus ring accesible (`:focus-visible` con `var(--focus-ring)`).
- Añadir pruebas automatizadas en `tokens.test.js` y verificar comportamiento en `JudgeBallotPageV3.test.jsx`.

### 7. T10 — Pulido Accesible del Diálogo de Faltantes y Touch Targets de Salto Directo:
- Estandarizar `.pending-item-jump-btn` con `min-block-size: var(--touch-target-min)` (48px) y `border-inline-start: 3px solid var(--warning)`.
- Añadir estados `:hover` y `:focus-visible` con `var(--focus-ring)` y transiciones suaves.
- Añadir pruebas automatizadas en `tokens.test.js` y verificar suite completa.
