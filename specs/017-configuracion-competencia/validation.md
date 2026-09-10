# Validacion - Spec 017: Configuracion de competencia

## Estado

### Verificación integral del estado actual (2026-09-10)

- Cliente: `npm.cmd test` → 45 archivos / 282 tests en verde; `npm.cmd run build` → 83 módulos transformados, build exitoso.
- API/DB: `npm.cmd test` → 142 tests en verde.
- `git diff --check`: sin errores de whitespace; las advertencias LF/CRLF corresponden a la configuración del working tree.
- T09a/T09b permanecen automatizadas y validadas; T04 continúa pendiente de comprobación manual responsive y T05/T10/T11 siguen bloqueadas por sus aclaraciones documentadas.

- Incremento activo; T03 validada automaticamente para su alcance original. El pedido ampliado no esta validado.
- T01 completada el 2026-09-07.
- T02 completada automaticamente.
- T03 completada el 2026-09-07.
- T04 en curso: se corrige la declaracion prematura de completitud; falta comprobacion responsive y resolver hallazgos de inspeccion.
- T05 continúa bloqueada por la aclaración COC sobre `PUBLISHED`/`LOCKED`.
- T06 continúa en curso por la comprobación manual responsive y revisión final de alcance.
- T07 y T08 completadas con evidencia automatizada. T09-T11 pendientes; no se cierra el plan integral.

## Evidencia disponible

| Area | Comando | Resultado |
|---|---|---|
| Cliente Spec 017 y regresión | `node node_modules/vitest/vitest.mjs run --reporter=verbose` | 31 archivos, 109 tests aprobados, 0 fallidos. |
| Cliente build | `node node_modules/vite/bin/vite.js build` | Build Vite exitoso; 62 módulos transformados. |
| API/DB completa | `node --import=file:///C:/Users/modob/AppData/Local/Temp/opencode/spec017-test-env.mjs --test --test-concurrency=1` | 111 tests aprobados, 0 fallidos, base aislada `carnavales_spec017_validation_20260907`. |
| API específica | `node --import=file:///C:/Users/modob/AppData/Local/Temp/opencode/spec017-test-env.mjs --test --test-concurrency=1 src/tests/categories-api.test.js` | 1 aprobado, 0 fallidos. |
| Cliente específico | `node node_modules/vitest/vitest.mjs run src/tests/AdminCompetenciaPage.test.jsx src/tests/EventReadinessPanel.test.jsx --reporter=verbose` | 8 tests aprobados, 0 fallidos. |
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

- Pendientes (no bloquean T09a/T09b): comprobacion manual responsive/teclado/tactil (390x844, 768x1024, 1440x900) de la nueva ficha y del reorder por jornada; decisiones bloqueantes T05/T10/T11 sin cambios.

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
