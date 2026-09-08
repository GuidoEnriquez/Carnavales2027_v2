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
