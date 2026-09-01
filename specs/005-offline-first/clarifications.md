# Clarificaciones - Spec 005: I4-A Offline-First

## Decisiones resueltas

| Tema | Decisión |
|---|---|
| Alcance normativo | I4-A no implementa ni cambia el `5 por equidad`, nulo para planillas digitales por decisión de producto del 2026-09-01. |
| Operaciones | Solo `SAVE_SCORE` y `SUBMIT_BALLOT` de la planilla propia del jurado. `SAVE_SCORE` conserva las transiciones actuales a `PENDING`, `SCORED` o `NOT_PRESENTED`. |
| Consistencia | El servidor procesa un lote FIFO de una planilla en transacción y conserva la autoridad final. |
| Idempotencia | `operationId` UUID es generado antes del envío. La identidad de una operación incluye actor, planilla e identificador; el servidor rechaza reutilización con contenido diferente. |
| Conflicto | La planilla usa revisión monotónica. Un `BALLOT_REVISION_CONFLICT` detiene esa outbox; no hay last-write-wins ni reintento automático. |
| Reintentos | Los errores de red son recuperables. Los errores de dominio, permisos, sesión, 2FA, cierre y revocación detienen la operación hasta intervención explícita. |
| Auditoría | Se audita una sola vez cada efecto de dominio. La tabla de deduplicación solo conserva metadatos y hash de contenido, nunca el valor de un score. |
| Persistencia local | Planillas y outbox se guardan en IndexedDB cifrado y aislado por usuario autenticado. Logout o cambio de usuario eliminan ambos. La cache de lectura vence a las 12 horas; la outbox pendiente se conserva hasta sincronizarse correctamente y advierte al superar ese plazo. |
| Service worker | Cachea solo recursos estáticos versionados. No cachea `/api`, respuestas autenticadas ni datos de planillas. |
| Ejecución | No depende de Background Sync; reintenta al recuperar red, foco, arranque autenticado o acción explícita. |

## Preguntas diferidas

- `[NECESITA ACLARACIÓN]` La interfaz final para comparar evidencia local con el estado canónico ante conflicto requiere validación con jurados; I4-A no autoriza aplicar la operación local automáticamente.
- `[NECESITA ACLARACIÓN]` El Reglamento de Carnavales 2027 no está distribuido en el repositorio. Esta ausencia bloquea una futura Spec de subsanación o escrutinio, no el alcance técnico definido aquí.
