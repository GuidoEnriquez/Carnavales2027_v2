# Validación — Spec 003 · I3: Planillas y puntuaciones

> Evidencia histórica de I3. La semántica de puntajes, pendientes y subsanación fue reemplazada por Spec 004; la reapertura fue retirada por Spec 006. Sus validaciones vigentes se registran en esos incrementos.

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
| RF-47 | Evolucionado por RF-57 a RF-60 de Spec 004. |
| RF-48 | Evolucionado por RF-65 de Spec 004; no hay marcado operativo de omisión pre-confirmación. |
| RF-49 | Evolucionado por RF-61 de Spec 004; la confirmación y el cierre rechazan pendientes e identifican ítem, jurado y comparsa. |
| RF-50 | `ballots.test.js`, `voting-api.test.js`; confirmar bloquea puntuaciones y la planilla no vuelve a `OPEN`. |
| RF-51 | `voting.routes.js`, `listNightBallots`, `AdminVotingPage.test.jsx`; ADMIN y VEEDOR reciben solo estado, identidad de jurado y especialidad; ningún endpoint administrativo devuelve puntuaciones. |
| RF-52 | Histórico; reemplazado por RF-67 y RF-68 de Spec 006. |
| RF-53 | Histórico; la reapertura fue retirada por Spec 006. Se mantienen auditorías históricas sin valores de puntuación. |
| RF-54 | `require-voting-observer.js`, migración 039 y `voting-api.test.js`; VEEDOR con 2FA consulta conteos sin puntajes. |
| RF-55 | Revisión de rutas, módulos y cliente; no se agregaron offline/sync, penalizaciones, consolidación de resultados ni actas. |
| RF-56 | Diferido al incremento de escrutinio. La entidad histórica permanece protegida y no tiene rutas operativas vigentes. |

## Revisión Final

- `git diff --check`: sin errores.
- El acceso a planillas se verifica por usuario titular y asignación activa en lectura, guardado y confirmación.
- No se exponen puntajes de otros jurados ni valores de puntaje en auditoría.
- Los triggers impiden borrar o modificar planillas, puntajes, subsanaciones y auditoría; una subsanación no puede asociarse a otro voto ni modificar el valor original.
- Una subsanación histórica permanece protegida; Spec 006 impide cualquier nueva reapertura. El cierre bloquea planillas incompletas y persiste una ventana de votación cerrada.
- Las migraciones 031–045 son incrementales y no destructivas.
