# Plan - I4-A: Offline-First de planillas

> Implementado el 2026-08-31. La validación manual de PWA, sesión/2FA y viewports permanece registrada en `specs/005-offline-first/validation.md`.

## Objetivo

Agregar sincronización resiliente para las decisiones de planilla ya permitidas sin cambiar reglas de votación ni introducir flujos de subsanación o escrutinio.

## Diseño

1. Añadir una revisión monotónica a `ballot` y un ledger incremental de operaciones sincronizadas, indexado por actor, planilla y `operationId`.
2. Exponer una sincronización transaccional por planilla: recibe revisión base y operaciones FIFO, bloquea la planilla, valida las invariantes actuales, aplica efectos una vez y devuelve estado/revisión canónicos.
3. Conservar un hash de contenido para detectar reutilización incompatible de `operationId`, pero no persistir el puntaje en auditoría ni en el ledger de deduplicación.
4. Crear una outbox IndexedDB cifrada, por usuario, que persiste la operación antes de la mutación visible y elimina datos al logout o cambio de usuario. La cache de lectura vence a las 12 horas; las operaciones pendientes se conservan hasta sincronizarse y advierten al superar ese plazo.
5. Incorporar service worker y manifest para recursos estáticos exclusivamente; nunca cachear `/api` ni respuestas autenticadas.
6. Adaptar la planilla de jurado a modo offline, reintento en primer plano y estados accesibles de pendiente, sincronización, rechazo y conflicto.
7. Ante conflicto o rechazo terminal, detener la outbox de la planilla y exigir recarga o descarte explícito; no aplicar last-write-wins ni reconciliación automática.
8. Cubrir DB, API, cliente y operación en red interrumpida, reintentos, respuesta perdida, concurrencia, cierre, revocación, sesión/2FA, secreto y viewports.

## Límites

- No crear ni modificar la contingencia del `5 por equidad`.
- No modificar `PENDING` con score `NULL`, `SCORED` con score 1 a 10, `NOT_PRESENTED` con score 0, ni las reglas de completitud de Spec 004.
- No sincronizar administración, aperturas, cierres, reaperturas, asignaciones, penalizaciones, escrutinio, resultados o actas.

## Riesgos controlados

- El reintento de una respuesta perdida no debe duplicar score, confirmación ni auditoría.
- Una operación offline puede quedar inválida por cambio remoto; se conserva evidencia local y se informa el conflicto, sin sobrescribir al servidor.
- Los puntajes locales son sensibles: su cache se restringe al usuario autenticado, se cifra y se elimina en las transiciones de sesión definidas.
- Background Sync no es universal; la implementación no depende de esa API para garantizar recuperación.
