# Clarifications — Spec 011 Sorteo ceremonial

QA de Spec 011. Detecta ambigüedades y huecos previo a la implementación.

## Ambigüedad de implementación — pendiente de revisión

- **Seed del `Math.random()`:** generado en el servidor por defecto. Documentado en `spec.md` §Dudas; si el responsable prefiere cliente-first, se ajustará el flujo antes de implementar T02.
- **Paso de confirmación verbal pre-registro:** mencionado en `spec.md` §Dudas. La versión inicial no lo incluye; queda como decisión del responsable.
- **`RESULTS_TIE_BREAKER_CORRECTION`:** fuera de alcance de Spec 011 (ver RF-104). Si el operador necesita corregir un sorteo ceremonial ya registrado, se deberá redactar una spec posterior específica.

## Decisiones registradas

- **RF-101 (generador aleatorio):** `Math.random()` con seed determinístico (`Date.now() ^ crypto.randomBytes(8)` al inicio del request). Documentado en `spec.md` §Migración futura: el camino de reemplazo a `crypto.randomInt()` está previsto y no requiere cambio de contrato.
- **RF-99 (entrada válida):** el endpoint valida que los `troupeId` solicitados coincidan exactamente con `remainingTroupeIds` del empate. Si la COC exige aceptar también nuevas comparsas (por ejemplo, si aparece un empate no detectado antes), se necesitará un nuevo endpoint o una variante — fuera de alcance.
- **RF-103 (roles):** `SCRUTINEER` exclusivo, mostrado como **Escrutador / Escribano**, con 2FA verificado. Decisión del responsable: ADMIN no debe ver ni operar el escrutinio; se aplica mínimo privilegio y separación de funciones.
- **RF-104 (reversibilidad cero):** no se permite rehacer un sorteo ceremonial ya registrado. Cualquier corrección posterior genera un nuevo evento de auditoría; el resultado original permanece en el log append-only. Decisión alineada con el invariante de inmutabilidad del proyecto (ver AGENTS.md §Invariantes de ingeniería).

## Huecos

- Definir cómo se notifica al público presente (fuera del sistema) cuando el cliente UI muestra el ganador. Alcance: solo el modal de la UI; la megafonía o proyección externa queda fuera.
- Confirmar si el cliente UI debe mostrar también los rubros nominativos ganados por cada comparsa empatada antes del countdown. La spec menciona el contexto del empate pero no su visualización; recomendación: mostrarlo como antecedente antes del countdown para dar transparencia (a decidir en T02).
- Definir tiempo máximo de espera entre el countdown y la confirmación del operador. Si el operador no confirma en N segundos, ¿se auto-confirma o se aborta? Recomendación inicial: sin auto-confirmación; el operador decide cuándo hacer el `POST`. Queda como decisión UX en T02.

## Fuera de alcance confirmado

- Reemplazo del `TIE_BREAKER_REQUIRES_MANUAL_DRAW`: Spec 011 convive con él. El operador puede seguir registrando manualmente si la jornada no permite sorteo ceremonial.
- Penalizaciones, actas, publicación externa, offline-first: sin cambios.
- Cualquier flujo de sorteo para premios distintos de Mejor Comparsa: Confluence solo lo exige para Mejor Comparsa; no se extiende a otros premios.
