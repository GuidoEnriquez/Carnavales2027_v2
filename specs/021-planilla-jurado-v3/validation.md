# Validación — Spec 021: Planilla del Jurado v3

## Estado de Validación

- **Fecha:** 2026-09-08
- **Alcance evaluado:** T01 a T06 de Spec 021.
- **Resultado General:** APROBADO (135/135 tests API, 68/68 tests DB, 175/175 tests Cliente, build producción exitoso).

## Matriz de Cobertura de Requisitos

| Requisito | Descripción | Estado | Evidencia |
|---|---|---|---|
| RF-182 | Color de identidad por comparsa (`event_troupe.brand_color`) | APROBADO | `api/src/db/migrations/069_troupe_brand_color.sql`, `api/src/tests/judge-ballots-progress.test.js`, `client/src/tests/JudgeBallotPageV3.test.jsx` |
| RF-183 | Endpoint de planillas con progreso (`include=progress`) sin llamadas N+1 | APROBADO | `api/src/modules/ballots/ballot-service.js`, `api/src/tests/judge-ballots-progress.test.js`, `client/src/tests/JudgeHomePage.test.jsx` |
| RF-184 | Flujo móvil tarjeta a tarjeta y vista alternativa | APROBADO | `client/src/pages/JudgeBallotPage.jsx`, `client/src/tests/JudgeBallotPageV3.test.jsx` |
| RF-185 | Grilla 1–10 (solo números) y confirmación por modal (Spec 007 RF-77); doble tap derogado | APROBADO (rev. 2026-09-11) | `client/src/pages/JudgeBallotPage.jsx`, `client/src/tests/JudgeBallotPageV3.test.jsx` |
| RF-186 | Región segregada y confirmación modal de "No se presentó" | APROBADO | `client/src/pages/JudgeBallotPage.jsx`, `client/src/tests/JudgeBallotPageV3.test.jsx` |
| RF-187 | Estado de guardado granular por fila con reintento aislado | APROBADO | `client/src/pages/JudgeBallotPage.jsx`, `client/src/tests/JudgeBallotPageV3.test.jsx` |
| RF-188 | Barra de navegación fija y acceso directo a faltantes | APROBADO | `client/src/pages/JudgeBallotPage.jsx`, `client/src/tests/JudgeBallotPageV3.test.jsx` |
| RF-189 | Layouts responsivos adaptativos (móvil, tablet, desktop con atajos de teclado) | APROBADO | `client/src/styles/components.css`, `client/src/tests/JudgeBallotPageV3.test.jsx` |

## Registro de Pruebas Automatizadas

1. **API Integration Test (`api/src/tests/judge-ballots-progress.test.js`):**
   - Validación de check constraint regex `event_troupe_brand_color_format` (`#RRGGBB`).
   - Endpoint `GET /api/v1/judge/ballots?include=progress` devolviendo `totalScores`, `resolvedScores` y array estructurado de `troupes` con `brandColor`.
   - 1/1 tests aprobados.

2. **Suite API Completa (`api/`):**
   - 135 tests pasados en 4 suites (`npm test`).
   - 68 tests pasados en suite de base de datos (`npm run db:test`).
   - Migración 069 validada en `migrate.test.js`.

3. **Suite Cliente (`client/`):**
   - 37 archivos de test pasados, 175 tests aprobados (`npm test`).
   - `JudgeHomePage.test.jsx`: 4/4 tests pasados (consumo de `include=progress` sin peticiones N+1).
   - `JudgeBallotPage.test.jsx`: 4/4 tests pasados.
   - `JudgeBallotPageV3.test.jsx`: 6/6 tests pasados (tarjeta a tarjeta, doble tap in situ, modal no presentado, reintento granular aislado, faltantes, atajos de teclado).

4. **Compilación de Producción (`client/`):**
   - `npm run build` ejecutado con éxito (0 advertencias, 0 errores, 67 módulos transformados en 826ms).

## Verificación de Integridad

- Migraciones: 001 a 069 aplicadas sin pendientes.
- Inmutabilidad estricta respetada: el servidor rechaza mutaciones de puntajes confirmados o planillas cerradas.
- Todas las suites de tests (API, DB, Cliente) aprobadas al 100%.
- Cero fugas de secretos o credenciales.

## Validación T07 — Capa Instrumento y Tokens Semánticos en Flujo de Jurados

- **Fecha:** 2026-09-08
- **Alcance:**
  - Inclusión de `data-layer="instrument"` en `JudgeHomePage.jsx`.
  - Migración a tokens semánticos en `index.css`: `.judge-ballot-card`, `.locked-score`, `.locked-score.not-presented`, `.locked-sheet`, `.progress-track`, `.ballot-troupe`, `.ballot-rubric`.
  - Eliminación de la altura rígida de 19rem en `.judge-ballot-card` por dimensionamiento fluido (`min-block-size: auto` y padding `clamp()`).
