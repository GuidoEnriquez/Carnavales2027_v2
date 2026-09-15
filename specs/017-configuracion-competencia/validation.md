# Validacion - Spec 017: Configuracion de competencia

## Estado

### Verificación integral del estado actual (2026-09-10)

- Cliente: `npm.cmd test` → 45 archivos / 282 tests en verde; `npm.cmd run build` → 83 módulos transformados, build exitoso.
- API/DB: `npm.cmd test` → 142 tests en verde.
- `git diff --check`: sin errores de whitespace; las advertencias LF/CRLF corresponden a la configuración del working tree.
- T09a/T09b permanecen automatizadas y validadas; T04 completada con cierre manual 2026-09-14; T05/T10/T11 siguen bloqueadas por sus aclaraciones documentadas.

- Incremento activo; T03 validada automaticamente para su alcance original. El pedido ampliado no esta validado.
- T01 completada el 2026-09-07.
- T02 completada automaticamente.
- T03 completada el 2026-09-07.
- T04 completada (cierre manual responsive/teclado/táctil aprobado 2026-09-14); los hallazgos de inspeccion sobre `expectedSubjectType` quedaron resueltos en T07 (control de tipo de sujeto, `null` para TROUPE y pruebas de regresion parametrizadas).
- T05 continúa bloqueada por la aclaración COC sobre `PUBLISHED`/`LOCKED`.
- T06 continúa en curso por revisión final de alcance (la comprobación manual responsive ya fue aprobada el 2026-09-14).
- T07 y T08 completadas con evidencia automatizada. T09-T11 pendientes; no se cierra el plan integral.

## Evidencia disponible

| Area | Comando | Resultado |
|---|---|---|
| Cliente Spec 017 y regresión | `node node_modules/vitest/vitest.mjs run --reporter=verbose` | 31 archivos, 109 tests aprobados, 0 fallidos. |
| Cliente build | `node node_modules/vite/bin/vite.js build` | Build Vite exitoso; 62 módulos transformados. |
| API/DB completa | `node --import=file:///C:/Users/modob/AppData/Local/Temp/opencode/spec017-test-env.mjs --test --test-concurrency=1` | 111 tests aprobados, 0 fallidos, base aislada `carnavales_spec017_validation_20260907`. |
| API específica | `node --import=file:///C:/Users/modob/AppData/Local/Temp/opencode/spec017-test-env.mjs --test --test-concurrency=1 src/tests/categories-api.test.js` | 1 aprobado, 0 fallidos. |
| Cliente específico | `node node_modules/vitest/vitest.mjs run src/tests/AdminCompetenciaPage.test.jsx src/tests/EventReadinessPanel.test.jsx --reporter=verbose` | 8 tests aprobados, 0 fallidos. |
| Re-run 2026-09-10 (T04) | `npx vitest run src/tests/AdminCompetenciaPage.test.jsx` + `npm test` + `npm run build` | AdminCompetenciaPage 33/33; suite cliente 41 archivos / 258 tests; build Vite exitoso (71 módulos). |
| Migración | `node --import=file:///C:/Users/modob/AppData/Local/Temp/opencode/spec017-test-env.mjs src/db/migrate.js` y segunda ejecución | Migraciones 001–066 aplicadas en base aislada; segunda ejecución sin migraciones pendientes. |
| Migracion y restricciones T02 | Runner Node sobre base aislada + `src/db/tests/migrate.test.js` y `competition-configuration.test.js` | 4 aprobados, 0 fallidos; cadena fresca 001-066 y segunda ejecucion sin pendientes. |
| Compatibilidad T02 | Runner Node sobre base aislada + resultados DB/API, sorteo, penalizaciones y actas | 16 aprobados, 0 fallidos. |

## Hallazgos abiertos

- Corregido en T07: el filtro detecta secretos por subcadena y solo exceptua allowNotPresented booleano. Pruebas verifican nombres concatenados, casing, sufijos y estructuras anidadas antes de cualquier consulta SQL.
- T02 migro `rubric_kind` a `rubric_type` y actualizo resultados, penalizaciones, actas, seeds y pruebas sin regresiones.
- T02/T03/T04 retiraron del modelo, API y UI el catálogo paralelo `participation_type`; `event_category` es el catálogo operativo.
- La relacion de apertura con `PUBLISHED`/`LOCKED` permanece pendiente de aclaracion y bloquea T05.

