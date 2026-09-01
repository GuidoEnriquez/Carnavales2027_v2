# Tasks - Spec 006: Cierre de votacion sin reapertura

## Estado general

| ID | Estado | Dependencias |
|---|---|---|
| T01-T03 | Completadas | Spec y clarificaciones aprobadas |
| T04 | En progreso | Validación manual declarada como finalizada, pero falta documentar entorno, ejecutante y pasos reproducibles. |

## T01 - Bloquear reaperturas en persistencia y API

**RF:** RF-67, RF-68.

- Crear una migracion incremental que impida nuevas transiciones `SUBMITTED -> REOPENED`.
- Retirar la funcion y ruta de reapertura.
- Mantener la finalizacion de planillas historicas que ya esten `REOPENED`.

**Hecho cuando:** pruebas DB y API rechazan la reapertura y la ruta retirada responde 404.

## T02 - Mostrar pendientes en modal administrativo

**RF:** RF-69, RF-70.

- Retirar el formulario de reapertura de `AdminVotingPage`.
- Sustituir el mensaje de cierre rechazado por un dialogo modal con el detalle de pendientes recibido del servidor.
- Reutilizar el patron accesible de dialogo ya validado para la planilla de jurado.

**Hecho cuando:** prueba de cliente cubre detalle, foco, cierre, `Escape`, retorno de foco y ausencia de llamada de reapertura.

## T03 - Actualizar regresiones y documentacion

**RF:** RF-67-RF-70.

- Actualizar pruebas DB, API y cliente que esperaban reapertura.
- Actualizar `docs/source-map.md`, `docs/sdd-status.md` y la evidencia de validacion.

**Hecho cuando:** los contratos y la documentacion no describen reapertura vigente.

## T04 - Validacion final

**Dependencias:** T01-T03.

- Ejecutar pruebas especificas y suites API, DB y cliente, build, lint, typecheck, estado de migraciones y `git diff --check`.
- Comprobar el modal en 320 px, 768 px y escritorio, con teclado y lista extensa.

**Hecho cuando:** existe evidencia real para RF-67-RF-70 y no hay cambios fuera de alcance.
