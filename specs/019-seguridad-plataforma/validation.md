# Validación — Spec 019

## Corrección T08 — 2026-09-10

**Resultado:** implementada y validada. Cobertura: Spec-019/RF-170 y RF-171. El registro T01–T07 de 2026-09-08 se conserva debajo sin sustituir sus cifras.

### Cambios y escenarios comprobados

- Lecturas GET/HEAD del pathname exacto `/api/auth/get-session`, con o sin query, conservan acceso después de superar once lecturas o agotar el cupo sensible. El resto de métodos, subrutas y variantes conserva el cupo sensible compartido 10/15min/IP, incluido login/OTP.
- La consulta de sesión número 301 recibe 429 por el contador general de autenticación, con `code: RATE_LIMIT_EXCEEDED`, cabeceras RateLimit y Retry-After. Contadores sensibles, auth general, API e invitaciones independientes; separación entre IP simuladas a través de un proxy confiable.
- `TRUST_PROXY` ausente/numérico, desactivado, redes y alias: parser y resolución HTTP comprobados. `0`/`false` ignoran X-Forwarded-For; `1` representa un salto real. Valores inválidos y confianza global fallan antes de iniciar HTTP, sin reflejar el valor recibido.
- Las pruebas nuevas usan un handler de autenticación simulado y no requieren BD. La suite completa sí verifica Better Auth y el bloqueo OTP real.

### Comandos y evidencia

Entorno Windows/Node 22.19.0. Rama `fix/auth-rate-limit-proxy`, creada desde `origin/master` tras `git fetch origin`, base `c7905de`. Para migraciones y suites API/BD se cargó `api/.env` y se pasó a los procesos hijos `DATABASE_URL=TEST_DATABASE_URL`, `NODE_ENV=test`, `EMAIL_PROVIDER=console`. Se comprobó conexión local, nombre de base de pruebas y base distinta de desarrollo antes de cualquier escritura. No se registran URLs ni credenciales.

| Comando | Resultado |
|---|---|
| `node --test src/tests/auth-session-rate-limiting.test.js src/tests/trust-proxy.test.js src/tests/security-headers.test.js` (api) | 12/12, 0 omitidas; 933 ms; sin BD |
| `npm run auth:migrate` (api, base de pruebas) | Better Auth 1.6.27: migración exitosa |
| `npm run db:migrate` (api, base de pruebas) | Aplicadas 001–070 sobre base inicialmente sin tablas; sin migraciones nuevas |
| `npm test` (api, base de pruebas) | 151/151, 0 omitidas, 47.49 s; incluye persistencia y regresión de bloqueo OTP |
| `npm run db:test` (api, base de pruebas) | 72/72, 0 omitidas, 1.03 s; estas pruebas también están incluidas en npm test |
| `npm.cmd test -- --reporter=dot` (client) | 41 archivos, 258/258, 10.71 s |
| `npm.cmd run build` (client) | Exitoso, 71 módulos, 1.47 s |
| `git diff --check` | Exit 0, sin errores de whitespace; Git informa conversión LF/CRLF de Windows |

No existen scripts lint/typecheck en los manifests; no se afirma su ejecución. Sin cambios de UI, dependencias, esquema, reglas de votación ni archivos `.env` reales. No se requiere nueva validación visual para este cambio de middleware.

### Revisión de entrega

Archivos: `api/src/app.js`, `api/src/auth/rate-limiter.js`, nuevo `api/src/config/trust-proxy.js`, dos nuevos archivos de pruebas auth-session/trust-proxy, `api/.env.example`, README, cinco artefactos de Spec 019 y referencias breves en `docs/source-map.md`/`docs/sdd-status.md`. Revisión de diff sin secretos ni cambios ajenos de implementación. Se preserva el cambio previo de `client/package-lock.json` fuera de la corrección. No se realizó commit, push ni merge.

Limitación conservada y documentada: varios usuarios detrás de una misma IP siguen compartiendo el cupo sensible; esta tarea no implementa protección por cuenta. El valor predeterminado `TRUST_PROXY=1` se conserva por compatibilidad y exige configurar explícitamente la topología real antes de producción.

## Estado de Validación

- **Fecha:** 2026-09-08
- **Alcance evaluado:** T01 a T07 de Spec 019.
- **Resultado General:** EXITOSA (100% pruebas aprobadas).

## Matriz de Cobertura de Requisitos

| Requisito | Descripción | Estado | Evidencia |
|---|---|---|---|
| RF-170 | Cabeceras de seguridad HTTP (`helmet`), límite 100kb y `trust proxy` | Validado | `api/src/tests/security-headers.test.js` |
| RF-171 | Rate limiting por capas (auth, invitaciones, API) y bloqueo OTP Better Auth | Validado | `api/src/tests/rate-limiting.test.js`, `api/src/tests/otp-lockout.test.js` |
| RF-172 | Timeouts de conexión/sentencias y reintento por deadlock PostgreSQL | Validado | `api/src/tests/db-timeouts-and-deadlock.test.js` |
| RF-173 | Idempotencia en escrituras de planillas (`scores` y `submit`) | Validado | `api/src/tests/ballot-idempotency.test.js` |
| RF-174 | Cadena de integridad criptográfica general en `audit_event` y `audit:verify` | Validado | `api/src/tests/audit-chain.test.js`, `api/src/scripts/verify-audit-chain.js` |
| RF-175 | Graceful shutdown en `server.js` y workflow de CI en GitHub Actions | Validado | `api/src/tests/server-shutdown.test.js`, `.github/workflows/ci.yml` |

## Registro de Pruebas Automatizadas

### 1. Tests de API (`npm test`)
```
ℹ tests 134
ℹ suites 4
ℹ pass 134
ℹ fail 0
ℹ duration_ms 24367.813078
```

### 2. Tests de Base de Datos (`npm run db:test`)
```
ℹ tests 68
ℹ suites 4
ℹ pass 68
ℹ fail 0
ℹ duration_ms 583.856894
```

### 3. Verificación de Cadena de Auditoría (`npm run audit:verify`)
```
✅ Cadena de auditoría íntegra: 0 eventos verificados correctamente en DEV (genesis).
✅ Cadena de auditoría íntegra: 271 eventos verificados correctamente en TEST.
```

### 4. Tests de Cliente (`npm test` en `client/`)
```
Test Files  31 passed (31)
     Tests  138 passed (138)
  Duration  5.56s
```

### 5. Build de Producción (`npm run build` en `client/`)
```
✓ built in 746ms
dist/assets/index-CkS57qMY.css   61.88 kB │ gzip: 11.61 kB
dist/assets/index-fpAyjqO4.js   350.26 kB │ gzip: 96.81 kB
```

## Verificación de Integridad

- Migraciones: 001 a 068 aplicadas sin pendientes.
- Git diff limpio de secretos y archivos temporales.
- Invariantes de gobernanza, inmutabilidad y segregación de roles respetados.