## Inspeccion del pedido ampliado

- Revision estatica, sin nueva ejecucion de tests: faltan filtros, preview, ordenamiento accesible, versionado y validacion temporal de jornadas del pedido ampliado.
- Corregido en T07: expectedSubjectType admite los seis valores soportados y se envia null para TROUPE.
- Corregido en T07: formularios conservan entradas fallidas, bloquean envios repetidos y tienen controles inline etiquetados; se explica metadata futura.
- Corregido en T08: migracion 067 impide nuevas altas NULL y desasignaciones; conserva criterios historicos pendientes.
- Los totales anteriores corresponden a ejecuciones previas y no prueban el alcance ampliado.

## Evidencia T09a/T09b (2026-09-10)

- RF-141b/RF-147b/RF-148b/RF-149b: ficha de comparsa con `brandColor`, busqueda/filtros de vista, preview "Vista jurado" sin escrituras y orden de pasada por jornada con reorder atomico.
- Migracion 072 aplicada en `carnavales2027_v2_test` (segunda ejecucion sin pendientes salvo validacion del propio test de migraciones, actualizado en el mismo incremento). Se detecto y documento: la BD de test conserva una fila `071_test_fixtures_extension.sql` cuyo archivo no existe en el arbol; por eso la migracion nueva usa la version 072. No se modifico ninguna migracion existente ni su checksum.
- `brandColor` validado contra el CHECK 069 `^#[0-9A-Fa-f]{6}$`; vacio normaliza a NULL; PATCH sin el campo preserva el valor. No activa el filtro de secretos de auditoria; se audita en `TROUPE_CREATED/UPDATED`.
- T09b clona el contrato T08: `SET CONSTRAINTS schedule_night_order_unique DEFERRED/IMMEDIATE`, 409 `ORDER_CONFLICT`/`ORDER_BOUNDARY`, auditoria `NIGHT_TROUPE_SCHEDULE_REORDERED` before/after, bloqueo con `EVENT_LOCKED` fuera de `CONFIGURING`. No crea/elimina asignaciones ni toca Spec 025.

| Area | Comando | Resultado |
|---|---|---|
| API/DB focal T09 | `node --test --test-concurrency=1 src/db/tests/migrate.test.js src/tests/troupes-branding-schedule-api.test.js src/tests/categories-api.test.js src/tests/competition-reorder-api.test.js src/tests/rubrics-api.test.js src/tests/events-api.test.js` (con `TEST_DATABASE_URL` a `carnavales2027_v2_test`) | 12 aprobados, 0 fallidos |
| API/DB integral | `node --test --test-concurrency=1` | 142/143; unico fallo `rate-limiting.test.js` (500 vs 400 en `judge-invitations/inspect`), reproducido tambien en arbol limpio via `git stash`: preexistente y ajeno al incremento |
| Cliente focal | `vitest run src/tests/AdminCompetenciaPage.test.jsx` | 39 aprobados (33 previos + 6 nuevos T09a/T09b) |
| Cliente integral | `vitest run` | 41 archivos / 264 tests aprobados |
| Build cliente | `vite build` | Exitoso, 71 modulos |
| Diff | `git diff --check` + `git status` | Sin errores; alcance acotado a troupes/schedule/admin.css/specs-017; sin secretos en el diff |

## Evidencia T09d - Eliminacion logica rotulada Eliminar (2026-09-14)

- RF-158/RF-159: `Eliminar` = baja logica (`active=false`) en la misma tabla; sin `DELETE` fisico ni tabla paralela. Comparsas sin migracion; eventos con migracion 075 (`carnival_event.active DEFAULT true`). `DELETE /events/:id` conserva guardas `CONFIGURING` + `EVENT_HAS_*` y audita `EVENT_DELETED` con `after.active=false`; reactivacion `PATCH {active:true}` auditada `EVENT_UPDATED`. UI: boton Eliminar + Dialog critico, filtro comparsas por defecto `Activas`, catalogo eventos oculta eliminados con toggle `Mostrar eliminados`, insignias `Inactiva` / `Eliminado (inactivo en BD)`, botones Reactivar. `openEvent` y `requireConfiguringEvent` rechazan inactivos (`EVENT_LOCKED`) con compatibilidad pre-075 (fallback `42703` con SAVEPOINT condicional) para esquemas historicos aislados.
- Archivos: `075_carnival_event_active.sql` (nueva), `event-service.js` (CRUD + `active`, `deleteEvent` soft), `event-readiness.service.js` (`openEvent` bloquea inactivo + compat), `migrate.test.js` (075), `event-delete.test.js` (soft + reactivacion), `AdminCompetenciaPage.jsx` + test (Eliminar/Reactiva/filtro), `AdminEventsPage.jsx` + test (toggle/reactivar), `AdminEventContext.jsx` (no auto-selecciona inactivos).

