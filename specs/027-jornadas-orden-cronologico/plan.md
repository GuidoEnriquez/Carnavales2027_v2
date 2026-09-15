# Plan - Spec 027: Jornadas con orden cronologico automatico

## Enfoque

Cambio acotado al dominio de configuracion de eventos/jornadas. Se mantiene `display_order` como dato derivado de `event_date`; la fecha pasa a ser obligatoria en servicio y UI; se agrega unicidad de fecha por evento y renumeracion transaccional determinista. No se toca votacion, resultados, actas ni readiness.

## Decisiones de implementacion

1. **Migracion 071** `071_night_chronological_order.sql`:
   - Indice unico parcial `(event_id, event_date) WHERE event_date IS NOT NULL`.
   - Renumeracion de datos existentes en dos fases (`+1000000` y luego `row_number()` por evento ordenando `event_date NULLS LAST, created_at, id`).
2. **`api/src/modules/events/event-service.js`**:
   - `createNight` requiere `eventDate` (400 `NIGHT_DATE_REQUIRED` si falta, 400 `VALIDATION_ERROR` si es invalida), rechaza duplicado (409 `NIGHT_DATE_DUPLICATE`) y renormaliza el evento en la misma transaccion.
   - `updateNight` valida fecha, rechaza duplicado (excluyendo la propia jornada) y renormaliza todo el evento al cambiar datos.
   - Helper interno `normalizeNightOrder` con advisory lock por evento y renumeracion en dos fases.
   - Deteccion de contexto transaccional (`pg_current_xact_id_if_assigned`) para operar tanto dentro de una transaccion del caller como de forma autonoma.
3. **`api/src/routes/http-errors.js`**: mapeo de `NIGHT_DATE_REQUIRED` (400), `NIGHT_DATE_INVALID` (400 `VALIDATION_ERROR`) y `NIGHT_DATE_DUPLICATE` (409).
4. **`api/src/scripts/seed-goya-2027.js`**: jornadas con fechas y `DO UPDATE` de `event_date` sobre conflictos (backfill de datos de desarrollo).
5. **`client/src/pages/EventConfigurationPage.jsx`**: se quita el campo "Orden" en alta y edicion; "Fecha" pasa a obligatoria; tras guardar una jornada se recarga la lista desde el API; se agregan mensajes de error de fecha.
6. **Pruebas**: se actualizan las llamadas a `createNight` (fecha) y se agregan casos de orden cronologico, duplicado y reordenamiento en `api/src/db/tests/events.test.js` y `api/src/tests/events-api.test.js`; se actualiza el test de cliente.

## Orden de ejecucion

Migracion -> servicio -> errores -> seed -> cliente -> pruebas -> validacion integral.

## Validacion

Suites API y DB aisladas, tests de cliente y build Vite; aplicacion de la migracion 071 en la base de desarrollo; comprobacion manual proporcional en la seccion de eventos.