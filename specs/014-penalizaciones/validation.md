# Validación — Spec 014: Gestión de Penalizaciones

## Estado

- Especificación y tareas creadas el 2026-09-03.
- **T01 completada el 2026-09-03:** Migración 062 y suite de base de datos implementadas y validadas con 49 tests DB pasando.
- **T02 completada el 2026-09-03:** Servicios, router de penalizaciones con 2FA, auditoría y suite de integración API con 92 tests API pasando.
- **T03 completada el 2026-09-03:** Integración de penalizaciones con el cómputo de resultados. `computeOverallRanking` ahora calcula `grossScore` (suma nominativa), `totalPenalties` y `netScore = max(0, grossScore - totalPenalties)` por comparsa, ordenando la Mejor Comparsa por `netScore`; se expone además `penaltyPoints` y el desglose (`penalties`). Los ganadores por rubro artístico (RF-118) permanecen basados en el puntaje bruto. `computeResults` y el sorteo ceremonial cargan penalizaciones mediante el nuevo `fetchConsolidatedPenalties`.
- **T04 completada el 2026-09-03:** Panel de Comisariato (`AdminPenaltiesPage`), diálogo accesible de revocación (`RevokePenaltyModal`), guard de ruta `RequirePenaltiesRole`, registro de ruta `#/admin/penalties` y link en `AppNavigation`. Desglose en `AdminResultsPage` mostrando tres columnas (Puntaje bruto, Penalizaciones y Puntaje final neto). Suites de cliente pasando 100% (26 archivos, 85 tests).
- **T05 completada el 2026-09-03:** Cobertura automatizada completa y pasada al 100% en DB, API y Cliente. DB: suite `penalties.test.js` ampliada a 13 tests cubriendo modelo, inmutabilidad post-liberación, revocación, unicidad de contexto bidireccional y deducción con piso cero (`52 passed, 0 failed` en suite DB total). API: suite `penalties-api.test.js` ampliada con pruebas exhaustivas de autorización con y sin 2FA (ADMIN y COMISARIO), rechazo a JUDGE/VEEDOR, validación de entradas (decimales, <=0, strings, vacíos), ciclo de vida e impacto exacto en el ranking de Mejor Comparsa con preservación de ganadores de rubros artísticos (`96 passed, 0 failed` en suite API total). Cliente: nueva suite de componente `RevokePenaltyModal.test.jsx` (6 tests: render, trampa de foco Tab/Shift+Tab, Escape, Cancelar con retorno de foco, envío con motivo y errores legibles) y ampliación de `AdminPenaltiesPage.test.jsx` (7 tests) y `AdminResultsPage.test.jsx` (6 tests) cubriendo validación de formulario, errores específicos y piso cero con atributos accesibles `data-label` (`27 passed test files, 94 passed tests`, build en 662ms).

## Evidencia ejecutada

| Área | Comando | Resultado |
|---|---|---|
| Persistencia | `npm run db:test` en `api/` | 52 passed, 0 failed. Incluye 13 tests de `penalties.test.js` (modelo, unicidad de contexto bidireccional, revocación, inmutabilidad, deducción con piso 0) y `results.test.js`. |
| API | `npm test` en `api/` | 96 passed, 0 failed. Incluye suite `penalties-api.test.js` (autorización con/sin 2FA, rechazo JUDGE/VEEDOR, validación, ciclo de vida, impacto exacto en ranking y preservación de premios individuales). |
| Cliente Tests | `npm test` en `client/` | 27 passed test files, 94 passed tests. Incluye `AdminPenaltiesPage.test.jsx`, `RevokePenaltyModal.test.jsx`, `AdminResultsPage.test.jsx`, `RequirePenaltiesRole.test.jsx`. |
| Cliente Build | `npm run build` en `client/` | Exitoso en 662ms (Vite v7.3.6). |
| Migraciones | `npm run db:migrate` en `api/` | Migración `062_troupe_penalties.sql` aplicada y sin pendientes. |
| Revisión | `git diff --check` | Sin errores de formato ni espacios en blanco (código de salida 0). |

