# Tasks — Spec 015: Actas Oficiales y Certificación de Escrutinio

| Tarea | Estado | Evidencia |
| --- | --- | --- |
| T01 Persistencia y migración | Completada | Migración 063 aplicada, 8 tests en `scrutiny-records.test.js` y 60 tests DB totales pasando |
| T02 Servicios de certificación y hash JCS/SHA-256 | Completada | `scrutiny-record-service.js`, canonicalización JCS, verificación criptográfica SHA-256 en DB suite (62 tests pass) |
| T03 Endpoints HTTP y segregación de roles | Completada | `scrutiny-records.routes.js`, middleware `requireScrutinyCertificationAccess`, 107 tests API pasando (`scrutiny-records-api.test.js`) |
| T04 Cliente: vista notarial de Acta Oficial e impresión | Completada | `OfficialRecordPage.jsx`, ruta `#/admin/record`, enlace en navegación y banner de escrutinio, estilos notarial `@media print` |
| T05 Pruebas automatizadas completas | Completada | Suites de DB (62/62), API (107/107) y Cliente (98/98) pasando al 100%, build de Vite exitoso en 881ms |
| T06 Validación manual y cierre SDD | Completada | Comprobación en 3 viewports (390×844, 768×1024, 1440×900) y verificación de reglas de impresión notarial |

## T01 — Persistencia y migración
- Crear migración `063_official_scrutiny_record.sql`.
- Modelar tabla `official_scrutiny_record` con claves foráneas a evento y usuario certificante.
- Implementar restricción de unicidad por evento (`uq_official_scrutiny_event`).
- Agregar trigger guard que prohíba de forma estricta cualquier `UPDATE` o `DELETE` (`OFFICIAL_RECORD_IMMUTABLE`).

## T02 — Servicios de certificación y hash JCS/SHA-256
- Crear `scrutiny-record-service.js` con método transaccional `certifyScrutinyRecord`.
- Validar precondición de liberación de resultados (`results_release`) y resolución de empates.
- Consolidar nómina de jurados, ganadores por rubro, ranking de Mejor Comparsa con deducción de penalizaciones y memoria de desempates.
- Implementar canonicalización determinística (JCS) y cálculo de hash SHA-256.
- Registrar evento de auditoría `OFFICIAL_SCRUTINY_RECORD_CERTIFIED`.

## T03 — Endpoints HTTP y segregación de roles
- Crear middleware `requireScrutinyCertificationAccess` que permita solo a `SCRUTINEER` y `ESCRIBANO` emitir actas y rechace con 403 `OFFICIAL_RECORD_EMISSION_FORBIDDEN_FOR_ADMIN` al rol `ADMIN`.
- Exponer ruta `POST /api/v1/events/:eventId/scrutiny-record` para emisión.
- Exponer ruta `GET /api/v1/events/:eventId/scrutiny-record` para consulta y verificación de hash.
- Mapear errores de dominio en `http-errors.js`.

## T04 — Cliente: vista notarial de Acta Oficial e impresión
- Implementar página `OfficialRecordPage.jsx` con formato legal de Acta Notarial.
- Condicionar el botón de emisión/certificación para que solo sea interactivo para `SCRUTINEER` o `ESCRIBANO`.
- Integrar visualización del hash SHA-256 e indicador de integridad verificada.
- Agregar botón "Imprimir Acta Notarial" y estilos CSS `@media print` para exportación impecable a papel o PDF.
- Registrar enlace a las actas en la barra de navegación y desde la pantalla de resultados.

## T05 — Pruebas automatizadas
- Crear suite de base de datos (`scrutiny-records.test.js`).
- Crear suite de API (`scrutiny-records-api.test.js`).
- Crear suite de componentes para la página de Acta Oficial.

## T06 — Validación manual y cierre SDD
- Probar el flujo completo en Chrome con emulación responsive (390×844, 768×1024, 1440×900).
- Probar la generación de PDF con `window.print()`.
- Documentar evidencia en `validation.md` y actualizar `docs/sdd-status.md`.
