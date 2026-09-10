# Validación y Evidencia — Spec 024: Portal Público de Resultados

## 1. Cobertura de Requerimientos Funcionales

| Requerimiento | Descripción | Estado | Evidencia |
| :--- | :--- | :---: | :--- |
| **RF-210** | Modelo inmutable y versionado `results_snapshot` con triggers NO UPDATE / NO DELETE | CUMPLIDO | `070_results_snapshot.sql`, `results-snapshot.test.js` (4/4 tests pasan) |
| **RF-211** | Servicio de materialización determinística con canonicalización JCS / SHA-256 | CUMPLIDO | `snapshot-service.js`, hooks en `releaseResults`, `certifyScrutinyRecord` y `executeCeremonialDraw` |
| **RF-212** | API pública `/api/v1/public/events` y `/:eventId/results` con ETag y HTTP 304 | CUMPLIDO | `public.routes.js`, `public-results-api.test.js` (verifica 200, 304, ETag y Cache-Control) |
| **RF-213** | Canal SSE público `/api/v1/public/stream` con fallback a polling de 30s | CUMPLIDO | `public.routes.js`, `PublicResultsPage.jsx`, `public-results-api.test.js` y `PublicResultsPage.test.jsx` |
| **RF-214** | Secreto estricto del voto: ausencia total de notas y jurados individuales en snapshot | CUMPLIDO | `snapshot-service.js`, comprobación de payload en `public-results-api.test.js` |
| **RF-215** | Portal Web Público `PublicResultsPage.jsx` bajo Capa de Marca | CUMPLIDO | `PublicResultsPage.jsx`, `components.css`, `App.jsx` (ruta `#/resultados`), `PublicResultsPage.test.jsx` (5/5 tests) |
| **RF-216** | Verificación pública del Acta Notarial y copia accesible del sello criptográfico | CUMPLIDO | `PublicResultsPage.jsx` con botón de copia al portapapeles y validación en `PublicResultsPage.test.jsx` |

---

## 2. Evidencia de Pruebas Automatizadas

### Pruebas de Base de Datos (`api/src/db/tests/results-snapshot.test.js`)
```
▶ results_snapshot DB (Spec 024)
  ✔ permite insertar un snapshot válido y recuperarlo ordenado por versión (15.51936ms)
  ✔ rechaza duplicar la misma versión para un evento (unicidad uq_results_snapshot_event_version) (5.452421ms)
  ✔ impide modificar un snapshot emitido (inmutabilidad estricta trg_results_snapshot_immutable) (5.526311ms)
  ✔ impide borrar físicamente un snapshot emitido (inmutabilidad estricta trg_results_snapshot_immutable) (9.426629ms)
✔ results_snapshot DB (Spec 024) (64.953963ms)
```

### Pruebas de API (`api/src/tests/public-results-api.test.js`)
```
✔ API portal público de resultados (Spec 024) (220.651251ms)
  - 404 RESULTS_NOT_RELEASED antes de liberar
  - 400 INVALID_UUID ante ID mal formado
  - Materialización de versión 1 tras releaseResults
  - Listado en GET /api/v1/public/events
  - Consulta en GET /api/v1/public/events/:eventId/results con ETag y Cache-Control: public, max-age=30
  - HTTP 304 Not Modified ante coincidencia de ETag
  - RF-214: Verificación estricta de ausencia de jurados individuales o notas parciales
  - Materialización automática de versión 2 tras certifyScrutinyRecord
  - Canal SSE público con evento connected y results_updated
```

### Pruebas de Cliente (`client/src/tests/PublicResultsPage.test.jsx`)
```
✓ src/tests/PublicResultsPage.test.jsx (5 tests) 176ms
   ✓ PublicResultsPage (Spec 024) > renderiza el portal bajo la capa de marca y muestra estado no liberado 69ms
   ✓ PublicResultsPage (Spec 024) > renderiza resultados oficiales completos cuando están liberados 37ms
   ✓ PublicResultsPage (Spec 024) > permite copiar el sello notarial al portapapeles con feedback accesible 35ms
   ✓ PublicResultsPage (Spec 024) > actualiza estado en vivo con EventSource y refresca ante 'results_updated' 17ms
   ✓ PublicResultsPage (Spec 024) > conmuta a 'Respaldo (30s)' si el canal SSE emite error 16ms
```

### Suites Completas del Proyecto
- **API DB Tests (`npm run db:test` en `api/`):** 72/72 tests pasan (5 suites).
- **API Unit/Integration Tests (`npm test` en `api/`):** 141/141 tests pasan (5 suites).
- **Client Tests (`npm test` en `client/`):** 200/200 tests pasan (40 archivos).
- **Client Build (`npm run build` en `client/`):** Construcción exitosa sin errores ni advertencias (dist generado en 839ms).

---

## 3. Estado de Cierre

La Spec 024 se encuentra completamente implementada, probada y validada conforme a las directivas de `AGENTS.md` y `PLAN-maestro.md`.

---

## Corrección Post-Commit — Canal Público Solo Materializaciones Reales

**Fecha:** 2026-09-10
**Tipo:** Corrección dentro de Spec 024 (mismo incremento que la corrección de Spec 022).
**Alcance:** El canal SSE público `/api/v1/public/stream` ahora solo notifica `RESULTS_SNAPSHOT_UPDATED` con payload `{ eventId, version }`.

### Problema detectado
El canal público reenviaba **todos** los eventos del bus (`ballot_update`, `official_record_emitted`, `results_updated` indiscriminadamente). Ninguna de estas acciones llegaba a materializar el snapshot. Los clientes del canal público se actualizaban con eventos que no tenían relación con el contenido mostrado en el portal.

### Solución implementada (T04)

| Archivo | Cambio |
|---|---|
| `api/src/routes/public.routes.js` | Reemplaza reenvío directo de `event.type` por verificación contra `PUBLIC_NOTIFY_ACTIONS = new Set(["RESULTS_SNAPSHOT_UPDATED"])`. Payload cambia de `{ action: event.type, ...event.payload }` a `{ eventId, version }`. |

### Evidencia de validación

| Test | Archivo | Resultado |
|---|---|---|
| `public-results-api.test.js` (bloque SSE) | `api/src/tests/public-results-api.test.js` | 1/1 PASS — emite `RESULTS_SNAPSHOT_UPDATED` con `{eventId, version}` |
| `PublicResultsPage.test.jsx` (simulación SSE) | `client/src/tests/PublicResultsPage.test.jsx` | 1/1 PASS — payload `{eventId, version}` activa refetch |
