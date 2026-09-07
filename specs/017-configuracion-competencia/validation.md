# Validacion - Spec 017: Configuracion de competencia

## Estado

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
