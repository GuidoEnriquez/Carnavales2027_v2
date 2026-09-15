# Spec 032 — Versionado del reglamento aplicado (SVC2-89)

Fuente: Jira SVC2-89, implementado en master en commit `e42282e`
("feat(reglamento): versionar reglamento aplicado"). Trabajo ya
implementado; esta spec lo documenta, no lo modifica. Datos, personas,
fechas y horarios del seed son ficticios, nunca COC oficial.

- **RF-REG-01:** migración `077_reglamento_version.sql` agrega columnas
  aditivas y anulables `carnival_event.reglamento_version` y
  `official_scrutiny_record.reglamento_version` (TEXT, `IF NOT EXISTS`,
  con COMMENT). NULL = evento/acta anterior a SVC2-89. Sin ruptura de
  datos ni comportamiento existente.
- **RF-REG-02:** el seed integral guarda `v1` en el evento: fixture
  `FULL_EVENT.reglamentoVersion = "v1"` en
  `api/src/db/seeds/full-event.fixture.js` e INSERT con
  `reglamento_version` en `api/src/db/seeds/full-event.js`.
- **RF-REG-03:** al certificar el acta, `certifyScrutinyRecord`
  (`api/src/modules/scrutiny-records/scrutiny-record-service.js`) lee
  `reglamento_version` del evento, la sella en
  `payload.event.reglamentoVersion` (NULL si ausente) y la persiste en
  la columna `official_scrutiny_record.reglamento_version`.
- **RF-REG-04:** PDF del reglamento commiteado como
  `docs/Reglamento_Carnaval_v1.pdf` (6 388 488 bytes), versión `v1`
  vigente para el evento del seed.
- **RF-REG-05:** seed con fechas relativas al día: `FULL_NIGHTS` con las
  tres jornadas en `relativeNightDate(0)` (mismo día del seed, zona
  America/Argentina/Cordoba; commit `03b5556`), `fixtureVersion 2027.3`
  y `officialData: false` en el metadata del fixture.
- **RF-REG-06:** no modificar reglas de puntaje, cierre, secreto, 2FA,
  reemplazo ni cálculo. Solo versionar el reglamento aplicado.

Validación: migración 077 aplicada y listada en `migrate.test.js`;
assert `reglamento_version = "v1"` en `full-event-seed.test.js`;
suites DB 95/95 y API 190/190. Detalle y salidas en `validation.md`.
