# Tasks - Spec 017: Configuracion de competencia

## Estado general

| ID | Estado | Dependencias |
|---|---|---|
| T01 | Completada | Ninguna |
| T02 | Completada | T01 |
| T03 | Completada | T02 |
| T04 | En curso | T03 |
| T05 | Bloqueada por aclaracion | T02 |
| T06 | En curso | T02-T05 |
| T07 | Completada | T03 |
| T08 | Completada (automatica) | T07 |
| T09 | Pendiente | T08 |
| T10 | Bloqueada por aclaracion temporal | T07 |
| T11 | Bloqueada por aclaracion de versiones | T02 |

## T01 - Formalizar el incremento

**RF:** Todos.
**Hecho cuando:** spec, clarificaciones, plan, tareas y validacion inicial existen; `docs/source-map.md` y `docs/sdd-status.md` identifican Spec 017.

## T02 - Migrar jerarquia y metadata

**RF:** RF-132-RF-140; RNF-30-RNF-32.
**Alcance:** `rubric_type`, metadata de resolucion, orden/metadata de item, FK criterio-item, backfill historico y migracion de consumidores SQL cerrados. No incluye estados ni UI.

**Hecho cuando:** migracion fresca y repetida, pruebas DB y suites de resultados aplicables pasan sin perdida de datos.

## T03 - Ajustar API administrativa

**RF:** RF-131-RF-142; RNF-31, RNF-34.
**Alcance:** codigos derivados, orden automatico compatible, CRUD de criterios por item, reasignacion historica, errores y auditoria.

**Hecho cuando:** pruebas API especificas y suite API pasan.

**Evidencia:** API específica de categorías 1/1 y suite API/DB completa 111/111 en la base aislada de Spec 017.

## T04 - Separar Evento y Competencia en cliente

**RF:** RF-130-RF-142; RNF-33.
**Alcance:** ruta, navegacion, categorias como tipos de participacion, constructor jerarquico y matriz derivada.

**Hecho cuando:** pruebas UI, build y comprobacion responsive proporcional pasan.

**Evidencia:** pruebas cliente completas 31 archivos, 109 tests; build Vite exitoso. La comprobacion manual responsive sigue pendiente y bloquea el cierre de T04. La inspeccion posterior detecto falta del control expectedSubjectType para rubros NOMINATION; requiere correccion y prueba de regresion.

## T05 - Implementar estados de configuracion y competencia

**RF:** RF-143-RF-144.
**Bloqueo:** definir relacion entre `PUBLISHED`, `LOCKED` y apertura de competencia.

**Hecho cuando:** transiciones, autorizacion, auditoria, guardas DB/API y pruebas estan cerradas conforme a la aclaracion.

## T06 - Validacion integral y cierre

**RF:** Todos.
**Alcance:** migraciones, seeds, API, DB, cliente, build, lint/typecheck, diff, secretos y validacion manual.

**Hecho cuando:** `validation.md` contiene evidencia real y no quedan fallos ni tareas bloqueadas.

## T07 - Corregir base administrativa y filtro de auditoria

**RF:** RF-145, RF-146, RNF-34.
**Alcance:** sujeto de nominacion en alta/edicion, preservacion de entradas ante error, bloqueo de envios repetidos, nombres accesibles y explicacion de metadata futura. Filtro de secretos por subcadena con excepcion exacta booleana para allowNotPresented.
**Hecho cuando:** pruebas de regresion de formularios y filtro, suites API/DB y cliente, build y diff comprobados. No cierra T04 ni sustituye comprobacion manual.

**Evidencia:** 27 pruebas especificas de formularios, 6 de auditoria/API rubros, 113 API/DB completas, 133 cliente en 31 archivos; build de 62 modulos exitoso. Sin nuevas migraciones; runner aislado informa No pending migrations. Diff sin errores de whitespace. Lint/typecheck no configurados, no se afirma su ejecucion.

## T08 - Integridad y ordenamiento

**RF:** RF-132, RF-139, RF-149.
**Alcance:** migracion incremental que preserve huerfanos historicos e impida nuevas altas sin item; reordenamiento transaccional con auditoria y pruebas concurrentes antes de conectar UI.

**Hecho cuando:** migracion y preservacion historica comprobadas; API de item/criterio con vecinos y ordenes esperados, auditoria before/after, concurrencia y autorizacion probadas; controles subir/bajar conectados solo tras validar BD/API. Suites y build ejecutados. No cierra validacion manual de T04.

**Evidencia:** migracion 067 aplicada en base aislada, runner sin pendientes; preservacion historica en esquema transaccional con SQL relevante sin modificar. Suite focalizada API/DB 14/14, integral 121/121. Cliente especifico 32/32 e integral final 138/138; build exitoso. Fallo intermitente de prueba de Acta Oficial registrado en validation.md. No se repitio cadena fresca completa 001-067; queda en T06 junto a comprobacion manual y analisis estatico.

## T09 - Constructor, filtros y preview

**RF:** RF-147, RF-148.
**Alcance:** constructor progresivo, filtros, detalle de matriz y preview por especialidad sin efectos de votacion. Pruebas de aislamiento por especialidad y ausencia de escrituras.

## T10 - Revision historica y jornadas

**RF:** RF-150, RF-151.
**Bloqueo:** fuente del anio/temporada y momento de bloqueo de inconsistencias. No convertir categorias por nombre.

## T11 - Versionado de configuracion

**RF:** RF-152.
**Bloqueo:** vigencia de versiones y referencias de asignaciones/planillas. Coordinar con T05 antes de migrar.