## Matriz de Requisitos Funcionales

| Requisito | Evidencia y Test Automatizado |
|---|---|
| RF-112 Modelo y persistencia | Migración `062_troupe_penalties.sql`; `api/src/db/tests/penalties.test.js` (tests de inserción válida, puntos > 0, noche competitiva, unicidad de contexto comparsa/noche de distinto evento); `penalties-api.test.js` (validación de puntos y noche de concurso) |
| RF-113 Autorización con 2FA | `api/src/tests/penalties-api.test.js` (rechazo 401 sin sesión, rechazo 403 `TWO_FACTOR_REQUIRED` para COMISARIO y ADMIN sin 2FA en alta y revocación, rechazo 403 `PENALTIES_ACCESS_DENIED` a JUDGE y VEEDOR); `client/src/auth/RequirePenaltiesRole.test.jsx` (permite ADMIN y COMISARIO, bloquea JUDGE y exige 2FA) |
| RF-114 Independencia de votos artísticos | `api/src/db/tests/results.test.js` y `api/src/tests/penalties-api.test.js` (las planillas y puntuaciones confirmadas por jurados no se modifican ni reabren; los ganadores de rubros artísticos permanecen inmutables) |
| RF-115 Bloqueo post-liberación | `api/src/db/tests/penalties.test.js` (trigger rechaza inserción y actualización tras `results_release`); `api/src/tests/penalties-api.test.js` (endpoints devuelven 409 `RESULTS_ALREADY_RELEASED`); `client/src/pages/AdminPenaltiesPage.test.jsx` y `RevokePenaltyModal.test.jsx` (mensaje amigable en UI) |
| RF-116 Revocación auditada | `api/src/db/tests/penalties.test.js` (transición a `REVOKED` con motivo obligatorio, no permite borrado físico ni mutar revocada); `api/src/tests/penalties-api.test.js` (alta de auditoría `TROUPE_PENALTY_REVOKED`, rechazo sin motivo 400); `client/src/features/penalties/RevokePenaltyModal.test.jsx` y `AdminPenaltiesPage.test.jsx` (diálogo modal accesible, confirmación con motivo y refresco de tabla) |
| RF-117 Deducción en Mejor Comparsa | `api/src/db/tests/penalties.test.js` (test de deducción determinística y piso 0 `max(0, gross - penalties)`); `api/src/db/tests/results.test.js`; `api/src/tests/penalties-api.test.js` (inversión exacta del ranking de Mejor Comparsa por penalizaciones activas); `client/src/pages/AdminResultsPage.test.jsx` |
| RF-118 Preservación de premios por rubro | `api/src/db/tests/results.test.js` y `api/src/tests/penalties-api.test.js` (rubricRankings conserva comparsa ganadora por notas artísticas a pesar de su penalización en Mejor Comparsa) |
| RF-119 Desglose auditable | `api/src/tests/penalties-api.test.js` (GET `/results` expone `grossScore`, `totalPenalties`/`penaltyPoints`, `netScore` y array `penalties` excluyendo revocadas); `client/src/pages/AdminResultsPage.test.jsx` (3 columnas con formato `pts`, `−X pts`, `0 pts` y `data-label` accesible) |
| RF-120 Accesibilidad y responsive | `client/src/pages/AdminPenaltiesPage.test.jsx` y `client/src/features/penalties/RevokePenaltyModal.test.jsx` (roles `dialog`, `aria-modal`, trampa de foco Tab/Shift+Tab, Escape, retorno de foco al disparador, controles táctiles ≥ 48px y soporte responsive con data-label) |

## Comprobación manual planificada (390×844, 768×1024, 1440×900)

- [ ] Carga de penalización en móvil con controles táctiles sin hover.
- [ ] Listado accesible y contraste WCAG AA.
- [ ] Diálogo de confirmación de revocación con teclado (Tab trap, Escape, retorno de foco).
- [ ] Visualización clara del desglose de penalizaciones en la pantalla de resultados autorizados.
