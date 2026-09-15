# Clarificaciones - Spec 027: Jornadas con orden cronologico automatico

## Decisiones confirmadas (product owner, 2026-09-14)

| Tema | Decision |
|---|---|
| Fecha obligatoria | La fecha debe volverse obligatoria para poder calcular el orden. Sin fecha la jornada no se guarda. |
| Editar fecha posterior | Al editar la fecha de una jornada existente, el sistema recalcula y reordena todas las jornadas del evento. |
| Fechas duplicadas | No se permite que dos jornadas del mismo evento compartan fecha. |

## Decisiones tecnicas

- Se conserva `display_order` como derivado de `event_date` (y ante nulos historicos, de `created_at` y `id`) para no cambiar el contrato de ordenamiento existente (`listNights ORDER BY display_order`).
- La guarda de fecha obligatoria se implementa en la capa de servicio/API y UI; la base de datos conserva `event_date` nullable para no romper datos historicos, y agrega un indice unico parcial `(event_id, event_date) WHERE event_date IS NOT NULL`.
- La renumeracion se realiza en una transaccion y en dos fases (offset grande + `row_number`) para no violar el indice unico `(event_id, display_order)` no deferrable.
- Se usa `pg_advisory_xact_lock` por evento para serializar altas/ediciones concurrentes de jornadas con `openEvent` y entre si.
- El `PATCH /nights/:nightId` ignora cualquier `displayOrder` recibido del cliente (no se usa), evitando desincronizacion con el orden derivado.
- El seed de Goya recibe fechas y el re-ejecutar el seed actualiza `event_date` de jornadas ya existentes (datos de desarrollo, `SEED_ADMIN_FORBIDDEN_IN_PRODUCTION` sigue vigente).

## Pendiente

- Ninguno para el alcance aprobado. La apertura y readiness de eventos no cambian.