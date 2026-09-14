# Tasks - Spec 017: Configuracion de competencia

## Estado general

| ID | Estado | Dependencias |
|---|---|---|
| T01 | Completada | Ninguna |
| T02 | Completada | T01 |
| T03 | Completada | T02 |
| T04 | Completada (manual 2026-09-14) | T03 |
| T05 | Bloqueada por aclaracion | T02 |
| T06 | En curso | T02-T05 |
| T07 | Completada | T03 |
| T08 | Completada (automatica) | T07 |
| T09 | En curso (desdoblada en T09a/T09b) | T08 |
| T09a | Completada (automatica 2026-09-10) | T08 |
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

**Evidencia:** pruebas cliente completas 41 archivos, 258 tests; build Vite exitoso. El hallazgo de falta del control `expectedSubjectType` para rubros NOMINATION fue resuelto en T07: el control admite los seis valores soportados (PERSON, COUPLE, GROUP, FIGURE, ELEMENT, OTHER), se envia null para TROUPE y cuenta con pruebas de regresion parametrizadas en `AdminCompetenciaPage.test.jsx` (it.each de creacion y edicion; 33/33 aprobados el 2026-09-10). Comprobación manual responsive/teclado/táctil (390x844, 768x1024, 1440x900): **aprobada por el responsable del producto (2026-09-14)**. T04 completada.

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

## T09a - Ficha de comparsa: color, filtros y preview (2026-09-10)

**RF:** RF-141b, RF-147b, RF-148b; RNF-33, RNF-34.
**Alcance:** exponer `brandColor` en API troupes (sin migracion), busqueda/filtros de vista, validacion inline por campo, preview "Vista jurado" sin escrituras. Reutiliza `SaveForm`, `StatusPill`, `WriteContext`.
**Hecho cuando:** tests API de color + tests cliente de ficha/filtros/preview en verde; build ok; sin cambios en readiness/apertura/votos.
**Estado:** Completada (automatica 2026-09-10). `brandColor` cableado en `category-service.js` (sin migracion, columna 069 vigente); UI con busqueda/filtros, validacion inline y preview "Vista jurado".

## T09b - Orden de pasada por jornada (2026-09-10)

**RF:** RF-149b; RNF-33, RNF-34.
**Alcance:** lectura de schedule por jornada y reorder atomico Subir/Bajar con 409 obsoleto (contrato clon T08); UI por jornada oculta con OPEN. No crea/elimina asignaciones, no abre votacion, no toca Spec 025.
**Hecho cuando:** tests DB/API de intercambio + concurrencia + autorizacion en verde; controles conectados solo tras validar BD/API; build ok.
**Estado:** Completada (automatica 2026-09-10). Migracion 072 (`schedule_night_order_unique` DEFERRABLE), servicio `schedule-service.js`, rutas `GET /events/:eventId/schedule` y `POST /schedule/:scheduleId/reorder`, UI `TroupeScheduleSection`.

## T09c - Reorden de pasada en evento abierto (2026-09-12)

**RF:** RF-153, RF-154, RF-155, RF-156, RF-157; RNF-33, RNF-34.
**Alcance:** `PATCH /events/:id/schedule/reorder` (`{nightId, orderedIds[], reason?}`) habilitado en `OPEN` solo con ADMIN+2FA, motivo obligatorio (422 sin motivo) y cero ballots en la jornada (409 con votacion iniciada); en `CONFIGURING` mantiene reglas vigentes sin motivo. Auditoria append-only `NIGHT_TROUPE_SCHEDULE_REORDERED`. UI Subir/Bajar + motivo en mesa de control (`AdminVotingPage`), no en Competencia. Sin tocar votacion/puntajes/resultados.
**Hecho cuando:** tests API (OPEN con motivo OK; sin motivo 422; con ballots 409; sin 2FA 403; CONFIGURING sin motivo OK) y tests cliente en verde; suites API + cliente + build + `git diff --check` sin fallos.
**Estado:** En curso (automatica 2026-09-12).

## T09d - Eliminacion logica rotulada Eliminar (2026-09-14)

**RF:** RF-158, RF-159; RNF-30, RNF-33, RNF-34.
**Alcance:** comparsas: boton Eliminar + Dialog que hace `PATCH active:false`, filtro por defecto Activas, insignia Inactiva, reactivar via Editar. Eventos: migracion 075 `carnival_event.active`, `DELETE` = baja logica con guardas vigentes, catalogo oculta inactivos por defecto con toggle, insignia + Reactivar via `PATCH active:true`. Sin DELETE fisico ni tabla paralela.
**Hecho cuando:** tests API (soft-delete comparsa/evento, reactivacion, bloqueo con historial, sin perdida de filas) y cliente (eliminar/reactivar/filtro por defecto) en verde; suites + build + `git diff --check` sin fallos.
**Estado:** Completada (automatica 2026-09-14). Migracion 075, `DELETE` evento = baja logica, boton Eliminar + Dialog en comparsas y eventos, filtro por defecto Activas / catalogo sin eliminados + toggle, reactivacion via PATCH.

## T10 - Revision historica y jornadas

**RF:** RF-150, RF-151.
**Bloqueo:** fuente del anio/temporada y momento de bloqueo de inconsistencias. No convertir categorias por nombre.

## T11 - Versionado de configuracion

**RF:** RF-152.
**Bloqueo:** vigencia de versiones y referencias de asignaciones/planillas. Coordinar con T05 antes de migrar.
