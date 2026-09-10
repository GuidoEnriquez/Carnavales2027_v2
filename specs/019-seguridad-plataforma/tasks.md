# Tareas — Spec 019

## T08 — Corrección de límites de sesión y TRUST_PROXY (2026-09-10)

**RF:** Spec-019/RF-170 y RF-171. Plan aprobado por el responsable del proyecto. Estado: implementada y validada el 2026-09-10; conserva el cierre histórico T01–T07. Evidencia: sección T08 de `validation.md`.

- [x] Actualizar spec, clarificaciones y plan antes de implementar.
- [x] Separar consultas GET/HEAD de sesión del cupo sensible y agregar límite general independiente de autenticación.
- [x] Implementar y documentar lector validado de TRUST_PROXY sin dependencias nuevas.
- [x] Verificar límites, métodos/rutas, cabeceras, separación por IP/capa y confianza en proxies sin PostgreSQL.
- [x] Ejecutar suites API/BD y regresión OTP en base aislada, cliente/build y diff; registrar resultados reales.
- [x] Preparar entrega con comandos Git y archivos exactos, excluyendo el cambio local de client/package-lock.json.

## T01 — Cabeceras de seguridad y límites de payload HTTP (RF-170)

- [x] Instalar `helmet` en `api/package.json`.
- [x] Configurar `helmet` en `api/src/app.js` con CSP estricta y HSTS.
- [x] Configurar `express.json({ limit: "100kb" })` en `api/src/app.js`.
- [x] Configurar `trust proxy` en Express.
- [x] Crear prueba automatizada para verificar cabeceras de seguridad y rechazo de payloads superiores a 100kb (HTTP 413).

## T02 — Rate limiting por capas y protección anti-fuerza bruta (RF-171)

- [x] Instalar `express-rate-limit` en `api/package.json`.
- [x] Implementar middleware `rate-limiter.js` con configuraciones por capa (auth, invitaciones, general).
- [x] Integrar rate limiters en `api/src/app.js` y rutas correspondientes.
- [x] Crear pruebas automatizadas que verifiquen HTTP 429 y cabeceras `Retry-After` ante exceso de solicitudes.
- [x] Crear prueba automatizada que valide el bloqueo de cuenta de 15 minutos en Better Auth tras 10 intentos fallidos de OTP.

## T03 — Timeouts del pool PostgreSQL y reintento por deadlock (RF-172)

- [x] Configurar `statement_timeout`, `connectionTimeoutMillis` e `idle_in_transaction_session_timeout` en `api/src/db/pool.js`.
- [x] Implementar soporte de reintento automático ante error `40P01` (deadlock) con backoff y jitter en transacciones.
- [x] Crear prueba que verifique la configuración de timeouts y el reintento exitoso ante deadlock simulado.

## T04 — Idempotencia en escrituras de planillas (RF-173)

- [x] Modificar `voting.routes.js` para extraer y validar `Idempotency-Key` opcional.
- [x] Modificar `saveScore` y `submitBallot` en `ballot-service.js` para consultar y registrar en `ballot_sync_operation`.
- [x] Crear pruebas automatizadas que verifiquen:
  - Replay idéntico devuelve HTTP 200 con el estado previo sin disparar `SCORE_IMMUTABLE`.
  - Replay con payload discrepante devuelve HTTP 409 `SYNC_OPERATION_MISMATCH`.
  - Solicitudes concurrentes con la misma clave se procesan de forma determinista.

## T05 — Cadena de integridad criptográfica general en `audit_event` (RF-174)

- [x] Crear migración `068_general_audit_hash_chain.sql` actualizando restricciones y creando `general_audit_hash_chain_head`.
- [x] Modificar `auditEvent()` en `audit-service.js` para encadenar hashes criptográficos SHA-256 (JCS RFC 8785) con `hash_chain_version = 2`.
- [x] Crear script ejecutable `api/src/scripts/verify-audit-chain.js`.
- [x] Añadir comando `"audit:verify"` en `api/package.json`.
- [x] Crear pruebas que verifiquen:
  - Generación continua de cadena de hashes en eventos sucesivos.
  - Detección de manipulación deliberada en un registro mediante `audit:verify`.

## T06 — Graceful shutdown y CI automatizada (RF-175)

- [x] Implementar captura de `SIGINT` y `SIGTERM` con cierre de servidor y `closePool()` en `api/src/server.js`.
- [x] Crear workflow `.github/workflows/ci.yml` configurando servicio PostgreSQL, ejecución de migraciones, tests y build.

## T07 — Validación integral y reporte

- [x] Ejecutar migraciones completas 001-068.
- [x] Ejecutar suite completa de tests de API (`npm test`).
- [x] Ejecutar suite completa de tests de BD (`npm run db:test`).
- [x] Ejecutar verificación de cadena de auditoría (`npm run audit:verify`).
- [x] Ejecutar suite completa de tests de cliente (`npm test` en `client/`).
- [x] Ejecutar build de producción del cliente (`npm run build` en `client/`).
- [x] Documentar evidencias detalladas en `specs/019-seguridad-plataforma/validation.md`.
- [x] Actualizar `docs/sdd-status.md` y `docs/source-map.md`.
