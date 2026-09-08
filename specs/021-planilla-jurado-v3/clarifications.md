# Clarificaciones — Spec 021

## Preguntas y Decisiones de Arquitectura

### 1. ¿Por qué doble tap in situ en vez de una ventana de deshacer de 5 segundos con toast?
**Decisión:**
La ventana de deshacer de 5 segundos requeriría que el servidor permita modificar una puntuación durante esos 5 segundos, lo cual viola la Constitución actual y el contrato de inmutabilidad estricta por ítem de Spec 007 ("cada guardado es inmutable"). Cambiar las reglas de inmutabilidad del servidor requiere una definición reglamentaria formal sobre corrección de voto.
El doble tap in situ:
1. Resuelve al 100% el problema de mis-tap (un toque accidental no guarda, solo pre-selecciona; se requiere un segundo toque deliberado en el mismo lugar exacto).
2. Elimina la molestia de abrir y cerrar un diálogo modal emergente para cada uno de los 10 dígitos.
3. No requiere modificar el backend ni el contrato de inmutabilidad estricta de Spec 007.

### 2. ¿Cómo interactúa el parámetro `include=progress` con las consultas de `ballot`?
**Decisión:**
En `judge-service.js` (o módulo correspondiente que sirve `GET /api/v1/judge/ballots`), cuando `include === "progress"`, se ejecutará una consulta agregada con `COUNT(*)` y `COUNT(*) FILTER (WHERE evaluation_state != 'PENDING')` agrupada por `ballot_id`. Esto inyecta `totalScores` y `resolvedScores` directamente en el array de planillas devuelto al jurado, reduciendo las llamadas HTTP de N+1 a 1 sola.

### 3. ¿Cómo se valida el formato de `brand_color` en PostgreSQL?
**Decisión:**
En la tabla `event_troupe`:
```sql
ALTER TABLE event_troupe
  ADD COLUMN brand_color VARCHAR(32),
  ADD CONSTRAINT event_troupe_brand_color_format
    CHECK (brand_color IS NULL OR brand_color ~ '^#[0-9A-Fa-f]{6}$');
```
Si es NULL, el frontend usará un color por defecto de la paleta semántica.

### 4. ¿Cómo funciona la alternancia entre "Tarjeta enfocada" y "Lista completa"?
**Decisión:**
Se proveerá un botón en la cabecera de la planilla (ej. "Modo Lista" / "Modo Tarjeta"). En móvil, el modo inicial será "Tarjeta", optimizado para pantallas pequeñas. En desktop y tablet, el modo predeterminado muestra la lista y la tarjeta en paralelo.

### 5. ¿Cómo se aplican los tokens semánticos y la capa instrumento en el flujo de jurados?
**Decisión:**
1. `JudgeHomePage.jsx` debe incluir el atributo `data-layer="instrument"` en su etiqueta `<main>` para alinear su contexto visual con `JudgeBallotPage.jsx` y garantizar que los tokens de alta concentración y contraste gobiernen toda la interacción del jurado.
2. Todas las reglas CSS de jurados y planillas en `client/src/index.css` deben migrar de variables legacy (`--primary-color`, `--line-color`, `--surface`, `--muted-color`) y colores hardcodeados a los tokens semánticos oficiales (`--surface-card`, `--border-default`, `--border-subtle`, `--text-primary`, `--success-text`, `--warning-text`).
3. Las tarjetas de comparsa (`.judge-ballot-card`) deben sustituir la altura fija de 19rem por dimensionamiento fluido con padding `clamp()` para optimizar el espacio vertical en móvil (390×844).

### 6. ¿Cómo se garantiza la visibilidad y ergonomía táctil en la barra inferior fija?
**Decisión:**
1. `.judge-ballot-page` debe declarar `padding-block-end: calc(5.5rem + env(safe-area-inset-bottom, 0px))` para asegurar que la barra inferior fija `.ballot-bottom-bar` jamás tape los controles finales de la planilla (como el botón "Confirmar planilla" o el último ítem de puntuación).
2. Los botones interactivos de la barra (`.nav-btn` y `.faltantes-btn`) deben garantizar una altura mínima de `var(--touch-target-min)` (48px) de acuerdo a WCAG 2.2 AA.
3. En viewports móviles estrechos (≤ 480px, ej. 390×844), la barra adapta sus paddings y gaps de forma fluida para que los controles convivan sin desborde horizontal ni saltos de línea inesperados.

### 7. ¿Cómo se previene el Cumulative Layout Shift (CLS) en la grilla 1–10?
**Decisión:**
1. Los botones `.score-option-btn` deben tener una altura física base de `min-block-size: 68px`.
2. Esta altura absorbe cómodamente tanto el estado normal (número + palabra ancla) como el estado pre-seleccionado `is-staged` con la etiqueta añadida `.staged-confirm-badge` ("Confirmar"), sin alterar la altura exterior del botón ni generar saltos verticales en la fila contigua de la grilla.
3. Se agrega un focus-visible accesible con `var(--focus-ring)` y eliminación del outline por defecto, asegurando visibilidad para jurados que utilicen teclado o dispositivos de asistencia.

### 8. ¿Cómo se diseñan los touch targets en el diálogo de faltantes?
**Decisión:**
1. Cada botón de salto a ítem pendiente (`.pending-item-jump-btn`) debe declarar una altura mínima accesible de `min-block-size: var(--touch-target-min)` (48px) de acuerdo a WCAG 2.2 AA.
2. Cada botón incorpora una banda visual indicadora semántica de advertencia (`border-inline-start: 3px solid var(--warning)`), reforzando visualmente su condición de ítem pendiente de resolución.
3. Se implementa focus visible (`:focus-visible`) con `box-shadow: var(--focus-ring)` para facilitar el salto rápido por teclado en desktop y tablets.
