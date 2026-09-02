# Validación — Spec 011: Sorteo ceremonial

## Estado

- T01–T05 implementados y validados automáticamente el 2026-09-02.
- T06 permanece pendiente: comprobación manual en 390x844, 768x1024 y 1440x900 con teclado y emulación táctil. T07 queda bloqueada por T06.

## Evidencia ejecutada

| Área | Comando | Resultado |
|---|---|---|
| Servicio ceremonial | `node --import=dotenv/config --test src/modules/results/ceremonial-draw-service.test.js` en `api/` | 18 passed, 0 failed. |
| Endpoint ceremonial | `node --import=dotenv/config --test src/tests/results-ceremonial-draw.test.js` en `api/` | 1 passed, 0 failed. Cubre 403, pool vacío, UUID inválido, pool desactualizado, éxito, auditoría y duplicado. |
| Lecturas de escrutinio | `results-ceremonial-draw.test.js` | SCRUTINEER puede listar competencias y comparsas mediante endpoints de lectura acotados; ADMIN no obtiene el acceso ceremonial. |
| API completa | `npm test` en `api/` | 78 passed, 0 failed. |
| Persistencia | `npm run db:test` en `api/` | 38 passed, 0 failed. |
| Cliente | `npm test` en `client/` | 67 passed, 0 failed. |
| Cliente (T03) | `npx vitest run src/features/results/useCountdown.test.jsx` en `client/` | 4 passed, 0 failed. |
| Cliente completo | `npm test` en `client/` | 57 passed, 0 failed; 19 archivos. |
| Modal ceremonial | `npx vitest run src/features/results/CeremonialDrawModal.test.jsx` en `client/` | 4 passed, 0 failed. |
| Hook ceremonial | `npx vitest run src/features/results/useCeremonialDraw.test.jsx` en `client/` | 2 passed, 0 failed. |
| Cliente completo actualizado | `npm test` en `client/` | 67 passed, 0 failed; 24 archivos. |
| Vista de escrutinio | `npx vitest run src/pages/AdminResultsPage.test.jsx` en `client/` | 2 passed, 0 failed. Incluye detección del empate y manejo de error de competencias sin carga infinita. |
| Guard de escrutinio | `npx vitest run src/auth/RequireResultsRole.test.jsx` en `client/` | 2 passed, 0 failed. ADMIN denegado; SCRUTINEER permitido (visible como Escrutador / Escribano). |
| Build | `npm run build` en `client/` | Exitoso; 53 módulos transformados. |
| Migraciones | `migrate()` durante tests | Aplicadas hasta 058 en la base de test. |
| Revisión | `git diff --check` | Sin errores de whitespace. |

## Cobertura actual

| Requisito | Evidencia |
|---|---|
| RF-98 | Rutas de lectura `GET /api/v1/results/events` y `GET /api/v1/results/events/:eventId/troupes`, más `POST /api/v1/events/:eventId/tie-breaker/ceremonial-draw`. |
| RF-99 | Validación de UUID, pool vacío y coincidencia exacta con el empate vigente. |
| RF-100 | `useCountdown.js`, `CeremonialDrawModal.jsx` y sus tests cubren el countdown 5→0 y la transición de revelación. |
| RF-101 | `crypto.randomInt()` y nonce de trazabilidad. |
| RF-102 | Cadena JCS/SHA-256, migración 058 y prueba de auditoría. |
| RF-103 | 2FA + `ADMIN`, `SCRUTINEER`, `ESCRIBANO`; invitación ESCRIBANO probada por API. |
| RF-104 | Unique index parcial 054, bloqueo del evento y rechazo de duplicado. |
| RF-105 | Modal con foco inicial, Tab trap, Escape y revelación persistente. Validación manual pendiente T06. |

## Dudas / límites actuales

- El nonce se registra para trazabilidad; `crypto.randomInt()` no pretende ser reproducible.
- `SCRUTINEER` es el identificador técnico único; la migración 056 consolida cualquier asignación histórica de `ESCRIBANO` y elimina ese alias del catálogo. Verificación en desarrollo: usuario `escrutador@example01.com` con `SCRUTINEER`; catálogo sin `ESCRIBANO`.
- La ruta manual `TIE_BREAKER_REQUIRES_MANUAL_DRAW` de Spec 010 se conserva hasta completar Spec 011.
- La validación manual de T06 aún no está realizada.
- La vista de escrutinio está integrada en `#/admin/results`. La validación manual de T06 queda pendiente en 390x844, 768x1024 y 1440x900.
- La API de desarrollo responde `200` en `/health`; `/api/v1/events` sin sesión responde `401`, por lo que el cliente debe mostrar un error accionable y no dejar el estado de carga infinito.
