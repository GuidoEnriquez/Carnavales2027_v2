# Validacion - Spec 028: Competencia: jerarquia de cabecera y orden automatico

| Tarea | Estado | Evidencia |
|---|---|---|
| T01 | Completada | Artefactos SDD del incremento creados y referenciados en `docs/source-map.md` y `docs/sdd-status.md`. |
| T02 | Completada | `category-service.js`/`specialty-service.js` con auto-orden (advisory lock + MAX+1), `reorderCategory`/`reorderSpecialty` (lock evento + swap offset, auditoria), PATCH sin `displayOrder`. Rutas `POST /categories/:id/reorder` y `/specialties/:id/reorder`. |
| T03 | Completada | `competencia-order-api.test.js` nuevo (8 tests): auto-orden, huecos, MAX+1, concurrencia, auth, validacion, adjacency, auditoria y OPEN bloqueado. `categories-api.test.js`/`specialties-api.test.js` actualizados. |
| T04 | Completada | `AdminCompetenciaPage.jsx`: formularios de crear/editar sin input Orden (body solo `{name}` o `{name, active}`), botones Subir/Bajar con el patron de `AdminRubricsSection.reorder` (merge optimista de `{changes}`, refetch ante `ORDER_CONFLICT`/`ORDER_BOUNDARY`, disable en bordes y durante escritura, ocultos con evento OPEN), listas ordenadas por `displayOrder`. Cabecera verificada: eyebrow COMPETENCIA, `event.name`, boton Volver y pestañas bajo el divisor (RNF-40: `data-layer="instrument"` y `main.admin-shell`). Test cliente `AdminCompetenciaPage.test.jsx`: +3 tests (create sin displayOrder, reorder categorias, reorder especialidades). |
| T05 | Completada | Suite API 5 suites 149/149 (incluye 8 nuevos); cliente 41 archivos 261/261; build Vite 71 modulos limpio; `npm run db:migrate` sin migraciones pendientes; diff revisado sin secretos y sin cambios fuera de alcance; `AGENTS.md`, `docs/source-map.md` y `docs/sdd-status.md` actualizados. Pendiente: comprobacion manual responsive de la cabecera y Subir/Bajar en 390x844, 768x1024 y 1440x900 (requiere navegador). |

## Evidencia

### T02/T03 — API

- `npm run db:migrate` → "No pending migrations".
- `node --import=dotenv/config --test --test-concurrency=1 src/tests/competencia-order-api.test.js src/tests/categories-api.test.js src/tests/specialties-api.test.js` → 10/10 OK.
- `npm test` (api/) → **149/149 OK, 5 suites**.
- Casos cubiertos: auto-orden 1,2,3 al crear; displayOrder ignorado en create y PATCH; desactivacion preserva huecos; nueva alta recibe MAX+1; especialidades independientes por evento; altas concurrentes serializadas por advisory lock; reorder con auth (401/403), validaciones 400, 404 `CATEGORY_NOT_FOUND`/`SPECIALTY_NOT_FOUND`, 409 `ORDER_CONFLICT`/`ORDER_BOUNDARY`/`EVENT_LOCKED`; vecino no-adyacente u otro evento → `ORDER_CONFLICT`; atomicidad del swap; auditoria `CATEGORY_REORDERED`/`SPECIALTY_REORDERED` con scoping por evento en `after_data->>'eventId'`; concurrencia de reorder → un unico 200 y un 409 con una sola auditoria.

### T04 — Frontend

- `AdminCompetenciaPage.jsx`: se reemplazo el input numerico "Orden" de los formularios de Tipos de participacion y Especialidades por el flujo Subir/Bajar. `reorderCategory`/`reorderSpecialty` usan `POST /categories/:id/reorder` y `/specialties/:id/reorder` con body `{direction, neighborId, expectedOrder, expectedNeighborOrder}`, actualizacion optimista con `{changes}` y refetch ante `ORDER_CONFLICT`/`ORDER_BOUNDARY`. Las tarjetas renderizan listas ordenadas por `displayOrder`; Subir deshabilitado en el primero y Bajar en el ultimo; sin botones con evento `OPEN`; guarda sincrona `writing.current` evita doble envio.
- `client/src/tests/AdminCompetenciaPage.test.jsx`: 36 tests (33 previos + 3 nuevos): "crea tipo de participacion sin displayOrder (RF-172)", "reordena tipos de participacion con Subir/Bajar (RF-175)" y "reordena especialidades con Subir/Bajar (RF-175)". Los 33 previos siguieron verdes (el loop de spinbuttons ya no aplica a estos formularios).
- Comando: `npx vitest run src/tests/AdminCompetenciaPage.test.jsx` → 36/36 OK.

### T05 — Integral

- `npx vitest run --reporter=dot` (client/) → 41 archivos, **261/261 OK**.
- `npm run build` (client/) → 71 modulos, build limpio (dist generado).
- `git diff` revisado: sin secretos; cambios acotados a Spec 028 salvo working tree Spec 027 preexistente sin commitear (no tocado).
- `AGENTS.md`, `docs/source-map.md` y `docs/sdd-status.md` actualizados con el cierre del incremento.
- **Pendiente:** comprobacion manual responsive (RNF-41) de la cabecera y de Subir/Bajar en 390x844, 768x1024 y 1440x900; requiere navegador, no se ejecuto en este entorno.
