# Tareas — Spec 016: Supervisión de Votación por VEEDOR

## T016.1 — Endpoint de supervisión (API)
- **Estado:** completada
- Crear `api/src/routes/monitor.routes.js` con `GET /api/v1/monitor/events` bajo `[requireSession, requireTwoFactor, requireVotingObserver]`.
- Consulta agregada: eventos con noches `COMPETITION` que tengan planillas o ventana de votación, con `counts` por estado y `total` votante. Sin puntajes, jurados ni comparsas.
- Montar router en `api/src/app.js`.
- **RF:** RF-131, RF-132, RF-133.

## T016.2 — Tests API del endpoint
- **Estado:** completada
- Crear `api/src/tests/monitor-api.test.js`: acceso VEEDOR y ADMIN; 403 a JUDGE/COMISARIO/SCRUTINEER/ESCRIBANO; 401/403 sin sesión/2FA; payload solo con agregados.
- **RF:** RF-131, RF-132, RF-133.

## T016.3 — Guard de cliente
- **Estado:** completada
- Crear `client/src/auth/RequireVotingObserverRole.jsx` (VEEDOR o ADMIN) con estados loading/anonymous/2FA/error/denegado.
- Test: `client/src/auth/RequireVotingObserverRole.test.jsx`.
- **RF:** RF-136.

## T016.4 — Vista de supervisión
- **Estado:** completada
- Crear `client/src/pages/VeedorMonitorPage.jsx`: selectores de evento/noche, tarjetas de conteo, progreso de confirmación, estado de ventana, empty-states y errores.
- Polling 15 s con pausa en pestaña oculta y reanudación con refresco inmediato.
- Registrar `#/veedor` en `client/src/App.jsx`.
- Test: `client/src/tests/VeedorMonitorPage.test.jsx` (render, polling con fake timers, pausa en `hidden`).
- **RF:** RF-134, RF-135, RF-137.

## T016.5 — Navegación y redirección
- **Estado:** completada
- `AppNavigation.jsx`: enlace «Supervisión» para VEEDOR/ADMIN.
- `LoginPage.jsx`: rol único VEEDOR → `#/veedor`.
- Actualizar `AppNavigation.test.jsx` y `LoginPage.test.jsx`.
- **RF:** RF-136.

## T016.6 — Estilos del monitor
- **Estado:** completada
- Tarjetas de conteo y barra de progreso en `client/src/index.css`, dark mode, responsive 390/768/1440.
- **RF:** RF-137.

## T016.7 — Validación integral
- **Estado:** en validación
- Suites API + cliente + DB verdes, `npm run build`, comprobación manual 3 viewports, teclado y táctil.
- Completar `validation.md` con evidencia real.
- **RF:** todos.