| Area | Comando | Resultado |
|---|---|---|
| Cliente focal | `npx vitest run src/tests/AdminEventsPage.test.jsx src/tests/AdminCompetenciaPage.test.jsx` | 2 archivos, 56 tests aprobados |
| Cliente integral | `npx vitest run` | 46 archivos / 306 tests en verde (un run previo 45/46 con 1 fallo intermitente tipo OfficialRecord, documentado como intermitencia conocida; re-run 46/46) |
| Cliente build | `npm run build` | Exitoso, 83 modulos |
| API focal | `node --import=dotenv/config --test --test-concurrency=1 src/tests/event-delete.test.js src/tests/events-api.test.js src/tests/categories-api.test.js` | 4 aprobados |
| API migracion | `... src/db/tests/migrate.test.js` | 1 aprobado (075 aplicada) |
| API integral | `node --import=dotenv/config --test --test-concurrency=1` | 175/175 aprobados |
| Diff | `git diff --check` | Sin errores de whitespace (solo advertencias LF/CRLF preexistentes del working tree) |

- Pendientes (no bloquean T09d): decisiones bloqueantes T05/T10/T11 sin cambios. Cambios ajenos preexistentes en el working tree (README, api/.env.example, package, AdminJudgesPage, seeds untracked) quedan fuera de alcance.

## Cierre manual T04/T08/T09a/T09b/T09d (2026-09-14)

- Comprobación manual responsive/teclado/táctil (390x844, 768x1024, 1440x900) de la configuración de competencia, incluida la ficha de comparsa, el reorden por jornada y Eliminar/Reactivar: **aprobada por el responsable del producto (2026-09-14)**. T04 completada. Restan T05/T10/T11 (bloqueadas por aclaraciones, no por validación manual) y el cierre integral T06.

## Evidencia T07

Comandos API ejecutados en api/ con el preloader local que apunta exclusivamente a carnavales_spec017_validation_20260907; no contiene credenciales hardcodeadas. Cliente ejecutado en client/.

| Area | Comando | Resultado |
|---|---|---|
| Auditoria y rubros | `node --import=file:///C:/Users/modob/AppData/Local/Temp/opencode/spec017-test-env.mjs --test --test-concurrency=1 src/db/tests/audit.test.js src/tests/rubrics-api.test.js` | 6 aprobados, 0 fallidos |
| API/DB integral | `node --import=file:///C:/Users/modob/AppData/Local/Temp/opencode/spec017-test-env.mjs --test --test-concurrency=1` | 113 aprobados, 0 fallidos, 0 omitidos |
| Formularios | `node node_modules/vitest/vitest.mjs run src/tests/AdminCompetenciaPage.test.jsx --reporter=verbose` | 27 aprobados |
| Cliente integral | `node node_modules/vitest/vitest.mjs run --reporter=verbose` | 133 aprobados, 31 archivos |
| Build | `node node_modules/vite/bin/vite.js build` | Exitoso, 62 modulos |
| Migracion aislada | `node --import=file:///C:/Users/modob/AppData/Local/Temp/opencode/spec017-test-env.mjs src/db/migrate.js` | No pending migrations |
| Sintaxis API | `node --check src/audit/audit-service.js` | Exit 0 |
| Diff | `git diff --check` | Sin errores; advertencias LF/CRLF |

- T07 no cambia tablas, endpoints ni reglas de readiness/publicacion. No necesita migracion nueva.
- Lint/typecheck no tienen scripts configurados; quedan pendientes del analisis estatico integral. Build y node --check no equivalen a typecheck.
- Se revisaron los cambios de T07 y no se agregaron secretos. Las eliminaciones ajenas de .hermes/plans permanecen intactas.
- Pendientes: comprobacion manual responsive/teclado/tactil de T04, T08 integridad/orden, T09 constructor/preview y decisiones bloqueantes T05/T10/T11.

