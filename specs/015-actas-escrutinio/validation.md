# Validación — Spec 015: Actas Oficiales y Certificación de Escrutinio

## Estado

- Especificación, clarificaciones y plan aprobados el 2026-09-03.
- **T01 completada el 2026-09-03:** Migración 063 (`063_official_scrutiny_record.sql`) aplicada. Suite `scrutiny-records.test.js` implementada con 8 tests cubriendo precondición de liberación (`RESULTS_NOT_RELEASED`), roles autorizados (`ESCRIBANO`/`SCRUTINEER`), rechazo de roles ajenos, unicidad por evento, y trigger de inmutabilidad estricta contra `UPDATE` y `DELETE` (`OFFICIAL_RECORD_IMMUTABLE`). Suite de persistencia total: 60 passed, 0 failed.
- **T02 completada el 2026-09-03:** Módulo `scrutiny-record-service.js` implementado con canonicalización JCS (RFC 8785) y hashing SHA-256 (`computeRecordHash`), validación bit a bit (`verifyRecordIntegrity`), emisión transaccional (`certifyScrutinyRecord`) con payload canónico (nómina de jurados, comparsas, rubros artísticos, triple columna de Mejor Comparsa con penalizaciones y memoria de desempate) e idempotencia. Tests de persistencia ampliados a 62 tests passing.
- **T03 completada el 2026-09-03:** Endpoints HTTP (`POST /events/:eventId/scrutiny-record` y `GET /events/:eventId/scrutiny-record`), middleware `requireScrutinyCertificationAccess` y mapeo de errores HTTP 403, 404, 409. Suite de integración `scrutiny-records-api.test.js` cubre rechazo no autenticado (401), sin 2FA (403), prohibición estricta para ADMIN (403 `OFFICIAL_RECORD_EMISSION_FORBIDDEN_FOR_ADMIN`), rechazo antes de liberación de resultados (403 `RESULTS_NOT_RELEASED`), emisión exitosa por ESCRIBANO con 2FA (201), idempotencia ante llamada por SCRUTINEER (200), y consulta pública con verificación de integridad criptográfica (200 con `integrityVerified: true`). Suite API total: 107 passed, 0 failed.
- **T04 completada el 2026-09-03:** Vista notarial formal `OfficialRecordPage.jsx` con encabezado institucional, número oficial de acta, sello de integridad digital SHA-256, listas de comparsas y jurados, tabla de rubros artísticos, tabla de Mejor Comparsa con triple columna (bruto, penalizaciones, neto), memoria reglamentaria de desempates y cuadro de rúbricas hológrafas. Reglas de impresión `@media print` implementadas en `index.css` aislando el documento y ocultando elementos no imprimibles. Enlace montado en navegación (`AppNavigation.jsx`), en `AdminResultsPage.jsx` y ruta protegida `#/admin/record` en `App.jsx`.
- **T05 completada el 2026-09-03:** Suite de pruebas del cliente `OfficialRecordPage.test.jsx` (3 tests) pasando. Suites completas del sistema ejecutadas: DB (62/62), API (107/107), Cliente (99/99). Build de producción de Vite exitoso en 881ms.
- **T06 completada el 2026-09-03:** Comprobación manual de layout en móvil (390×844), tablet (768×1024) y escritorio (1440×900). Verificación de wrapping del hash SHA-256 en viewports angostos, grids adaptables de jurados y firmas, y aislamiento limpio en reglas de impresión `@media print`.

## Evidencia ejecutada

| Área | Comando | Resultado |
|---|---|---|
| Persistencia | `npm run db:test` en `api/` | 62 passed, 0 failed. Incluye 10 tests en `scrutiny-records.test.js` y `migrate.test.js`. |
| API | `npm test` en `api/` | 107 passed, 0 failed. Incluye `scrutiny-records-api.test.js`. |
| Cliente Tests | `npm test -- --run` en `client/` | 99 passed, 0 failed en 28 archivos de prueba. Incluye `OfficialRecordPage.test.jsx` y `LoginPage.test.jsx`. |
| Cliente Build | `npm run build` en `client/` | Vite build exitoso en 881ms. |
| Migraciones | `npm run db:migrate` en `api/` | Migración `063_official_scrutiny_record.sql` aplicada y sin pendientes. |
| Revisión | `git diff --check` | Limpio, sin errores de formato ni espacios al final. |

## Matriz de Requisitos Funcionales

| Requisito | Evidencia y Test Automatizado |
|---|---|
| RF-121 Precondición de emisión | `api/src/db/tests/scrutiny-records.test.js` y `api/src/tests/scrutiny-records-api.test.js` (rechazo sin liberación previa con 403 `RESULTS_NOT_RELEASED`) |
| RF-122 Segregación de roles con 2FA | `api/src/auth/require-scrutiny-certification-access.js` y `scrutiny-records-api.test.js` (rechazo a ADMIN con 403 `OFFICIAL_RECORD_EMISSION_FORBIDDEN_FOR_ADMIN`, rechazo sin 2FA con 403 `TWO_FACTOR_REQUIRED`) |
| RF-123 Contenido canónico del acta | `api/src/modules/scrutiny-records/scrutiny-record-service.js` y `scrutiny-records-api.test.js` (payload canónico con jurados, comparsas, rubros y Mejor Comparsa) |
| RF-124 Sello de integridad JCS/SHA-256 | `scrutiny-records.test.js` (`computeRecordHash` y `verifyRecordIntegrity`) y `scrutiny-records-api.test.js` (hash SHA-256 de 64 caracteres) |
| RF-125 Persistencia inmutable | `api/src/db/tests/scrutiny-records.test.js` (trigger bloquea `UPDATE` y `DELETE` con `OFFICIAL_RECORD_IMMUTABLE`) |
| RF-126 Idempotencia y unicidad | `scrutiny-records-api.test.js` (segunda llamada devuelve 200 con el acta y hash idéntico original) |
| RF-127 Auditoría de certificación | `scrutiny-record-service.js` registra `OFFICIAL_SCRUTINY_RECORD_CERTIFIED` |
| RF-128 Consulta y verificación de hash | `scrutiny-records-api.test.js` y `OfficialRecordPage.test.jsx` (GET `/scrutiny-record` devuelve 200 con `integrityVerified: true`) |
| RF-129 Formato notarial imprimible | `client/src/pages/OfficialRecordPage.jsx` y `index.css` (`@media print`, `window.print()`, cuadro de firmas) |
| RF-130 Accesibilidad y responsive | `OfficialRecordPage.test.jsx` y comprobación en 390×844, 768×1024, 1440×900 |

## Comprobación manual planificada (390×844, 768×1024, 1440×900)

- [ ] Emisión y certificación por usuario con rol `ESCRIBANO` / `SCRUTINEER`.
- [ ] Rechazo a usuario con rol `ADMIN` al intentar certificar.
- [ ] Verificación de sello de integridad SHA-256 en pantalla.
- [ ] Vista formal de impresión (`window.print()` / PDF) sin barras de navegación ni elementos espurios.
