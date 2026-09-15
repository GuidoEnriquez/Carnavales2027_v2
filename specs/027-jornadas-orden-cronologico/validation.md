# Validacion - Spec 027: Jornadas con orden cronologico automatico

| Tarea | Estado | Evidencia |
|---|---|---|
| T01 | Completada | Artefactos SDD del incremento creados y referenciados en `docs/source-map.md` y `docs/sdd-status.md`. |
| T02 | Completada | Migracion `071_night_chronological_order.sql` aplicada en base dev y test. `createNight`/`updateNight` exigen fecha y renumeran cronologicamente; duplicado 409, sin fecha 400. Pruebas DB y API especificas verdes. |
| T03 | Completada | Seed de Goya con fechas (backfill dev ejecutado); frontend sin campo Orden, fecha obligatoria y refresh de noches. Tests de cliente y build verdes. |
| T04 | Completada | Regresion completa API/DB y cliente en verde. |
| T05 | Completada | Migracion y backfill dev; suites, build, diff sin secretos; este documento y trazabilidad actualizados. |

## Evidencia

### Migracion

- `npm run db:migrate` (dev): `Applied: 071_night_chronological_order.sql`.
- Migracion aplicada y repetible (`getMigrationStatus`, segunda corrida: `No pending migrations`).
- Indice unico parcial `night_event_date_unique` sobre `(event_id, event_date) WHERE event_date IS NOT NULL`.
- La migracion renumerra con el trigger operativo (029) suspendido durante el ciclo; se re-ejecuto sin errores sobre una base que contiene eventos `OPEN` con jornadas (base de test).

### Backend

Comando: `npm test` (suite API + DB + resultados, base aislada).

**Resultado: 141/141 tests, 5 suites, sin fallos.**

Casos nuevos cubiertos:

- `events.test.js` (DB): orden cronologico al crear (noche creada primero con fecha posterior queda atras), crear con fecha anterior la coloca primera, fechas duplicadas `NIGHT_DATE_DUPLICATE`, falta de fecha `NIGHT_DATE_REQUIRED`, fecha invalida `NIGHT_DATE_INVALID` (2027-02-30), editar fecha reordena el conjunto.
- `events-api.test.js` (API): `POST /events/:id/nights` sin `displayOrder`; segunda jornada mas temprana pasa a `displayOrder` 1; duplicado 409 `{code:"NIGHT_DATE_DUPLICATE"}`; sin fecha 400 `{code:"NIGHT_DATE_REQUIRED"}`; `PATCH /nights/:id` con fecha posterior reordena (2); `GET` devuelve ambas ordenadas por fecha.
- `migrate.test.js`: lista esperada actualizada a 071.
- Callers legacy actualizados (`event-readiness`, `schedule`, `configuration-closure`, `readiness-api`).

### Cliente

Comando: `npm test` (Vitest). **Resultado: 41 archivos / 258 tests pasados.**

Comando: `npm run build`. **Resultado: Vite 71 modulos, build exitoso (index-Crk8KGEE.css 108 kB, index-DrwBbT9p.js 382 kB).**

Test especifico `EventConfigurationPage.test.jsx`: creacion de jornada sin orden manual, con fecha en el body y refresh de noches posterior al guardado.

### Base de desarrollo

- Migracion 071 aplicada; dev data confirmada sin fechas duplicadas.
- Backfill dev del evento Goya (`2e3d2f48-...`): jornadas con fechas 2027-02-05/06/07/12 y `display_order` 1-4 cronologico.
- `git diff` revisado: sin secretos; `goya-2027.js` mantiene la guarda `GOYA_SEED_FORBIDDEN_IN_PRODUCTION`.

## Pendientes

- Comprobacion manual responsive proporcional de la seccion Jornadas (viewports 390x844, 768x1024, 1440x900) queda registrada como validacion manual recomendada antes del cierre operativo del incremento; el alcance funcional ya esta cubierto por pruebas automatizadas y build.