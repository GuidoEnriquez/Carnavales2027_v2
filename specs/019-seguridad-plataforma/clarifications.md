# Clarificaciones — Spec 019

## Decisiones registradas

1. **Almacenamiento de Rate Limiter:**
   - Para la versión actual (despliegue de nodo único), `express-rate-limit` utilizará el almacén en memoria (`MemoryStore`) por defecto.
   - El diseño del middleware encapsula el almacén de modo que si se escala a múltiples instancias en el futuro, baste configurar un `store` basado en Redis sin alterar los controladores ni las rutas.

2. **Formato y manejo de `Idempotency-Key`:**
   - Se acepta el encabezado estándar `Idempotency-Key` (y alternativamente `X-Idempotency-Key` para compatibilidad).
   - El valor debe ser un UUID v4 válido. Si no se suministra el encabezado, los endpoints de planilla operan de manera tradicional (sin reintentos idempotentes automáticos).
   - Si se reintenta una operación con la misma clave y el mismo hash de contenido, se devuelve la entidad con HTTP 200 y encabezado `Idempotency-Replay: true`.

3. **Migración 068 — Cadena de integridad en `audit_event`:**
   - La tabla `audit_event` ya poseía las columnas `hash_chain_version`, `previous_hash` y `event_hash` agregadas en la migración 058 para el sorteo ceremonial (`hash_chain_version = 1`).
   - La migración 068 reemplaza el `CHECK` constraint para admitir `hash_chain_version = 2` para todos los eventos del sistema, mientras mantiene los registros preexistentes:
     - Eventos históricos sin hash (`hash_chain_version IS NULL`).
     - Eventos de sorteo ceremonial históricos (`hash_chain_version = 1`).
     - Nuevos eventos auditados generales (`hash_chain_version = 2`).
   - Se crea la tabla `general_audit_hash_chain_head` con una única fila (singleton) inicializada con el hash del último evento o con el hash génesis (`'0'.repeat(64)`).

4. **Bloqueo de cuenta OTP en Better Auth:**
   - Se comprobó que Better Auth 1.6.27 implementa por defecto el bloqueo temporal de cuenta (`lockedUntil = Date.now() + 15 * 60 * 1000`) tras 10 intentos fallidos de OTP en `twoFactor.verifyOTP`.
   - Spec 019 incluye una prueba de integración explícita que documenta y verifica este comportamiento sin re-implementar una capa redundante.

5. **Estrategia de reintento ante Deadlock (`40P01`):**
   - El reintento se limita estrictamente a errores con `error.code === '40P01'`.
   - Se realizarán como máximo 2 reintentos (3 intentos totales).
   - Entre intentos se introduce un delay asíncrono aleatorio con jitter: `delay = (2 ** attempt * 25) + Math.random() * 25` ms.
