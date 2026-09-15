# Tasks - Spec 027: Jornadas con orden cronologico automatico

## Estado general

| ID | Estado | Dependencias |
|---|---|---|
| T01 | Completada | Ninguna |
| T02 | Completada | T01 |
| T03 | Completada | T02 |
| T04 | Completada | T03 |
| T05 | Completada | T04 |

## T01 - Formalizar el incremento

**RF:** RF-166-RF-170, RNF-35-RNF-37.
**Hecho cuando:** spec, clarificaciones, plan, tareas y validacion inicial existen; `docs/source-map.md` y `docs/sdd-status.md` identifican Spec 027.

## T02 - Migracion y servicio de jornadas

**RF:** RF-166-RF-170; RNF-35, RNF-37.
**Alcance:** migracion 071 (indice unico parcial y renumeracion), `createNight`/`updateNight` con fecha obligatoria, orden autocratico cronologico al crear y reordenamiento al editar, advisory lock por evento, mapeos de error en rutas.

**Hecho cuando:** migracion aplicable y repetible, pruebas DB y API especificas pasan.

## T03 - Seed y cliente

**RF:** RF-166, RF-167, RF-169; RNF-36.
**Alcance:** seed de Goya con fechas y backfill de `event_date`; `EventConfigurationPage` sin campo "Orden", fecha obligatoria, recarga de noches tras guardar y mensajes de error de fecha.

**Hecho cuando:** tests de cliente y build pasan; el seed no rompe datos existentes.

## T04 - Pruebas de regresion

**RF:** RF-166-RF-170.
**Alcance:** actualizar llamadas a `createNight` con fecha en `events.test.js`, `event-readiness.test.js`, `schedule.test.js`, `configuration-closure.test.js` y `events-api.test.js`; casos nuevos de orden cronologico, duplicado 409, falta de fecha 400 y reordenamiento al editar; test de cliente de jornadas.

**Hecho cuando:** suites DB y API completas y tests de cliente pasan.

## T05 - Validacion integral y cierre

**RF:** Todos.
**Alcance:** migracion en base de desarrollo, suites, build, diff sin secretos, `validation.md` con evidencia y actualizacion de `docs/source-map.md`, `docs/sdd-status.md` y `AGENTS.md`.

**Hecho cuando:** `validation.md` contiene evidencia real y no quedan fallos ni tareas bloqueadas.