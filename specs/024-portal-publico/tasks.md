# Tareas — Spec 024: Portal Público de Resultados

## T01 — Migración 070: Tabla inmutable `results_snapshot` (RF-210)

- [x] Crear migración `api/src/db/migrations/070_results_snapshot.sql` con tabla versionada, índices y triggers que prohíben `UPDATE` y `DELETE`.
- [x] Aplicar migración en base de datos local y de pruebas.
- [x] Crear prueba automatizada en `api/src/db/tests/results-snapshot.test.js` comprobando unicidad, inmutabilidad y cálculo de hash.

## T02 — Servicio de Materialización de Snapshots (RF-211, RF-214)

- [x] Crear `api/src/modules/results/snapshot-service.js` con `materializeResultsSnapshot` y `getLatestResultsSnapshot`.
- [x] Conectar hooks automáticos de materialización en:
  - `releaseResults` (`results-service.js`).
  - `certifyScrutinyRecord` (`scrutiny-record-service.js`).
  - `executeCeremonialDraw` (`ceremonial-draw-orchestrator.js`).
- [x] Verificar sanitización estricta para garantizar que el snapshot jamás contenga notas o jurados individuales (RF-214).

## T03 — Rutas Públicas HTTP y Canal SSE (`/api/v1/public`) (RF-212, RF-213)

- [x] Crear `api/src/routes/public.routes.js` montado en `/api/v1/public` sin autenticación ni guardas privadas.
- [x] Implementar `GET /api/v1/public/events` y `GET /api/v1/public/events/:eventId/results` con soporte de ETag y HTTP 304 Not Modified.
- [x] Implementar `GET /api/v1/public/stream` con SSE liviano y heartbeats de 25s.
- [x] Montar el router en `api/src/app.js` fuera de `requireTrustedOrigin` si corresponde.
- [x] Crear prueba automatizada de integración en `api/src/tests/public-results-api.test.js`.

## T04 — Página Pública de Resultados en el Cliente (`PublicResultsPage.jsx`) (RF-215, RF-216)

- [x] Crear `client/src/pages/PublicResultsPage.jsx` bajo la Capa de Marca (`data-layer="brand"`).
- [x] Renderizar:
  - Hero institucional "Resultados Oficiales — Carnavales Goya 2027".
  - Tarjeta de honor para la Comparsa Ganadora.
  - Tabla accesible de Ranking General (Puesto, Comparsa, Bruto, Penalizaciones, Neto).
  - Ganadores por rubro artístico.
  - Verificación del Acta Notarial Oficial con hash SHA-256 canonicalizado y copia de sello.
  - Insignia de enlace en vivo (SSE público con fallback a polling de 30s).
- [x] Montar la ruta pública `#/resultados` en `client/src/App.jsx` sin requerir sesión ni guardas.
- [x] Añadir enlace "Resultados Oficiales" en la barra de navegación y en `LoginPage.jsx`.

## T05 — Pruebas, Validación Integral y Cierre

- [x] Crear pruebas de cliente en `client/src/tests/PublicResultsPage.test.jsx`.
- [x] Ejecutar suites completas: `npm test` en `api/`, `npm run db:test` en `api/`, `npm test` en `client/`.
- [x] Ejecutar `npm run build` en `client/`.
- [x] Documentar evidencias en `specs/024-portal-publico/validation.md`.
- [x] Actualizar `docs/sdd-status.md` y `docs/source-map.md`.
