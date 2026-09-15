# Spec 027 — Jornadas con orden cronologico automatico

## Estado

Propuesta aprobada por product owner el 2026-09-14. Comportamiento vigente de I1 (Spec 001) para la asignacion manual de `display_order` en jornadas.

## Objetivo

Al crear o editar jornadas en la seccion de eventos, el orden de presentacion (`display_order`) debe asignarse automaticamente en base al orden cronologico de las fechas que determina el administrador, en lugar de requerir un orden manual.

## Alcance

- Configuracion de jornadas en la seccion de eventos (API ADMIN + cliente).
- Fecha obligatoria para toda jornada.
- Rechazo de fechas duplicadas dentro del mismo evento.
- Recaculo y reordenamiento de todas las jornadas del evento al editar la fecha de cualquiera de ellas.
- Migracion 071, servicios, seed de Goya y pruebas asociadas.

## Fuera de alcance

- No se modifica la programacion por noche (`night_troupe_schedule`), cupos, asignaciones, votacion, resultados ni actas.
- No se elimina la columna `display_order`: se sigue persistiendo como derivado de la fecha para mantener el contrato de ordenamiento existente (`listNights`).
- No se reabre la especificacion de readiness ni la apertura de eventos.

## Requerimientos funcionales

- **RF-166.** EL SISTEMA DEBE asignar automaticamente el `display_order` de las jornadas de un evento segun el orden cronologico de su `event_date`, sin exigir que el administrador indique un orden manual.
- **RF-167.** EL SISTEMA DEBE exigir `event_date` para crear o editar una jornada. Una jornada sin fecha DEBE rechazarse sin guardar cambios.
- **RF-168.** EL SISTEMA DEBE rechazar un `event_date` duplicado dentro del mismo evento (409 `NIGHT_DATE_DUPLICATE`).
- **RF-169.** CUANDO se edita el `event_date` de una jornada existente, EL SISTEMA DEBE recalcular y reordenar las `display_order` de todas las jornadas del evento en el mismo ciclo transaccional.
- **RF-170.** El orden derivado DEBE ser determinista: mismas fechas producen el mismo orden, y ante fechas iguales (solo posibles en datos historicos pre-migracion) el desempate es por `created_at` y luego `id`.

## Requerimientos no funcionales

- **RNF-35.** El algoritmo de reordenamiento DEBE preservar la unicidad de `(event_id, display_order)` durante la operacion (renumeracion transaccional en dos fases) y ser seguro ante accesos concurrentes mediante advisory lock por evento.
- **RNF-36.** La interfaz DEBE ​​eliminar el campo de orden manual y declarar la fecha como obligatoria, con mensajes de error comprensibles y accesibles (`aria-live`).
- **RNF-37.** Migraciones reproducibles y no destructivas: las jornadas historicas con `event_date` nulo se conservan (`NULLS LAST`) y no se eliminan.

## Criterios de validacion

- Crear 3 jornadas con fechas no consecutivas produce `display_order` 1-2-3 segun el orden de las fechas, no segun el orden de creacion.
- Crear una jornada con fecha anterior a todas reordena el evento (la nueva pasa a `display_order` 1).
- Crear/editar con la misma fecha de otra jornada responde 409 `NIGHT_DATE_DUPLICATE`.
- Crear/editar sin fecha responde 400 `NIGHT_DATE_REQUIRED`.
- Editar la fecha de una jornada existente reordena todo el conjunto.
- El formulario de jornadas no expone el campo "Orden".
- Suites API/DB/cliente y build pasan.