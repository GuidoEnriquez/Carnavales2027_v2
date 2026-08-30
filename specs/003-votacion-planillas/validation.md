# Validación — Spec 003 · I3: Planillas y puntuaciones

## Estado

- **I3 validado:** 2026-08-30.
- **Resultado:** API, persistencia, cliente, build y migraciones aplicables completados sin fallos.

## Evidencia Ejecutada

| Área | Comando | Resultado |
|---|---|---|
| API | `npm test` en `api/` | 58 passed, 0 failed |
| Persistencia | `npm run db:test` en `api/` | 27 passed, 0 failed |
| Cliente | `npm test` en `client/` | 43 passed, 0 failed |
| Build | `npm run build` en `client/` | exitoso, 45 módulos transformados |
| Migraciones | `npm run db:migrate -- --status` | 001–045 aplicadas, sin pendientes |
| Idempotencia | `migrate.test.js` | segunda ejecución sin migraciones aplicadas |

## Matriz De Requisitos I3

| Requisito | Evidencia |
|---|---|
| RF-44, RF-45 | `voting-api.test.js`, `ballots.test.js`, migraciones 032 y 035; apertura crea una planilla `OPEN` por asignación activa. |
| RF-46 | `voting-api.test.js`, `ballots.test.js`, `JudgeBallotPage.test.jsx`; la planilla incluye solo ítems de la especialidad del jurado, agrupados por comparsa programada. Migración 038 garantiza una puntuación por planilla, ítem y comparsa. |
| RF-47 | `ballots.test.js`, `JudgeBallotPage.test.jsx`; 0 es válido y se ofrece explícitamente como “No presentado”. |
| RF-48 | `voting-api.test.js`, `ballots.test.js`, migraciones 041–042; solo SCRUTINEER marca una omisión NULL editable; score 0 no se subsana. |
| RF-49 | `voting-api.test.js`, `JudgeBallotPage.test.jsx`, `http-errors.js`; confirmación incompleta devuelve `409 BALLOT_INCOMPLETE` con sus ítems pendientes y el cierre administrativo rechaza planillas incompletas. |
| RF-50 | `ballots.test.js`, `voting-api.test.js`; confirmar bloquea puntuaciones y la planilla no vuelve a `OPEN`. |
| RF-51 | `voting.routes.js`, `listNightBallots`, `AdminVotingPage.test.jsx`; ADMIN y VEEDOR reciben solo estado, identidad de jurado y especialidad; ningún endpoint administrativo devuelve puntuaciones. |
| RF-52 | `voting-api.test.js`, `ballots.test.js`, migración 037; ADMIN con 2FA debe aportar motivo, puede reabrir una vez y el desbloqueo conserva el valor previo de cada puntuación. |
| RF-53 | `ballot-service.js`, `voting-api.test.js`, `ballot_audit_log`; se auditan apertura, guardado, confirmación y reapertura sin guardar el valor de la puntuación. |
| RF-54 | `require-voting-observer.js`, migración 039 y `voting-api.test.js`; VEEDOR con 2FA consulta conteos sin puntajes. |
| RF-55 | Revisión de rutas, módulos y cliente; no se agregaron offline/sync, penalizaciones, consolidación de resultados ni actas. |
| RF-56 | `require-scrutineer.js`, `voting-api.test.js`, `ballots.test.js`, migraciones 041–043; SCRUTINEER con 2FA registra 5 puntos en una entidad separada, auditable e inmutable sobre una omisión de una planilla confirmada. |

## Revisión Final

- `git diff --check`: sin errores.
- El acceso a planillas se verifica por usuario titular y asignación activa en lectura, guardado y confirmación.
- No se exponen puntajes de otros jurados ni valores de puntaje en auditoría.
- Los triggers impiden borrar o modificar planillas, puntajes, subsanaciones y auditoría; una subsanación no puede asociarse a otro voto ni modificar el valor original.
- Una subsanación bloquea futuras reaperturas; el cierre bloquea planillas incompletas y persiste una ventana de votación cerrada.
- Las migraciones 031–045 son incrementales y no destructivas.
