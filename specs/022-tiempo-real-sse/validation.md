# Validación — Spec 022: Tiempo Real Interno (SSE)

## Estado de Validación

- **Fecha:** 2026-09-08
- **Alcance evaluado:** T01 a T06 de Spec 022 (Fase 4 del Plan Maestro).
- **Resultado:** APROBADO al 100% sin regresiones.

## Matriz de Cobertura de Requisitos

| Requisito | Descripción | Estado | Evidencia |
|---|---|---|---|
| RF-190 | Secreto del Voto en el Stream SSE (ausencia absoluta de puntajes y nombres individuales) | CUMPLIDO | `api/src/modules/monitor/monitor-event-bus.js` (`sanitizeMonitorEvent`), test `api/src/tests/monitor-sse.test.js` |
| RF-191 | Endpoint SSE `/api/v1/monitor/stream` con autenticación, 2FA, `requireVotingObserver` y heartbeats 25s | CUMPLIDO | `api/src/routes/monitor.routes.js`, test `api/src/tests/monitor-sse.test.js` |
| RF-192 | Emisión y Notificación de Eventos Operativos (`VOTING_OPENED`, `VOTING_CLOSED`, `BALLOT_SUBMITTED`, `RESULTS_RELEASED`, `OFFICIAL_RECORD_EMITTED`) | CUMPLIDO | `ballot-service.js`, `results-service.js`, `scrutiny-record-service.js`, test `api/src/tests/monitor-sse.test.js` |
| RF-193 | Cliente Resiliente con Fallback Automático a Polling (15s) e insignia ("● En vivo" vs "○ Polling de respaldo") | CUMPLIDO | `client/src/pages/VeedorMonitorPage.jsx`, test `client/src/tests/VeedorMonitorPageSSE.test.jsx` |
| RF-194 | Alertas de Anomalía Operativa en el Monitor (`CLOSE_ATTEMPT_INCOMPLETE` con descarte accesible) | CUMPLIDO | `client/src/pages/VeedorMonitorPage.jsx`, test `client/src/tests/VeedorMonitorPageSSE.test.jsx` |
| RF-195 | Modo "Pared de Sala" (Wallboard / Fullscreen) para proyectores con escala y contraste extremo | CUMPLIDO | `client/src/pages/VeedorMonitorPage.jsx`, `client/src/styles/components.css` (`.is-wallboard`), test `client/src/tests/VeedorMonitorPageSSE.test.jsx` |

## Registro de Pruebas Automatizadas

1. **`api/src/tests/monitor-sse.test.js`:**
   - 1/1 tests pasan (91.5ms):
     - Rechaza sin sesión con 401.
     - Rechaza sin 2FA con 403.
     - Rechaza roles no observadores (JUDGE) con 403.
     - Acepta observadores autorizados (VEEDOR/ADMIN) con cabeceras `text/event-stream`.
     - Recibe evento inicial `connected`.
     - Recibe evento `monitor_update` emitido por el bus.
     - RF-190: Verifica sanitización estricta bit a bit; ningún campo sensible (`score`, `scores`, `judgeName`, `judgeEmail`, `documentNumber`, `voterId`) aparece en el stream.

2. **`client/src/tests/VeedorMonitorPageSSE.test.jsx`:**
   - 5/5 tests pasan (178ms):
     - Conecta vía SSE y muestra estado "● En vivo" ante evento `connected`.
     - Actualiza inmediatamente datos al recibir evento `monitor_update` sin esperar polling.
     - Cambia a "○ Polling de respaldo" ante desconexión o error de SSE.
     - Detecta anomalía `CLOSE_ATTEMPT_INCOMPLETE` y permite descartar la alerta.
     - Alterna modo "Pared de Sala" / Wallboard con atributos accesibles (`aria-pressed`).

3. **Suite Completa API:**
   - Unit & API integration: 136/136 tests pasan (26.2s).
   - DB integration: 68/68 tests pasan (577ms).

4. **Suite Completa Cliente:**
   - 180/180 tests pasan en 38 archivos (6.17s).
   - `npm run build` genera bundle sin errores en 814ms.

## Verificación de Integridad

- Inmutabilidad estricta respetada: el stream es de solo lectura y solo transporta metadatos operativos agregados.
- Secreto absoluto del voto (RF-190): comprobado tanto por sanitización automática como por pruebas de aserción negativa sobre el stream HTTP.
- Resiliencia de red (RF-193): el fallback a polling asegura que la supervisión nunca quede ciega si el canal SSE es bloqueado por cortafuegos o proxies intermedios.
