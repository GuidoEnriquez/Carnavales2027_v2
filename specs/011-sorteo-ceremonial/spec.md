# Spec 011 — Sorteo ceremonial con conteo regresivo (criterio 3 de desempate)

## Estado

- **Fase SDD:** aprobada para implementación el 2026-09-02. Esta revisión sustituye la aleatoriedad no reproducible de `Math.random()` por `crypto.randomInt()` y fija la cadena de integridad ceremonial v1.
- **Fuentes normativas:** Confluence C2 «Guía del equipo» (sección «Desempate (solo Mejor Comparsa)», criterio 3 «sorteo con registro auditado»); Spec 010 «Resultados» (RF-95, RF-96, RF-97).
- **Dependencias:** Spec 010 (RF-95 desempate exclusivo de Mejor Comparsa, RF-96 secuencia de 3 criterios, RF-97 auditoría append-only).
- **Diferido por:** aprobación previa del responsable.

## Objetivo

Reemplazar la salida actual `TIE_BREAKER_REQUIRES_MANUAL_DRAW` del criterio 3 por un flujo ceremonial visible y auditado: cuando el empate persiste tras los criterios 1 y 2, el operador autorizado (rol `SCRUTINEER`/`ESCRIBANO`/`ADMIN`) inicia un **sorteo con conteo regresivo 5→0** seguido de la **selección aleatoria del ganador** entre las comparsas restantes. Todo el evento queda registrado en auditoría append-only (RF-97) con seed, método, resultado y actor.

## Fuera de alcance

- Criterios 1 y 2 del desempate: ya implementados y validados en Spec 010.
- Penalizaciones, actas oficiales, publicación externa y offline-first.
- Reemplazo del `TIE_BREAKER_REQUIRES_MANUAL_DRAW` antes de que esta spec esté aprobada: el operador conserva la opción de registrar el resultado manualmente si la etapa de escrutinio no permite sorteo ceremonial (por ejemplo, jornada interrumpida).
- Publicación externa, actas oficiales o correcciones de un sorteo ya registrado.

## Reglas funcionales

- **RF-98 (disparador).** CUANDO `resolveTieBreaker` retorna empate persistente tras criterios 1 y 2, EL SISTEMA DEBE ofrecer al operador autorizado un endpoint `POST /api/v1/events/{eventId}/tie-breaker/ceremonial-draw` que registra el sorteo ceremonial, siguiendo el prefijo de resultados vigente del cliente/API.
- **RF-99 (entrada válida).** EL SISTEMA DEBE aceptar únicamente un pool `remainingTroupeIds` que coincida exactamente con el conjunto que `resolveTieBreaker` expuso tras aplicar criterios 1 y 2; los criterios y el pool efectivo se derivan en el servidor. Cualquier diferencia debe rechazarse con `TIE_BREAKER_STALE`.
- **RF-100 (countdown visible).** EL CLIENTE DEBE mostrar un modal con conteo regresivo 5, 4, 3, 2, 1, 0 (un cambio por segundo, paso mínimo 200 ms para evitar parpadeo) antes de revelar la comparsa ganadora.
- **RF-101 (selección aleatoria).** CUANDO el countdown llega a 0, EL SISTEMA DEBE elegir aleatoriamente una comparsa entre `remainingTroupeIds` mediante `crypto.randomInt()`. Debe persistir el índice elegido como `randomValue`, un nonce criptográfico de trazabilidad como `seed` y `method: 'CRYPTO_RANDOM_INT'`; el nonce no pretende reproducir el sorteo.
- **RF-102 (auditoría completa).** EL SISTEMA DEBE registrar en `audit_event` el evento `RESULTS_TIE_BREAKER_CEREMONIAL_DRAW` con `eventId`, `tiedTroupeIds`, criterios derivados, nonce, índice, método, ganador, actor, fecha y correlation id. Cada evento ceremonial se encadena con SHA-256 sobre una representación JCS (RFC 8785) y un hash previo; la cadena v1 comienza en un hash génesis de 64 ceros y no reescribe eventos históricos.
- **RF-103 (responsabilidad de roles).** EL ENDPOINT y la vista de escrutinio DEBEN ser accesibles únicamente para el rol técnico `SCRUTINEER`, mostrado como **Escrutador / Escribano**, con 2FA verificado; `ADMIN` y cualquier otro rol reciben `403 FORBIDDEN` o no visualizan el acceso en la UI. El cliente debe restringir el botón "Iniciar sorteo ceremonial" al rol `SCRUTINEER`.
- **RF-104 (reversibilidad cero).** UNA VEZ registrado el sorteo ceremonial, EL SISTEMA NO DEBE permitir rehacerlo ni editar el resultado. El evento de auditoría es inmutable; cualquier corrección requiere un nuevo evento de tipo `RESULTS_TIE_BREAKER_CORRECTION` (fuera de alcance de esta spec, queda registrado como pendiente).
- **RF-105 (UX accesible).** EL MODAL de sorteo DEBE cumplir con los criterios de accesibilidad y responsive de la spec 009: contraste mínimo WCAG AA, foco visible, navegación por teclado (Tab/Escape/Enter), emulación táctil sin hover, y operación verificada manualmente en viewports 390x844, 768x1024 y 1440x900.

## Casos límite a cubrir

- Empate resuelto en criterio 1 o 2: el endpoint no debe invocarse y debe responder `409 TIE_BREAKER_NOT_REQUIRED`.
- Sorteo ceremonial disparado dos veces sobre el mismo empate: `409 TIE_BREAKER_ALREADY_DRAWN`.
- Conjunto `remainingTroupeIds` vacío (no debería ocurrir, pero si pasa): `422 TIE_BREAKER_EMPTY_DRAW_POOL`.
- Pérdida de conectividad durante el countdown: la UI permite cancelar antes de `0`; el endpoint solo se invoca después del countdown. Si el POST falla, no hay auditoría parcial y el operador puede reintentar.
- Browser cerrado antes del 0: el endpoint nunca se invoca; no hay auditoría parcial.
- Actor no autorizado: 403, sin tocar el estado del escrutinio.
- Sorteo ejecutado fuera de la etapa autorizada de escrutinio: 409 `RESULTS_NOT_RELEASED`.

## Dudas

- ¿La COC exige publicación inmediata del ganador tras el sorteo o hay un paso de confirmación verbal previo a registrar? Si la COC exige confirmación, agregar un sub-paso "Confirmar verbalmente el resultado" entre el countdown y el `POST` (alcance adicional, no implementado en esta versión inicial).
- No quedan dudas bloqueantes para esta versión. El nonce y la selección se generan exclusivamente en el servidor; el cliente no aporta datos de auditoría.
