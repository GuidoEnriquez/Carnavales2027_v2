# Validación — Spec 032

Implementado y validado en master el 2026-09-15 (commits `03b5556` y
`e42282e`). Evidencia verificada por inspección directa del árbol y del
historial en master; conteos de suites según mensaje del commit
`e42282e`. No se modificó código, solo estos documentos.

## Evidencia

| Verificación | Resultado |
|---|---|
| `api/src/db/migrations/077_reglamento_version.sql` existe y es aditiva | `ALTER TABLE carnival_event ADD COLUMN IF NOT EXISTS reglamento_version TEXT;` + idem para `official_scrutiny_record`, con COMMENT en ambas; NULL = anterior a SVC2-89 |
| `api/src/db/tests/migrate.test.js` lista la 077 | `filename === "077_reglamento_version.sql"` en el filtro y entrada `{ filename: "077_reglamento_version.sql", version: "077", applied: true }` en el estado esperado |
| `api/src/db/tests/full-event-seed.test.js` exige `v1` | `assert.equal((await pool.query("SELECT reglamento_version FROM carnival_event WHERE id=$1", [eventId])).rows[0].reglamento_version, "v1")` |
| `api/src/db/seeds/full-event.fixture.js` | `reglamentoVersion: "v1"`, `fixtureVersion: "2027.3"`, `officialData: false`; `FULL_NIGHTS` J1/J2/J3 con `relativeNightDate(0)` (mismo día del seed) |
| `api/src/db/seeds/full-event.js` | INSERT `INTO carnival_event(name, reglamento_version) VALUES($1, $2)` con `FULL_EVENT.reglamentoVersion` |
| `api/src/modules/scrutiny-records/scrutiny-record-service.js` | SELECT incluye `reglamento_version`; payload suma `reglamentoVersion: event.reglamento_version ?? null`; INSERT persiste `reglamento_version` con `event.reglamento_version ?? null` |
| `docs/Reglamento_Carnaval_v1.pdf` commiteado en `e42282e` | 6 388 488 bytes (`Bin 0 -> 6388488 bytes` en el stat del commit) |
| Suite DB | **95/95** (mensaje del commit `e42282e`) |
| Suite API | **190/190** (mensaje del commit `e42282e`) |

## Cobertura RF

- RF-REG-01: migración 077 en disco + caso en `migrate.test.js` con estado `applied: true`.
- RF-REG-02/03: fixture + INSERT del seed y lectura/sellado en el servicio de actas, con assert `v1` en `full-event-seed.test.js`.
- RF-REG-04: PDF presente en `docs/` (6 388 488 bytes).
- RF-REG-05: `FULL_NIGHTS` con las tres jornadas en `relativeNightDate(0)` (commit `03b5556`, "DB 95/95"); `fixtureVersion: "2027.3"`.
- RF-REG-06: el diff de `e42282e` toca solo migración, seed/fixture, servicio de actas, los dos tests y el PDF (7 archivos); sin cambios de reglas.
