# Spec 019 — Seguridad HTTP, Resiliencia de Persistencia, Idempotencia de Planilla y Cadena de Auditoría

## Estado

- **Fase SDD:** Especificación para implementación (Fase 1 de `PLAN-maestro.md`).
- **Fuente:** `PLAN-maestro.md` §1.3 (B. Seguridad, C. Concurrencia), §3 (Backend), §4 (Fase 1); `docs/constitution.md` Principios 3, 5 y 6; Better Auth 1.6.27 (`verify-two-factor.mjs`).
- **Relación:** Endurece la superficie expuesta y la resiliencia operativa sin alterar las reglas de votación, roles, fórmulas de resultados ni actas.

## Objetivo

Eliminar la superficie de ataque no protegida (fuerza bruta en login/OTP/invitaciones, payloads desmedidos, cabeceras inseguras), garantizar la resiliencia transaccional del backend ante deadlocks y timeouts de base de datos, brindar idempotencia a las operaciones críticas de carga de planillas evitando errores falsos de inmutabilidad, y extender la cadena de integridad criptográfica a todos los eventos de auditoría con verificación reproducible.

## Alcance

Incluye:

- Incorporación de cabeceras de seguridad (`helmet`), límite estricto de body JSON (`100kb`) y configuración de `trust proxy` en Express.
- Rate limiting por capas para `/api/auth/*` (login, OTP resend), endpoints públicos de invitaciones (`inspect`/`accept`) y límite general de `/api/v1/*`.
- Verificación automatizada documentada del bloqueo de cuenta tras 10 intentos fallidos de OTP en Better Auth 1.6.27.
- Timeouts de conexión, ejecución de sentencias y transacciones inactivas en el pool PostgreSQL (`api/src/db/pool.js`).
- Detección y reintento automático de transacciones ante deadlocks (`40P01`) en `inTransaction()`.
- Soporte del encabezado `Idempotency-Key` en `PUT /api/v1/judge/ballots/:ballotId/scores/:scoreId` y `POST /api/v1/judge/ballots/:ballotId/submit` reutilizando la tabla `ballot_sync_operation`.
- Migración 068 para cadena de integridad criptográfica general (JCS/SHA-256) sobre `audit_event` y script de verificación `npm run audit:verify`.
- Graceful shutdown en `server.js` y workflow de CI automatizada en GitHub Actions (`.github/workflows/ci.yml`).

Excluye:

- Cambios a las pantallas operativas del jurado o diseño visual del cliente (corresponden a Specs 020 y 021 / Fases 2 y 3).
- Apertura o activación de sincronización Offline-First (módulo diferido).
- Portal público de resultados (Fase 6 / Spec 024).
- Modificación del modelo de datos de comparsas, eventos o jurados.

## Requisitos Funcionales

