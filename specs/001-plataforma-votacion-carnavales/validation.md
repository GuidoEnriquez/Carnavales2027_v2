# Validación — Spec 001 · Incrementos I1 e I1-C

## Estado

- **I1-C validado:** 2026-08-30.
- **Resultado:** suites, build, migraciones y seeds aplicables completados sin fallos.

## Evidencia ejecutada

| Área | Comando | Resultado |
|---|---|---|
| API | `TEST_DATABASE_URL=… npm test` | 35 passed, 0 failed |
| Persistencia | `TEST_DATABASE_URL=… npm run db:test` | 12 passed, 0 failed |
| Cliente | `npm test` en `client/` | 22 passed, 0 failed |
| Build | `npm run build` en `client/` | exitoso, 36 módulos transformados |
| Dependencias API | `npm audit --omit=dev --audit-level=high` | 0 vulnerabilities |
| Dependencias cliente | `npm audit --omit=dev --audit-level=high` | 0 vulnerabilities |
| Migraciones | suite + dos ejecuciones de `npm run db:migrate` + `--status` | 001–021 aplicadas; segunda ejecución sin pendientes |
| Seed Goya | `NODE_ENV=test npm run db:seed:goya` dos veces | ambas ejecuciones exitosas |
| Flujo real | password → habilitación 2FA → OTP → configuración completa → apertura | sesión ADMIN real, readiness `true`, estado `OPEN`, escritura posterior `409` y auditoría `EVENT_OPENED` = 1 |
| Login en navegador | `http://127.0.0.1:5173/#/login` | formulario de correo/contraseña renderizado; secuencia OTP cubierta por `LoginPage.test.jsx` |

## Matriz de requisitos I1

| Requisito | Evidencia |
|---|---|
| RF-01, RF-01a, RF-01b, RF-02 | `events-api.test.js`, `readiness-api.test.js` y migraciones 014/016/017; toda escritura operativa bloquea la fila del evento, prohíbe reasignar o borrar configuración de eventos `OPEN`, valida transiciones directas y devuelve `EVENT_LOCKED` tras `OPEN` |
| RF-01c, RF-01c.1, RF-01g.4 | `event-readiness.test.js`, `readiness-api.test.js` y `EventReadinessPanel.test.jsx`; apertura transaccional, carrera apertura/escritura serializada y faltantes estructurados |
| RF-01d, RF-01j–RF-01n | `rubrics.test.js`, `rubrics-api.test.js`, `EventConfigurationPage.test.jsx`; especialidades derivadas, objetivo nominación con tipo de sujeto, sin `rubro_especialidad` |
| RF-01f | `specialties-api.test.js`, `goya-seed.test.js` y `EventConfigurationPage.test.jsx`; Baile, Vestuario y Batería son sugerencias editables del seed, no defaults globales; la identidad estable de migración 015 preserva idempotencia al renombrar el evento |
| RF-01g–RF-01g.3 | `categories.test.js`, `troupes.test.js`, `categories-api.test.js` |
| RF-01h, RF-01i | `schedule.test.js`; entidad sin rutas de sorteo/rotación |
| RF-01k–RF-01o | `nominations.test.js`; entidad sin rutas o workflow operativo |
| RF-01p–RF-01s | `authz.test.js`, `bootstrap-admin.test.js`, `seed.test.js`, `last-admin.test.js` |
| RF-01t–RF-01v | `two-factor.test.js`, `LoginPage.test.jsx` y smoke real password → habilitación 2FA → OTP → sesión ADMIN |
| RF-01w | `categories-api.test.js`, `rubrics-api.test.js`, `EventConfigurationPage.test.jsx`; listado, edición y soft-disable de categorías, comparsas, especialidades, rubros, ítems y criterios |
| RF-01x | migraciones 019–021, `configuration-closure.test.js` y guardas previas de migración 017; criterios, nominaciones y programación rechazan INSERT/UPDATE/DELETE tras `OPEN` |
| RF-01y | migración 019, `rubrics-api.test.js` y panel administrativo; criterio descriptivo separado y sin columna de puntaje ni impacto en readiness |
| RF-01z | `http-errors.js`, `categories-api.test.js`, `readiness-api.test.js` y `http.test.js`; errores 400/404/409 estables y detalles preservados por cliente |
| Gestión ADMIN existente | `users-api.test.js`, `last-admin.test.js`, `SessionProvider.test.jsx`; sesión 2FA+ADMIN, auditoría y protección del último ADMIN |
| RF-15 | `audit.test.js` y auditoría de escrituras administrativas |
| RNF-01 | middlewares sesión/2FA/ADMIN y pruebas API |
| RNF-03, RNF-04 | migraciones con checksums/idempotencia y suites reales |
| RNF-06 | `bootstrap-admin.test.js` |

## Diferido explícitamente

I1 no implementa votación, asignación de jurados, planillas, offline/sync, sorteo, rotación, reprogramación, gestión operativa de nominaciones, penalizaciones, escrutinio, resultados ni actas.

I2-A e I2-B están implementados y validados en `specs/002-jurados-asignaciones/validation.md`; la votación y la operación competitiva permanecen diferidas.

## Revisión final

- `git diff --check`: sin errores.
- Revisión backend y frontend: sin bloqueantes restantes después de corregir referencias inactivas, carga parcial, carrera de readiness y contratos de error.
- No se agregaron rutas de votación, nominaciones operativas, programación operativa, offline, penalizaciones, escrutinio, resultados o actas.