- **Pruebas Automatizadas:**
  - `tokens.test.js`: 32/32 tests aprobados (incluyendo 4 tests nuevos de adopción de tokens en jurados).
  - `JudgeHomePage.test.jsx`: 5/5 tests aprobados (incluyendo test de `data-layer="instrument"`).
  - `JudgeBallotPageV3.test.jsx`: 6/6 tests aprobados.
  - Suite completa de cliente: 229/229 tests aprobados en 40 suites.
  - Build de producción: exitoso en 869ms (68 módulos transformados).
  - `git diff --check`: 0 errores.

## Validación T08 — Ergonomía Móvil 390px y Compensación de Scroll para Barra Fija Inferior

- **Fecha:** 2026-09-08
- **Alcance:**
  - Inclusión de `padding-block-end: calc(5.5rem + env(safe-area-inset-bottom, 0px))` en `.judge-ballot-page` para eliminar el solapamiento de la barra flotante sobre los controles finales.
  - Target táctil accesible garantizado (`min-block-size: var(--touch-target-min)` = 48px) en `.nav-btn` y `.faltantes-btn`.
  - Adaptación fluida en viewports móviles (≤ 480px) con `@media (max-width: 480px)`.
- **Pruebas Automatizadas:**
  - `tokens.test.js`: 34/34 tests aprobados (incluyendo 2 tests de compensación de scroll y touch targets en barra inferior).
  - `JudgeBallotPageV3.test.jsx`: 6/6 tests aprobados.
  - Suite completa de cliente: 231/231 tests aprobados en 40 suites (6.32 s).
  - Build de producción: exitoso en 857ms (68 módulos transformados; CSS 95.68 kB, JS 372.15 kB).
  - `git diff --check`: 0 errores.

## Validación T09 — Estabilidad Física y Eliminación de CLS en Grilla 1–10

- **Fecha:** 2026-09-08
- **Alcance:**
  - Establecimiento de `min-block-size: 68px` en `.score-option-btn`, eliminando saltos de altura vertical o desajustes entre filas al activar el badge de confirmación.
  - Accesibilidad de foco mediante `:focus-visible` con `var(--focus-ring)`.
- **Pruebas Automatizadas:**
  - `tokens.test.js`: 35/35 tests aprobados (incluyendo test de estabilidad física y foco visible en grilla).
  - `JudgeBallotPageV3.test.jsx`: 6/6 tests aprobados.
  - Suite completa de cliente: 232/232 tests aprobados en 40 suites (6.81 s).
  - Build de producción: exitoso en 906ms (68 módulos transformados; CSS 96.05 kB, JS 372.15 kB).
  - `git diff --check`: 0 errores.

## Validación T10 — Pulido Accesible del Diálogo de Faltantes y Touch Targets de Salto Directo

- **Fecha:** 2026-09-08
- **Alcance:**
  - Aplicación de `min-block-size: var(--touch-target-min)` (48px) y `border-inline-start: 3px solid var(--warning)` en `.pending-item-jump-btn` en `components.css`.
  - Configuración de padding ergonómico (`var(--space-3) var(--space-4)`), hover y foco visible accesible (`:focus-visible` con `box-shadow: var(--focus-ring); border-color: var(--accent-primary)`).
  - Optimización táctil y visual para jurados en dispositivos móviles, tablets y navegación por teclado en el diálogo de ítems pendientes.
- **Pruebas Automatizadas:**
  - `tokens.test.js`: 36/36 tests aprobados (incluyendo test de target táctil 48px, borde de advertencia y foco visible en `.pending-item-jump-btn`).
  - `JudgeBallotPageV3.test.jsx`: 6/6 tests aprobados.
  - Suite completa de cliente: 233/233 tests aprobados en 40 suites (6.10 s).
  - Build de producción: exitoso en 857ms (68 módulos transformados; CSS 96.54 kB, JS 372.15 kB).
  - `git diff --check`: 0 errores.

## Validación T11 — Alineación con Spec 007 (modal) y pulido de planilla

- **Fecha:** 2026-09-11
- **Alcance:**
  - RF-185: doble tap in situ derogado; la grilla 1–10 muestra solo números y abre modal de confirmación `<Dialog>` (Spec 007 RF-77).
  - Palabra-ancla ("Muy malo", "Malo", …, "Excelente") eliminada de los botones y de la vista bloqueada.
  - Bugfix: confirmar en modo tarjeta ya no regresa a la primera tarjeta de la comparsa.
  - Vista de lista completa: controles de votación centrados (`.score-row` a una columna).
- **Pruebas Automatizadas:**
  - `JudgeBallotPage.test.jsx` + `JudgeBallotPageV3.test.jsx`: 14/14 tests aprobados (incluye test de regresión de permanencia de tarjeta).
  - Build de producción: exitoso (83 módulos).
  - `git diff --check`: limpio.
