# Validación — Spec 001 · Incremento I1

## Evidencia ejecutada

| Área | Comando | Resultado |
|---|---|---|
| API | `TEST_DATABASE_URL=… npm test` | 33 passed, 0 failed |
| Persistencia | `TEST_DATABASE_URL=… npm run db:test` | 11 passed, 0 failed |
| Cliente | `npm test` en `client/` | 15 passed, 0 failed |
| Build | `npm run build` en `client/` | exitoso |
| Dependencias API | `npm audit --omit=dev --audit-level=high` | 0 vulnerabilities |
| Migraciones | suite de migraciones + `npm run db:migrate -- --status` | 001–017 aplicadas en desarrollo y test |
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
| RF-15 | `audit.test.js` y auditoría de escrituras administrativas |
| RNF-01 | middlewares sesión/2FA/ADMIN y pruebas API |
| RNF-03, RNF-04 | migraciones con checksums/idempotencia y suites reales |
| RNF-06 | `bootstrap-admin.test.js` |

## Diferido explícitamente

I1 no implementa votación, asignación de jurados, planillas, offline/sync, sorteo, rotación, reprogramación, gestión operativa de nominaciones, penalizaciones, escrutinio, resultados ni actas.