- **RF-170 (Cabeceras HTTP y protección de carga útil).**
  - La API DEBE configurar `helmet` con políticas que incluyan: HSTS (en producción), `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, y Content-Security-Policy estricta para API (`default-src 'none'; frame-ancestors 'none'`).
  - El middleware `express.json()` DEBE establecer un límite máximo de tamaño de payload de `100kb`.
  - La API DEBE configurar `trust proxy` en Express a partir de la variable `TRUST_PROXY` (por defecto `1` o según configuración) para resolver correctamente la IP real del cliente.

- **RF-171 (Rate limiting por capas y protección anti-fuerza bruta).**
  - La API DEBE aplicar limitación de tasa por IP mediante `express-rate-limit`:
    - **Capa Autenticación (`/api/auth/*`):** máximo 10 solicitudes por ventana de 15 minutos por IP para operaciones sensibles (resend OTP, credential sign-in).
    - **Capa Invitaciones Públicas (`/api/v1/*invitations/inspect`, `/accept`):** máximo 10 solicitudes por ventana de 15 minutos por IP.
    - **Capa API General (`/api/v1/*`):** máximo 300 solicitudes por minuto por IP/usuario.
  - Toda solicitud que exceda el límite DEBE responder con HTTP 429 `{ "error": "RATE_LIMIT_EXCEEDED", "message": "Demasiadas solicitudes. Por favor intente más tarde." }`, cabeceras estándar `Retry-After` y `RateLimit-*`.
  - Se DEBE proveer una prueba automatizada explícita que valide que Better Auth 1.6.27 bloquea temporalmente la cuenta (15 minutos) tras 10 intentos fallidos de OTP.

- **RF-172 (Timeouts de base de datos y reintento por deadlock).**
  - El pool de PostgreSQL (`api/src/db/pool.js`) DEBE configurar timeouts defensivos:
    - `statement_timeout: 5000` (5 segundos) para abortar consultas que superen el umbral de bloqueo.
    - `connectionTimeoutMillis: 3000` (3 segundos) para rechazar solicitudes en caso de saturación del pool.
    - `idle_in_transaction_session_timeout: 10000` (10 segundos) para abortar transacciones abiertas abandonadas.
  - El ejecutor transaccional `inTransaction()` DEBE detectar el código de error PostgreSQL `40P01` (deadlock_detected) y reintentar la transacción hasta 2 veces con backoff exponencial y jitter aleatorio antes de propagar la excepción.

- **RF-173 (Idempotencia en escrituras de planillas).**
  - Los endpoints de escritura individual `PUT /api/v1/judge/ballots/:ballotId/scores/:scoreId` y confirmación `POST /api/v1/judge/ballots/:ballotId/submit` DEBEN admitir el encabezado `Idempotency-Key` (UUID v4).
  - Al procesar la solicitud con `Idempotency-Key`, el sistema DEBE consultar en `ballot_sync_operation` si la tupla `(actor_user_id, ballot_id, operation_id)` ya fue registrada:
    - Si existe y el `content_hash` coincide con el payload actual, DEBE devolver el resultado previo (HTTP 200 con la entidad guardada) sin re-ejecutar la mutación ni disparar un error 409 `SCORE_IMMUTABLE` o `BALLOT_ALREADY_SUBMITTED`.
    - Si existe y el `content_hash` discrepa, DEBE responder HTTP 409 con código `SYNC_OPERATION_MISMATCH`.
    - Si no existe, ejecuta la operación normalmente y persiste el registro en `ballot_sync_operation` de forma atómica en la misma transacción.

- **RF-174 (Cadena de integridad criptográfica general en `audit_event`).**
  - Se DEBE aplicar una migración (068) que adapte las restricciones de `audit_event` para admitir encadenamiento criptográfico general con `hash_chain_version = 2` y cree la tabla `general_audit_hash_chain_head`.
  - Toda llamada a `auditEvent()` DEBE calcular de forma transaccional el hash SHA-256 canónico (JCS RFC 8785 vía `canonicalizeJson`) sobre el evento actual enlazado al hash del evento previo.
  - Se DEBE proveer un comando ejecutable `npm run audit:verify` (`api/src/scripts/verify-audit-chain.js`) que recorra cronológicamente la tabla `audit_event`, verifique matemáticamente la integridad de cada eslabón y finalice con exit 0 si está íntegra o con exit 1 y detalle del evento alterado ante cualquier ruptura.

- **RF-175 (Higiene de plataforma: Graceful shutdown y CI automatizada).**
  - `server.js` DEBE registrar manejadores para las señales `SIGINT` y `SIGTERM`, deteniendo la aceptación de nuevas conexiones HTTP, otorgando hasta 5 segundos para que las peticiones activas culminen, y cerrando ordenadamente el pool mediante `closePool()`.
  - Se DEBE incluir un archivo de workflow de GitHub Actions en `.github/workflows/ci.yml` que provisione un contenedor de PostgreSQL, ejecute migraciones, corra las suites completas de pruebas de API y DB, los tests de cliente, el build de producción y la verificación de dependencias `npm audit`.

## Criterios de Aceptación

- Todas las peticiones HTTP a la API incluyen las cabeceras de seguridad configuradas por `helmet`.
- Cargas JSON superiores a `100kb` son rechazadas con HTTP 413 Payload Too Large.
- Los intentos repetidos en autenticación e invitaciones que superen los umbrales reciben HTTP 429 `RATE_LIMIT_EXCEEDED` con encabezado `Retry-After`.
- Las consultas que excedan 5 segundos o transacciones inactivas de más de 10 segundos son canceladas por el motor PostgreSQL.
- Transacciones que experimentan `40P01` son reintentadas automáticamente sin fallar de cara al usuario cuando el conflicto es transitorio.
- Un reintento idéntico de `PUT /scores/:id` o `POST /submit` con el mismo `Idempotency-Key` retorna 200 con el estado guardado, sin error 409.
- Toda inserción en `audit_event` queda enlazada criptográficamente; `npm run audit:verify` valida la cadena completa y detecta filas alteradas.
- `server.js` se cierra ordenadamente ante `SIGTERM` sin dejar conexiones huérfanas en PostgreSQL.
- El build y la totalidad de los tests de API, DB y cliente pasan al 100%.
