# Validación — Spec 016: Supervisión de Votación por VEEDOR

## Evidencia automatizada

Fecha de ejecución: 2026-09-04.

- `api`: `node --import=dotenv/config --test --test-concurrency=1 src/tests/monitor-api.test.js` → **1 passed, 0 failed**.
  - Verifica sesión, 2FA, roles `VEEDOR`/`ADMIN`, rechazo de roles no autorizados, agregados por noche, ruta de detalle y mínimo privilegio.
- `client`: `npm test` → **30 archivos, 108 tests passed, 0 failed**.
- `client`: `npm run build` → **build exitoso**.
- `client`: cobertura específica de guard, pantalla, polling, navegación y redirect VEEDOR incluida en `RequireVotingObserverRole.test.jsx`, `VeedorMonitorPage.test.jsx`, `AppNavigation.test.jsx`, `HomePage.test.jsx` y `LoginPage.test.jsx`.

## Corrección de integración descubierta

La suite de monitorización inicialmente recibía `ADMIN_REQUIRED` antes de ejecutar `requireVotingObserver`. La causa era que `events.routes.js` y `judges.routes.js` aplicaban guardias mediante `router.use` sin prefijo; al estar ambos routers montados en `/api/v1`, interceptaban rutas ajenas. Las guardias quedaron limitadas a sus prefijos funcionales y la prueba específica pasó.

## Pendientes

- La suite completa de API se ejecutó: **108 tests, 108 passed, 0 failed**. Las aserciones de base de datos ahora validan códigos SQL estables en lugar de mensajes dependientes de la localización.
- Falta comprobación manual en 390×844, 768×1024 y 1440×900, teclado y emulación táctil.
