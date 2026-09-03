# Validación — Spec 014: Gestión de Penalizaciones

## Estado

- Especificación y tareas creadas el 2026-09-03.
- **T01 completada el 2026-09-03:** Migración 062 y suite de base de datos implementadas y validadas con 49 tests DB pasando.
- **T02 completada el 2026-09-03:** Servicios, router de penalizaciones con 2FA, auditoría y suite de integración API con 92 tests API pasando.
- **T03 completada el 2026-09-03:** Integración de penalizaciones con el cómputo de resultados. `computeOverallRanking` ahora calcula `grossScore` (suma nominativa), `totalPenalties` y `netScore = max(0, grossScore - totalPenalties)` por comparsa, ordenando la Mejor Comparsa por `netScore`; se expone además `penaltyPoints` y el desglose (`penalties`). Los ganadores por rubro artístico (RF-118) permanecen basados en el puntaje bruto. `computeResults` y el sorteo ceremonial cargan penalizaciones mediante el nuevo `fetchConsolidatedPenalties`.
- **T04 completada el 2026-09-03:** Panel de Comisariato (`AdminPenaltiesPage`), diálogo accesible de revocación (`RevokePenaltyModal`), guard de ruta `RequirePenaltiesRole`, registro de ruta `#/admin/penalties` y link en `AppNavigation`. Desglose en `AdminResultsPage` mostrando tres columnas (Puntaje bruto, Penalizaciones y Puntaje final neto). Suites de cliente pasando 100% (26 archivos, 85 tests).

## Evidencia ejecutada

| Área | Comando | Resultado |
|---|---|---|
| Persistencia | `npm run db:test` en `api/` | 50 passed, 0 failed. Incluye 11 tests de `penalties.test.js`, `migrate.test.js` y el test de deducción RF-117/118/119. |
| API | `npm test` en `api/` | 93 passed, 0 failed. Incluye suite `penalties-api.test.js`. |
| Cliente Tests | `npm test` en `client/` | 26 passed test files, 85 passed tests. Incluye `AdminPenaltiesPage.test.jsx`, `RequirePenaltiesRole.test.jsx`, `AdminResultsPage.test.jsx`. |
| Cliente Build | `npm run build` en `client/` | Exitoso en 666ms (Vite v7.3.6). |
| Migraciones | `npm run db:migrate` en `api/` | Migración `062_troupe_penalties.sql` aplicada y sin pendientes. |
| Revisión | `git diff --check` | Sin errores de formato ni espacios en blanco. |

## Matriz de Requisitos Funcionales

| Requisito | Evidencia |
|---|---|
| RF-112 Modelo y persistencia | Migración `062_troupe_penalties.sql` y tests DB |
| RF-113 Autorización con 2FA | Tests de API con sesión 2FA para COMISARIO y ADMIN; guard `RequirePenaltiesRole` en cliente |
| RF-114 Independencia de votos artísticos | Verificación de que votos confirmados y planillas no mutan |
| RF-115 Bloqueo post-liberación | Trigger y tests que rechazan mutaciones en eventos liberados; manejo legible en UI (409) |
| RF-116 Revocación auditada | Endpoint de revocación y diálogo modal accesible en cliente con motivo obligatorio |
| RF-117 Deducción en Mejor Comparsa | Test de `computeOverallRanking` con penalizaciones aplicadas |
| RF-118 Preservación de premios por rubro | Test de que los ganadores de rubros artísticos permanecen inalterados |
| RF-119 Desglose auditable | Vista `AdminResultsPage` con tres columnas (bruto, penalizaciones, neto) y endpoint de resultados |
| RF-120 Accesibilidad y responsive | Componentes `AdminPenaltiesPage` y `RevokePenaltyModal` con controles táctiles ≥ 48px, foco accesible, Escape y retorno de foco |

## Comprobación manual planificada (390×844, 768×1024, 1440×900)

- [ ] Carga de penalización en móvil con controles táctiles sin hover.
- [ ] Listado accesible y contraste WCAG AA.
- [ ] Diálogo de confirmación de revocación con teclado (Tab trap, Escape, retorno de foco).
- [ ] Visualización clara del desglose de penalizaciones en la pantalla de resultados autorizados.
