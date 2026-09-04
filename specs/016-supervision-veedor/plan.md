# Plan — Spec 016: Supervisión de Votación por VEEDOR

1. **API — endpoint de descubrimiento (solo lectura):**
   - Crear `api/src/routes/monitor.routes.js` con `GET /api/v1/monitor/events`, cadena `[requireSession, requireTwoFactor, requireVotingObserver]`.
   - Reutilizar `listEvents` y, por evento, una consulta agregada sobre `night` (kind `COMPETITION`) con `LEFT JOIN` a `voting_window` y conteo de `ballot` por estado. Sin puntajes, jurados ni comparsas (RF-131, RF-132).
   - Montar el router en `api/src/app.js` bajo `/api/v1`.

2. **Cliente — guard y ruta:**
   - Crear `client/src/auth/RequireVotingObserverRole.jsx` (patrón idéntico a `RequirePenaltiesRole.jsx`) admitiendo `VEEDOR` o `ADMIN`.
   - Registrar la ruta `#/veedor` en `client/src/App.jsx` con el guard dentro de `ProtectedShell`.

3. **Cliente — vista de supervisión:**
   - Crear `client/src/pages/VeedorMonitorPage.jsx`: selector de evento y noche, tarjetas de conteo, barra de progreso de confirmación, estado de ventana, polling 15 s con pausa en pestaña oculta (`visibilitychange`) y mensajes de empty-state/error en lenguaje de negocio.
   - `aria-live="polite"` en conteos; sin acciones de escritura.

4. **Navegación y redirección:**
   - `AppNavigation.jsx`: enlace «Supervisión» visible para `VEEDOR`/`ADMIN`.
   - `LoginPage.jsx` (`goToRoleHome`): rol único `VEEDOR` → `#/veedor`.

5. **Estilos:**
   - Reutilizar tokens dark existentes en `client/src/index.css`; añadir estilos mínimos para tarjetas de conteo y barra de progreso del monitor si los componentes actuales no los cubren.

6. **Pruebas y validación:**
   - Tests API: acceso VEEDOR/ADMIN permitido; rechazo a JUDGE/COMISARIO/SCRUTINEER/ESCRIBANO/sin 2FA; payload solo con agregados.
   - Tests cliente: render de conteos y estados, guard, polling con fake timers (pausa en `hidden`), redirección de login, enlace de navegación.
   - Suites completas verdes (API, DB, cliente) + `npm run build`.
   - Comprobación manual en 390×844, 768×1024 y 1440×900, teclado y emulación táctil.
