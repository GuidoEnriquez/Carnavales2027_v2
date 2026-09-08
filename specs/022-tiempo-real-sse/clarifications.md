# Clarificaciones — Spec 022

## Preguntas y Decisiones de Arquitectura

### 1. ¿Por qué Server-Sent Events (SSE) en lugar de WebSockets?
**Decisión:**
El flujo de tiempo real de supervisión operativa es estrictamente unidireccional (el servidor empuja cambios de estado hacia los clientes; los clientes no envían comandos por el canal de stream).
SSE ofrece ventajas determinantes:
1. Es estándar HTTP/1.1 y HTTP/2 nativo en navegadores (`EventSource`), sin dependencias de librerías cliente/servidor pesadas.
2. Funciona automáticamente a través de proxies, firewalls y balanceadores sin túneles adicionales.
3. El navegador reconecta automáticamente ante caídas breves de conexión con backoff exponencial nativo.
4. Consume sustancialmente menos recursos y memoria en el servidor.

### 2. ¿Cómo se desacopla la emisión de eventos del almacenamiento en base de datos?
**Decisión:**
Se crea un bus de eventos en memoria (`api/src/modules/monitor/monitor-event-bus.js`) basado en `EventEmitter`. Los servicios de dominio (`ballot-service.js`, `results-service.js`, `scrutiny-record-service.js`) notifican al bus tras confirmar exitosamente transacciones de base de datos (`commit`). Si una transacción falla o se revierte, no se emite ningún evento espurio.

### 3. ¿Cómo se garantiza el secreto del voto (RF-190)?
**Decisión:**
El bus de eventos valida o sanitiza cada carga útil antes de transmitirla por SSE. Los payloads solo contienen identificadores opacos (`eventId`, `nightId`), tipos de evento operativo (`VOTING_OPENED`, `VOTING_CLOSED`, `BALLOT_SUBMITTED`, etc.) y marca de tiempo. En ningún caso contienen colecciones de puntuaciones, nombres de jurados ni detalles de votos.

### 4. ¿Cómo opera el fallback automático a polling (RF-193)?
**Decisión:**
Si `EventSource.onerror` se dispara o no se recibe ningún mensaje o ping en un período de gracia (45 segundos), el cliente activa un `setInterval` de 15 segundos que consulta `GET /api/v1/monitor/events`. Al recibir nuevamente un mensaje exitoso por SSE, el intervalo de polling se detiene inmediatamente y la interfaz vuelve al modo "En vivo".

### 5. ¿Cómo se implementa la vista "Pared de Sala" (RF-195)?
**Decisión:**
Se utiliza una clase modificadora `.is-wallboard` en el contenedor de `VeedorMonitorPage`. En modo pared:
- Oculta selectores y elementos secundarios no esenciales.
- Escala la tipografía principal a tamaños grandes (3rem a 5rem).
- Maximiza los números de conteo y la barra de progreso.
- Aplica contraste reforzado (`--surface: #000000`, `--text-primary: #ffffff`, `--accent-primary: #2563eb`).
- Permite entrar y salir del modo mediante botón visible y accesible o tecla Escape.
