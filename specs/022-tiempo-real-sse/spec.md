# Spec 022 — Tiempo Real Interno (SSE)

## Estado

- **Fase SDD:** Especificación aprobada para desarrollo (Fase 4 del Plan Maestro).
- **Fuente:** `PLAN-maestro.md` §2.2 y Fase 4; Specs 016, 019, 020 y 021.
- **Relación:** Añade capacidades de notificación push unidireccional en vivo sobre el subsistema de supervisión operativa (Spec 016), estado de votación ADMIN y escrutinio, manteniendo inalteradas las reglas de inmutabilidad (Specs 007, 015) y secreto del voto (Specs 003, 016).

---

## Objetivo

Proveer actualización reactiva e inmediata en la supervisión de votación y escrutinio mediante Server-Sent Events (SSE), eliminando la latencia de 15 segundos del polling periódico en salas de control y monitoreo de veedores, asegurando el secreto inviolable del voto en tránsito, ofreciendo fallback transparente a polling ante desconexiones de red, detectando anomalías operativas y brindando una vista "Pared de Sala" de alta legibilidad para proyectores y pantallas de monitoreo.

---

## Alcance

### Incluye:
1. **Canal Server-Sent Events (Backend):**
   - Endpoint autenticado `GET /api/v1/monitor/stream` protegido por sesión 2FA y roles autorizados (`ADMIN`, `VEEDOR`, `SCRUTINEER`, `ESCRIBANO`).
   - Cabeceras estándar: `Content-Type: text/event-stream`, `Cache-Control: no-cache, no-transform`, `Connection: keep-alive`.
   - Heartbeat periódico (`: ping\n\n`) cada 25 segundos para evitar desconexiones por proxy o NAT timeouts.
   - Bus de eventos interno en memoria/proceso acoplado a las mutaciones clave (`VOTING_OPENED`, `VOTING_CLOSED`, `BALLOT_SUBMITTED`, `BALLOT_REOPENED`, `RESULTS_RELEASED`, `OFFICIAL_RECORD_EMITTED`, `ANOMALY_REPORTED`).
2. **Garantía Inviolable de Secreto de Voto (Backend & Protocolo):**
   - Los eventos SSE transmitidos transmiten exclusivamente metadatos operativos agregados (`eventId`, `nightId`, `type`, `counts`, `timestamp`).
   - Prohibido terminantemente incluir puntajes individuales, ítems puntuados, decisiones parciales o identidades de jurados en el stream SSE previo a la publicación de resultados.
3. **Cliente Reactivo Resiliente (Frontend):**
   - Conexión reactiva vía `EventSource` con token o cookies de sesión.
   - Fallback automático e ininterrumpido a polling de 15 segundos si SSE se desconecta o no está disponible en la red.
   - Indicador visual accesible de estado de enlace ("● En vivo" / "○ Conexión de respaldo").
4. **Alertas de Anomalía Operativa (Frontend):**
   - Alertas visuales accesibles destacadas ante incidencias:
     - Intento de cierre con planillas pendientes (`CLOSE_ATTEMPT_INCOMPLETE`).
     - Alerta de alta proporción de pendientes con votación avanzada.
5. **Modo "Pared de Sala" / Wallboard (Frontend & Estilos):**
   - Vista de pantalla completa para proyectores / pantallas de cómputo en sala de escrutinio.
   - Contraste extremo, tipografía de gran tamaño, progreso gigante y visualización a varios metros de distancia.

### Excluye:
- Conexiones WebSockets bidireccionales (innecesarias para flujo push servidor→cliente; SSE es nativo, estándar HTTP y amigable con cortafuegos).
- Publicación pública externa por SSE (módulo diferido a Spec 024).
- Alterar la lógica o inmutabilidad del escrutinio o de las actas.

---

## Requisitos Funcionales

- **RF-190 — Secreto del Voto en el Stream SSE:**
  El stream de eventos en tiempo real bajo NINGÚN concepto transmitirá puntajes individuales, elecciones de jurados o nombres de jurados asociados a decisiones antes de la liberación oficial de resultados. El payload SSE transmitirá exclusivamente eventos operativos y agregados (`counts`, `status`, `type`, `eventId`, `nightId`).
- **RF-191 — Endpoint SSE `/api/v1/monitor/stream`:**
  El servidor expondrá un canal Server-Sent Events protegido con `requireSession`, `requireTwoFactor` y autorización de rol observador (`requireVotingObserver` o `RequireAnyRole(["ADMIN", "VEEDOR", "SCRUTINEER", "ESCRIBANO"])`). Mantendrá las cabeceras HTTP de streaming y emitirá heartbeats de control cada 25 segundos.
- **RF-192 — Emisión y Notificación de Eventos Operativos:**
  Cuando ocurra un evento relevante de votación o escrutinio (`VOTING_OPENED`, `VOTING_CLOSED`, `BALLOT_SUBMITTED`, `BALLOT_REOPENED`, `RESULTS_RELEASED`, `OFFICIAL_RECORD_EMITTED`), el servidor emitirá un mensaje SSE a los clientes conectados para que actualicen sus datos sin esperar el intervalo de polling.
- **RF-193 — Cliente Resiliente con Fallback Automático a Polling:**
  `VeedorMonitorPage` se suscribirá al stream SSE. Si la conexión SSE se interrumpe o falla, el cliente activará automáticamente un polling periódico de respaldo (15s) y mostrará un indicador visual de estado de conexión ("● En vivo" vs "○ Polling de respaldo"). Al restablecerse la conexión, reanudará el modo en vivo.
- **RF-194 — Alertas de Anomalía Operativa en el Monitor:**
  El monitor detectará y exhibirá alertas visuales accesibles ante anomalías operativas:
  - Intento de cierre de votación con planillas pendientes (`CLOSE_ATTEMPT_INCOMPLETE`).
  - Alerta de demora o planillas pendientes cuando la noche está próxima al cierre.
- **RF-195 — Modo "Pared de Sala" (Wallboard / Fullscreen):**
  La página de supervisión ofrecerá un modo "Pared de sala" optimizado para pantallas grandes y proyectores en centros de cómputo: tipografía de alta escala, alto contraste, métricas clave maximizadas (estado de noche, progreso de confirmación, tarjetas de conteo gigantes) y botón para alternar o salir del modo.

---

## Criterios de Aceptación

1. `GET /api/v1/monitor/stream` requiere sesión autenticada con 2FA verificado y rol autorizado; responde con cabeceras `text/event-stream`.
2. Las pruebas automatizadas verifican que el stream SSE jamás contiene puntajes ni identidades individuales de jurados.
3. El servidor emite eventos SSE al abrir o cerrar votación y al confirmar planillas.
4. `VeedorMonitorPage` actualiza sus contadores en tiempo real al recibir un evento SSE sin necesidad de recargar la página ni esperar 15 segundos.
5. Al simular caída de la conexión SSE, el cliente entra en modo polling de respaldo y muestra la insignia correspondiente ("○ Polling de respaldo").
6. El monitor muestra alertas visuales destacadas cuando ocurre un intento de cierre con pendientes u otra anomalía operativa.
7. El botón "Modo sala" / "Pared de sala" maximiza la presentación visual con tipografía escalada y alto contraste.
8. 100% de tests unitarios y de integración de cliente y API aprobados.
