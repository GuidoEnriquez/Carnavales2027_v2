# Tasks — Spec 014: Gestión de Penalizaciones

| Tarea | Estado | Evidencia |
| --- | --- | --- |
| T01 Persistencia y migración | Completada | Migración 062 aplicada, suite `penalties.test.js` (11 tests pass) y `migrate.test.js` (49 tests DB total) |
| T02 Servicios y API de penalizaciones | Completada | `penalty-service.js`, `penalties.routes.js`, middleware `requirePenaltiesAccess` y `penalties-api.test.js` (92 tests API pass) |
| T03 Integración con cómputo de resultados | Completada | `fetchConsolidatedPenalties`, `computeOverallRanking` con `grossScore`/`totalPenalties`/`netScore` y desglose; test RF-117/118/119; DB 50 y API 93 pass |
| T04 Cliente: panel de Comisariato y Resultados | Completada | `AdminPenaltiesPage.jsx`, `RevokePenaltyModal.jsx`, `RequirePenaltiesRole.jsx`, desglose 3 columnas en `AdminResultsPage.jsx`, ruta `#/admin/penalties` y navegación; suites de cliente (26 archivos / 85 tests pass), build exitoso |
| T05 Pruebas automatizadas completas | Completada | DB 52 tests (13 en `penalties.test.js`), API 96 tests (autorización, validación, ciclo de vida e impacto en ranking en `penalties-api.test.js`), Cliente 27 archivos / 95 tests (`AdminPenaltiesPage.test.jsx`, `RevokePenaltyModal.test.jsx`, `AdminResultsPage.test.jsx`), build 1.06s |
| T06 Validación manual y cierre SDD | Completada | Comprobación en 390×844, 768×1024 y 1440×900, revisión diff, segregación de roles para liberación y actualización de estado |

## T01 — Persistencia y migración
- Crear migración `062_troupe_penalties.sql`.
- Modelar tabla `troupe_penalty` con claves foráneas a evento, noche y comparsa.
- Agregar restricciones `status IN ('APPLIED', 'REVOKED')` y `penalty_points > 0`.
- Implementar guard de integridad que impida mutaciones si el evento tiene resultados liberados (`results_release`).
- Prohibir borrado físico con trigger guard.

## T02 — Servicios y API de penalizaciones
- Crear `penalty-service.js` con métodos transaccionales para listar, aplicar y revocar penalizaciones.
- Registrar eventos de auditoría `TROUPE_PENALTY_APPLIED` y `TROUPE_PENALTY_REVOKED`.
- Exponer rutas `/api/v1/events/:eventId/penalties` con middleware `requireTwoFactor` y autorización para `COMISARIO` y `ADMIN`.

## T03 — Integración con cómputo de resultados
- Enriquecer `fetchConsolidatedScores` / consulta de escrutinio para cargar penalizaciones aplicadas.
- Actualizar `computeOverallRanking` en `results-service.js` para deducir penalizaciones en el puntaje neto de Mejor Comparsa.
- Asegurar que los ganadores de rubros individuales artísticos no sean afectados por las penalizaciones.

## T04 — Cliente: panel de Comisariato y Resultados
- Implementar página para el comisario con formulario accesible y listado de sanciones.
- Permitir revocación con diálogo de confirmación y motivo.
- Actualizar `AdminResultsPage` para mostrar el desglose de puntaje bruto, penalizaciones deducidas y total neto.

## T05 — Pruebas automatizadas
- Crear tests específicos de base de datos (`penalties.test.js`).
- Crear tests de API para autorización, validación de entradas y cálculo integrado (`penalties-api.test.js`).
- Crear tests de componentes para la página de Comisariato y la vista de resultados.

## T06 — Validación manual y cierre SDD
- Realizar recorrido manual en Chrome con emulación responsive (móvil, tablet, desktop).
- Validar contraste, controles ≥ 48px, teclado (Tab, Escape, retorno de foco) y emulación táctil.
- Documentar evidencia en `validation.md` y actualizar `docs/sdd-status.md`.
