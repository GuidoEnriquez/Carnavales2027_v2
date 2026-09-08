# Tareas — Spec 022: Tiempo Real Interno (SSE)

## T01 — Bus de eventos interno y hooks de emisión en servicios de dominio (RF-190, RF-192)

- [x] Crear `api/src/modules/monitor/monitor-event-bus.js` con soporte para suscripción y sanitización estricta (RF-190).
- [x] Integrar emisiones en `ballot-service.js` para `VOTING_OPENED`, `VOTING_CLOSED`, `BALLOT_SUBMITTED` y anomalía `CLOSE_ATTEMPT_INCOMPLETE`.
- [x] Integrar emisiones en `results-service.js` para `RESULTS_RELEASED` y en `scrutiny-record-service.js` para `OFFICIAL_RECORD_EMITTED`.

## T02 — Endpoint SSE `/api/v1/monitor/stream` con autenticación y heartbeats (RF-190, RF-191)

- [x] Implementar ruta `GET /api/v1/monitor/stream` en `api/src/routes/monitor.routes.js` protegida con `[requireSession, requireTwoFactor, requireVotingObserver]`.
- [x] Configurar cabeceras SSE (`text/event-stream`, `no-cache`, `keep-alive`), evento inicial de conexión y pings cada 25s.
- [x] Suscribir clientes al bus de eventos y limpiar conexión en el evento `close` del request.
- [x] Crear prueba automatizada en `api/src/tests/monitor-sse.test.js` verificando autenticación, flujo de eventos y secreto absoluto del voto (RF-190).

## T03 — Cliente reactivo con fallback automático a polling en VeedorMonitorPage (RF-193)

- [x] Suscribir `VeedorMonitorPage.jsx` a `/api/v1/monitor/stream` vía `EventSource`.
- [x] Disparar refresco inmediato ante eventos `monitor_update` sin esperar polling.
- [x] Implementar fallback transparente a polling periódico (15s) cuando SSE falle o se desconecte.
- [x] Renderizar insignia accesible de estado de enlace ("● En vivo" vs "○ Polling de respaldo").

## T04 — Detección y presentación de alertas de anomalía operativa (RF-194)

- [x] Capturar y registrar eventos de anomalía (`CLOSE_ATTEMPT_INCOMPLETE`, demoras operativas) en el estado del monitor.
- [x] Renderizar banner visual accesible de alerta operativa con detalles del incidente y opción de descarte.

## T05 — Vista "Pared de Sala" (Wallboard mode / Fullscreen) para proyectores (RF-195)

- [x] Implementar alternancia de modo "Pared de Sala" en `VeedorMonitorPage.jsx`.
- [x] Añadir estilos responsive y de alta legibilidad en `client/src/styles/components.css` (`.monitor-page.is-wallboard`).
- [x] Asegurar contraste alto y escala tipográfica visible a distancia.

## T06 — Pruebas, validación integral y reporte

- [x] Crear pruebas automatizadas en `client/src/tests/` para `VeedorMonitorPage` con SSE, fallback a polling, alertas y modo pared.
- [x] Ejecutar suites completas: `npm test` en `api/`, `npm run db:test` en `api/`, `npm test` en `client/`.
- [x] Ejecutar `npm run build` en `client/`.
- [x] Documentar evidencias en `specs/022-tiempo-real-sse/validation.md`.
- [x] Actualizar `docs/sdd-status.md` y `docs/source-map.md`.
