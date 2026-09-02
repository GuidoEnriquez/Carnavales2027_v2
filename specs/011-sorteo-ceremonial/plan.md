# Plan — Spec 011 Sorteo ceremonial

## Arquitectura

- **Backend (`api/`):**
  - Nuevo servicio `CeremonialDrawService` en `api/src/modules/results/ceremonial-draw-service.js`.
  - Funciones puras: `buildSeed()`, `selectCeremonialWinner({ pool })`, `composeAuditEvent()`.
  - Endpoints `POST` y `GET /api/v1/events/{eventId}/tie-breaker/ceremonial-draw` en `api/src/routes/results.routes.js`; la lectura recupera exclusivamente el evento ya auditado.
  - Reutiliza `requireResultsReleased` y 2FA; autorización para `ADMIN`, `SCRUTINEER` y `ESCRIBANO`.
  - Auditoría vía tabla `audit_event` existente (RF-97), nuevo `action = 'RESULTS_TIE_BREAKER_CEREMONIAL_DRAW'`.
  - Migraciones `054`, `055`, `057_restore_escribano_role.sql` y `058_ceremonial_draw_audit_hash_chain.sql`.
  - `crypto.randomInt()` selecciona el índice; la auditoría ceremonial usa JCS y SHA-256 encadenado.

- **Cliente (`client/`):**
  - Nuevo componente `<CeremonialDrawModal>` en `client/src/features/results/CeremonialDrawModal.jsx`.
  - Hook `useCeremonialDraw()` en `client/src/features/results/useCeremonialDraw.js` que ejecuta el sorteo o recupera el resultado auditado.
  - Hook `useCountdown(seconds)` reutilizable en `client/src/features/results/useCountdown.js` (encapsula el conteo 5→0).
  - CSS adicional en `client/src/index.css` siguiendo los tokens del rediseño Spec 009 (dark mode, surface elevada, border radius consistente).
  - Sin estado global nuevo: el modal se monta localmente desde la vista de escrutinio y conserva la revelación hasta su cierre explícito.

- **Persistencia:** migraciones `054_tie_breaker_ceremonial_draw_unique.sql` y `055_add_escribano_role.sql`: unicidad del sorteo por evento y rol `ESCRIBANO`.

## Archivos a crear / modificar

| Archivo | Tipo | RF asociado |
|---|---|---|
| `api/src/modules/results/ceremonial-draw-service.js` | crear | RF-98, RF-99, RF-101, RF-102 |
| `api/src/modules/results/__tests__/ceremonial-draw-service.test.js` | crear | RF-99, RF-101, RF-102 |
| `api/src/routes/results.routes.js` | modificar (agregar ruta) | RF-98, RF-103 |
| `api/src/modules/results/results-service.js` | modificar (no cambia comportamiento; solo expone contexto de empate para que el endpoint lo reutilice) | RF-99 |
| `api/src/db/tests/audit-event.test.js` | crear/ajustar | RF-102 |
| `client/src/features/results/CeremonialDrawModal.jsx` | crear | RF-100, RF-105 |
| `client/src/features/results/useCeremonialDraw.js` | crear | RF-98 |
| `client/src/features/results/useCountdown.js` | crear | RF-100 |
| `client/src/features/results/CeremonialDrawModal.test.jsx` | crear | RF-100, RF-105 |
| `client/src/index.css` | modificar (estilos del modal) | RF-105 |
| `client/src/pages/AdminResultsPage.jsx` | crear (`#/admin/results`) | RF-98, RF-100, RF-103, RF-105 |
| `client/src/auth/RequireResultsRole.jsx` | crear | RF-103 |
| `client/src/App.jsx`, `client/src/components/AppNavigation.jsx` | modificar (ruta y navegación) | RF-98, RF-103 |
| `api/src/modules/results/ceremonial-draw-orchestrator.js` | modificar (lectura auditada) | RF-106 |

## Estrategia de pruebas

- **Unit API (`vitest`):**
  - `selectCeremonialWinner` usa un índice inyectable solo para pruebas; la operación usa `crypto.randomInt()`.
  - Pool vacío → lanza `TIE_BREAKER_EMPTY_DRAW_POOL`.
  - Pool con un solo elemento → devuelve ese elemento.
  - Distintos seeds producen distintos ganadores (con pool de ≥3 elementos).
- **Integración API (`supertest`):**
  - `POST` exitoso con rol autorizado persiste auditoría completa.
  - `POST` con rol no autorizado → 403.
  - `POST` con `troupeId` ajeno al `remainingTroupeIds` → 422.
  - `POST` dos veces sobre el mismo empate → 409.
  - `POST` sin `results_release` previo → 409 `RESULTS_NOT_RELEASED`.
- **Cliente (`vitest` + testing-library):**
  - Countdown arranca en 5 y avanza cada 1000 ms (±50 ms).
  - Modal muestra los comparsas empatadas y el ganador al llegar a 0.
  - Foco se devuelve al botón disparador al cerrar con Escape.
  - Tab cicla por los elementos focuseables.
  - Un resultado ya registrado se recupera y se muestra sin permitir un segundo sorteo.
- **Manual (responsable):**
  - Recorrido del modal en 390x844, 768x1024 y 1440x900.
  - Operación con teclado (Tab, Enter, Escape) sin mouse.
  - Emulación táctil: tap activa botones grandes sin hover.

## Compatibilidad e invariantes

- **Inmutabilidad:** Spec 011 NO modifica votos ni planillas; solo consume resultados ya calculados por Spec 010. RF-104 garantiza que el sorteo ceremonial tampoco es editable.
- **Auditoría:** el evento ceremonial inicia una cadena v1 desde hash génesis de 64 ceros, con JCS y SHA-256; no reescribe historial previo.
- **Roles:** `ADMIN`, `SCRUTINEER` y `ESCRIBANO` requieren 2FA; Escribano usa invitaciones operativas.
- **Offline-first:** sin impacto; Spec 011 sigue siendo una capacidad online (diferida por Spec 005).
- **Sin breaking changes:** Spec 010 sigue emitiendo `TIE_BREAKER_REQUIRES_MANUAL_DRAW` cuando el operador elige la ruta manual. El nuevo endpoint es **opt-in**: el operador debe invocarlo explícitamente.

## Riesgos y mitigación

- **Riesgo:** el operador inicia el sorteo y se va la luz antes de que termine el countdown. **Mitigación:** el modal muestra estado "Cancelar" durante todo el countdown; el `POST` solo se hace al final, y no se persiste nada si el operador aborta.
- **Riesgo:** la comparsa ganadora cambia entre la pantalla y el `POST` si se recalculan resultados entremedio. **Mitigación:** el endpoint valida que el empate siga vigente (mismo `totalScore` de los `remainingTroupeIds`) antes de aceptar el sorteo; si cambió, devuelve `409 TIE_BREAKER_STALE`.
- **Riesgo:** sospecha sobre la aleatoriedad. **Mitigación:** `crypto.randomInt()`, nonce de trazabilidad y cadena inmutable de auditoría.

## Hecho cuando

- Todos los archivos de la tabla están creados/modificados.
- Suite API pasa (incluye los nuevos tests de ceremonial-draw).
- Suite cliente pasa (incluye los nuevos tests del modal).
- Build del cliente exitoso.
- `validation.md` completo con: estado, evidencia ejecutada, matriz RF, comprobación manual registrada por el responsable.