## Evidencia T08

- RF-132/RF-139/RF-149: integridad y reordenamiento de items/criterios, conservando unicidad por rubro, huecos e inactivos. Auditoria transaccional before/after y solicitudes obsoletas rechazadas.
- Migracion 067 aplicada solo en carnavales_spec017_validation_20260907. No se modifico 066 ni su checksum, ni la base compartida.
- Las pruebas de historia crean un esquema dentro de una transaccion y aplican SQL relevante previo a 066, seguido de 066/067. Preservan IDs/contenido de criterios con cero/uno/varios items activos, incluyendo OPEN. Rollback del esquema de prueba, sin borrados de datos existentes.
- No se afirma instalacion fresca completa 001-067: el runner aislado ya tenia 001-066. La prueba historica de SQL no sustituye esa validacion integral pendiente.

Comandos desde api/ con el preloader local aislado, salvo los del cliente:

| Area | Comando | Resultado |
|---|---|---|
| API/DB focalizada | `node --import=file:///C:/Users/modob/AppData/Local/Temp/opencode/spec017-test-env.mjs --test --test-concurrency=1 src/db/tests/criterion-integrity-order.test.js src/tests/competition-reorder-api.test.js src/db/tests/migrate.test.js src/db/tests/configuration-closure.test.js src/db/tests/competition-configuration.test.js src/tests/rubrics-api.test.js` | 14 aprobados, 0 omitidos |
| API/DB completa | `node --import=file:///C:/Users/modob/AppData/Local/Temp/opencode/spec017-test-env.mjs --test --test-concurrency=1` | 121 aprobados, 0 fallidos/omitidos |
| Migracion | `node --import=file:///C:/Users/modob/AppData/Local/Temp/opencode/spec017-test-env.mjs src/db/migrate.js` | Primera aplicacion: Applied 067; repeticion: No pending migrations |
| Estado | `node --import=file:///C:/Users/modob/AppData/Local/Temp/opencode/spec017-test-env.mjs src/db/migrate.js --status` | 001-067 aplicadas |
| Cliente especifico | `node node_modules/vitest/vitest.mjs run src/tests/AdminCompetenciaPage.test.jsx --reporter=verbose` | 32 aprobados |
| Cliente focalizado final | `node node_modules/vitest/vitest.mjs run src/pages/OfficialRecordPage.test.jsx src/tests/AdminCompetenciaPage.test.jsx --reporter=verbose` | 35 aprobados |
| Cliente integral final | `node node_modules/vitest/vitest.mjs run --reporter=dot` | 138 aprobados, 31 archivos |
| Build cliente | `node node_modules/vite/bin/vite.js build` | Exitoso, 62 modulos |
| Diff | `git diff --check` | Sin errores; advertencias LF/CRLF |

### Hallazgos de validacion

- La revision detecto selectores no controlados con valores obsoletos tras recuperar un conflicto. Se corrige cerrando el editor tras recargar; al expandirlo se monta con los valores actuales. Prueba verifica tipo de rubro actualizado, no solo orden.
- Una ejecucion integral del cliente fallo en OfficialRecordPage.test.jsx:108 (137/138 aprobados); repeticion focalizada 35/35 y repeticion integral 138/138. La causa no se declara resuelta. No se modifico el modulo de actas; investigar intermitencia antes de cierre integral.
- Nuevos controles Subir/Bajar tienen nombres accesibles, no ejecutan cambios optimistas, bloquean envios repetidos y se ocultan con OPEN. No se afirma comprobacion manual de foco/responsive/tactil.
- Lint/typecheck siguen sin scripts configurados. T08 no cierra T04/T06 ni implementa T09, estados, versiones o reglas temporales.

## T09c - Visibilidad solo-cuando-corresponde (2026-09-15)

La seccion "Reorden de pasada" de la mesa de control solo se renderiza con evento `OPEN`, mas de una comparsa programada y cero planillas en la jornada (`hasBallots` desde `status.total`). Con votacion iniciada se oculta; sin cambio de reglas RF-153–157. Evidencia: focal `AdminVotingPage` 9/9 (incluye regresion "oculta el reorden cuando la jornada ya inició votación"), suite cliente 48 archivos / 328 tests en verde, build Vite 88 módulos, `git diff --check` limpio. Comprobacion manual pendiente.
