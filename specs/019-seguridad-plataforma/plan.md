# Plan de Implementación — Spec 019

## Arquitectura y Módulos

### Corrección T08 — Plan aprobado 2026-09-10

1. Crear `api/src/config/trust-proxy.js` con `readTrustProxy(environment = process.env)`, validación mediante `node:net` y retorno `false`, número o lista de redes/alias. Integrarlo en `createApp` antes de montar middleware. Esta lectura reemplaza el passthrough histórico de `TRUST_PROXY`.
2. En `rate-limiter.js`, incorporar clasificación exacta de lecturas de sesión y un factory para el contador general de autenticación, con instancia/MemoryStore independientes.
3. En `app.js`, montar límite general de autenticación antes del sensible, omitiendo únicamente este último en lecturas GET/HEAD de sesión. Conservar inyección de limiters para las pruebas.
4. Agregar pruebas HTTP con handler simulado para cupos, métodos/rutas, separación por IP y entre capas. Probar el parser y resolución de IP con cabeceras reenviadas. Preservar tests existentes de integración.
5. Documentar configuración en `.env.example` y README. Ejecutar pruebas focalizadas, suites API/BD y OTP en base aislada, tests/build cliente y revisión de diff. Registrar evidencias reales en T08; sin dependencias ni migraciones nuevas.

### 1. Cabeceras y middleware HTTP (`api/src/app.js`)
- Incorporar `helmet` con:
  - `crossOriginResourcePolicy: { policy: "cross-origin" }` (para permitir consumo por el cliente de Vite o Caddy).
  - `contentSecurityPolicy: { directives: { defaultSrc: ["'none'"], frameAncestors: ["'none'"] } }`.
- Configurar `express.json({ limit: "100kb" })`.
- Configurar `app.set("trust proxy", process.env.TRUST_PROXY || 1)`.

### 2. Rate Limiter modular (`api/src/auth/rate-limiter.js`)
- Crear limitadores de tasa usando `express-rate-limit`:
  - `authRateLimiter`: ventana 15 min, max 10, keyGenerator por IP.
  - `invitationRateLimiter`: ventana 15 min, max 10, keyGenerator por IP.
  - `generalApiRateLimiter`: ventana 1 min, max 300, keyGenerator por IP o userId.
- Manejador estándar de exceso: HTTP 429 con `{ "error": "RATE_LIMIT_EXCEEDED", "message": "Demasiadas solicitudes. Por favor intente más tarde." }`.
- Excluir rate limiting en entorno de pruebas unitarias (`process.env.NODE_ENV === "test" && !process.env.ENABLE_RATE_LIMIT_TESTS`) para no ralentizar ni afectar la suite de tests existente.

### 3. Pool de PostgreSQL y reintento de Deadlock (`api/src/db/pool.js` y `api/src/db/transaction.js`)
- En `api/src/db/pool.js`, configurar en el constructor de `pg.Pool`:
  - `statement_timeout: Number(process.env.DB_STATEMENT_TIMEOUT || 5000)`
  - `connectionTimeoutMillis: Number(process.env.DB_CONNECT_TIMEOUT || 3000)`
  - `idle_in_transaction_session_timeout: Number(process.env.DB_IDLE_TIMEOUT || 10000)`
- En `api/src/db/transaction.js` (o `inTransaction` compartida):
  - Ejecutar la operación en un bucle con hasta 2 reintentos si `error.code === '40P01'`.
  - Aplicar backoff exponencial con jitter (`25ms * 2^attempt + jitter`).

### 4. Idempotencia en endpoints de planilla (`ballot-service.js` y `voting.routes.js`)
- En `voting.routes.js`:
  - Extraer `idempotencyKey = request.header('Idempotency-Key') || request.header('X-Idempotency-Key')`.
  - Validar formato UUID si está presente.
- En `ballot-service.js`:
  - Extender `saveScore` y `submitBallot` para recibir `operationId = idempotencyKey`.
  - Si `operationId` está presente:
    - Consultar `ballot_sync_operation` para `(actorUserId, ballotId, operationId)`.
    - Si existe y `content_hash === operationHash(payload)`: retornar el resultado previamente guardado con `{ ...result, idempotencyReplay: true }`.
    - Si existe y difiere el hash: lanzar `Error("SYNC_OPERATION_MISMATCH")`.
    - Si no existe: proceder con la mutación y registrar en `ballot_sync_operation`.

### 5. Cadena de auditoría criptográfica general (Migración 068, `audit-service.js`, `verify-audit-chain.js`)
- Migración `068_general_audit_hash_chain.sql`:
  - Actualizar `audit_event_ceremonial_hash_fields` para admitir `hash_chain_version = 2` con `previous_hash` y `event_hash` válidos.
  - Crear tabla `general_audit_hash_chain_head (singleton BOOLEAN PRIMARY KEY DEFAULT TRUE, last_audit_event_id UUID, last_hash CHAR(64) NOT NULL DEFAULT repeat('0', 64), updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP)`.
- En `audit-service.js`:
  - Función `hashAuditEvent({ previousHash, eventId, action, entityType, entityId, before, after })`.
  - En `auditEvent()`: bloquear `general_audit_hash_chain_head` con `FOR UPDATE`, enlazar con `last_hash`, calcular `eventHash`, insertar con `hash_chain_version = 2`, actualizar `general_audit_hash_chain_head`.
- Script `api/src/scripts/verify-audit-chain.js`:
  - Recorre en orden cronológico (`ORDER BY created_at ASC, id ASC`) los registros con `hash_chain_version = 2`.
  - Recalcula el hash de cada eslabón y compara con `event_hash` y `previous_hash`.
  - Finaliza con exit 0 si la cadena está íntegra, exit 1 y mensaje detallado si se detecta alteración.
- Agregar script `"audit:verify": "node src/scripts/verify-audit-chain.js"` en `api/package.json`.

### 6. Graceful Shutdown y CI
- En `server.js`:
  - Capturar `SIGTERM` y `SIGINT`.
  - Llamar `server.close()` para no recibir nuevos requests.
  - Invocar `await closePool()`.
  - Salir con exit 0.
- En `.github/workflows/ci.yml`:
  - Matrix con Node 20 / 22 y servicio Postgres 16.
  - Pasos: migraciones, tests API, tests DB, tests cliente, build cliente, `audit:verify`, `npm audit`.
