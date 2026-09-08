# Plan de Implementación — Spec 024: Portal Público de Resultados

## Arquitectura

### 1. Base de Datos: Migración 070 (`070_results_snapshot.sql`)
- Tabla `results_snapshot`:
  - `id UUID PRIMARY KEY DEFAULT gen_random_uuid()`
  - `event_id UUID NOT NULL REFERENCES carnival_event(id) ON DELETE CASCADE`
  - `version INTEGER NOT NULL DEFAULT 1`
  - `snapshot_hash VARCHAR(64) NOT NULL`
  - `payload JSONB NOT NULL`
  - `created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()`
  - Restricción de unicidad: `(event_id, version)`
  - Índice: `idx_results_snapshot_event_latest (event_id, version DESC)`
- Función y trigger de inmutabilidad: prohíbe `UPDATE` y `DELETE`.

### 2. Módulo de Snapshot (`api/src/modules/results/snapshot-service.js`)
- `materializeResultsSnapshot({ eventId, client })`:
  - Lee los resultados consolidados (`computeResults`).
  - Obtiene el acta si existe (`getOfficialScrutinyRecord`).
  - Filtra estrictamente cualquier dato sensible individual.
  - Calcula el hash SHA-256 canonicalizado según RFC 8785 (JCS).
  - Determina la siguiente versión (`COALESCE(MAX(version), 0) + 1`).
  - Inserta el snapshot.
  - Emite evento público SSE `RESULTS_SNAPSHOT_UPDATED`.
- Hooks de llamada en:
  - `releaseResults` (`results-service.js`)
  - `certifyScrutinyRecord` (`scrutiny-record-service.js`)
  - `recordCeremonialDraw` (`results-service.js` o `ceremonial-draw-service.js`)

### 3. Rutas Públicas de la API (`api/src/routes/public.routes.js`)
- Sin middleware de sesión, sin 2FA, sin `requireTrustedOrigin`:
  - `GET /api/v1/public/events`: lista eventos con al menos un snapshot disponible.
  - `GET /api/v1/public/events/:eventId/results`:
    - Lee el snapshot con mayor versión.
    - Si no existe: 404 `{ code: "RESULTS_NOT_RELEASED" }`.
    - Cabeceras: `ETag`, `Cache-Control: public, max-age=30, stale-while-revalidate=60`.
    - Si `req.headers["if-none-match"] === snapshot.snapshot_hash`, devuelve 304 Not Modified.
    - Devuelve JSON del payload y metadatos del snapshot.
  - `GET /api/v1/public/stream`: SSE público con heartbeats cada 25s y evento `results_updated`.

### 4. Página Pública Ciudadana (`client/src/pages/PublicResultsPage.jsx`)
- Accesible en hash route `#/resultados`.
- Aplica `data-layer="brand"`.
- Despliega:
  - Comparsa Ganadora destacada con motivo festivo.
  - Tabla accesible de Ranking General (Puesto, Comparsa, Bruto, Penalizaciones, Neto).
  - Ganadores por rubro / categorías.
  - Tarjeta de certificación notarial con verificación de hash SHA-256.
  - Insignia de sincronización en vivo (conecta a SSE público o polling de respaldo a 30s).
- Enlace en header/footer y pantalla de login ("Ver resultados públicos").

### 5. Pruebas y Validación
- Pruebas de migración e inmutabilidad en `api/src/db/tests/results-snapshot.test.js`.
- Pruebas de API en `api/src/tests/public-results-api.test.js`.
- Pruebas de cliente en `client/src/tests/PublicResultsPage.test.jsx`.
