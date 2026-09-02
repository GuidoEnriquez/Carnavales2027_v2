# Clarifications — Spec 011 Sorteo ceremonial

QA de Spec 011. Detecta ambigüedades y huecos previo a la implementación.

## Decisiones aprobadas — 2026-09-02

- La selección se genera en el servidor con `crypto.randomInt()`. Un nonce criptográfico se conserva para trazabilidad, no para reproducir el resultado.
- El pool efectivo y los criterios aplicados se recalculan en el servidor; el cliente solo propone el pool que visualiza.
- El hash ceremonial usa JCS (RFC 8785), SHA-256, hash génesis de 64 ceros y una cadena nueva sin reescritura del historial previo.
- `ESCRIBANO` se incorpora al circuito de invitaciones operativas existente y requiere 2FA para ejecutar el sorteo.

## Decisiones registradas

- **RF-101 (generador aleatorio):** `crypto.randomInt()` selecciona el índice; no se emplea un PRNG seedeable.
- **RF-99 (entrada válida):** el endpoint valida que el pool solicitado coincida exactamente con los `remainingTroupeIds` posteriores a criterios 1 y 2.
- **RF-103 (roles):** `SCRUTINEER` exclusivo, mostrado como **Escrutador / Escribano**, con 2FA verificado. Decisión del responsable: ADMIN no debe ver ni operar el escrutinio; se aplica mínimo privilegio y separación de funciones.
- **RF-104 (reversibilidad cero):** no se permite rehacer un sorteo ceremonial ya registrado. Cualquier corrección posterior genera un nuevo evento de auditoría; el resultado original permanece en el log append-only. Decisión alineada con el invariante de inmutabilidad del proyecto (ver AGENTS.md §Invariantes de ingeniería).
- **RF-106 (recuperación):** un reintento puede recibir `TIE_BREAKER_ALREADY_DRAWN` si el primer `POST` fue persistido pero el cliente perdió la respuesta. La UI recupera y revela el ganador desde el evento de auditoría inmutable; esta lectura no constituye corrección ni repetición del sorteo.

## Huecos

- Definir cómo se notifica al público presente (fuera del sistema) cuando el cliente UI muestra el ganador. Alcance: solo el modal de la UI; la megafonía o proyección externa queda fuera.
- Confirmar si el cliente UI debe mostrar también los rubros nominativos ganados por cada comparsa empatada antes del countdown. La spec menciona el contexto del empate pero no su visualización; recomendación: mostrarlo como antecedente antes del countdown para dar transparencia (a decidir en T02).
- Definir tiempo máximo de espera entre el countdown y la confirmación del operador. Si el operador no confirma en N segundos, ¿se auto-confirma o se aborta? Recomendación inicial: sin auto-confirmación; el operador decide cuándo hacer el `POST`. Queda como decisión UX en T02.

## Fuera de alcance confirmado

- Reemplazo del `TIE_BREAKER_REQUIRES_MANUAL_DRAW`: Spec 011 convive con él. El operador puede seguir registrando manualmente si la jornada no permite sorteo ceremonial.
- Penalizaciones, actas, publicación externa, offline-first: sin cambios.
- Cualquier flujo de sorteo para premios distintos de Mejor Comparsa: Confluence solo lo exige para Mejor Comparsa; no se extiende a otros premios.
