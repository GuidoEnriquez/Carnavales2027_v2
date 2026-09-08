# Plan de Implementación — Spec 020: Fundación del Sistema de Diseño

## Enfoque de Implementación

La implementación se estructura en 5 fases de trabajo atómicas para asegurar que ninguna pantalla existente sufra regresiones:

1. **Tokens y Capas CSS (RF-176, RF-177):**
   - Crear `client/src/styles/tokens.css` con variables completas: colores semánticos, tipografía, escalas de espaciado, radios, z-index y variables táctiles.
   - Definir variables para `data-layer="brand"` y `data-layer="instrument"`.
   - Incluir media queries para `prefers-reduced-motion` y `prefers-contrast`.
   - Integrar `tokens.css` en `client/src/main.jsx` o en la cabecera de `index.css`.
   - Mapear variables heredadas (`--bg-color`, `--text-color`, `--card-bg`, etc.) hacia los tokens semánticos correspondientes.

2. **Componentes Atómicos Compartidos (RF-178):**
   - `<Dialog>` (`client/src/components/Dialog.jsx` y `Dialog.test.jsx`):
     - Uso de `<dialog>` nativo con polyfill de métodos si fuera necesario.
     - Manejo de `focusReturnRef` para restaurar foco.
     - Captura de eventos `cancel` y click fuera (backdrop) para invocar `onClose`.
     - Roles y atributos de accesibilidad `aria-labelledby`, `aria-describedby`.
   - `<Button>` (`client/src/components/Button.jsx` y `Button.test.jsx`):
     - Soporte para `variant`: `primary`, `secondary`, `danger`, `ghost`.
     - Soporte para `busy` (muestra spinner/texto accesible y desactiva con `aria-busy="true"`).
     - Altura mínima táctil de 48px.
   - `<StatusPill>` (`client/src/components/StatusPill.jsx`):
     - Mapeo semántico de estados a colores con alto contraste.
   - `<ProgressBar>` (`client/src/components/ProgressBar.jsx`):
     - Elemento semántico con atributos `role="progressbar"`, `aria-valuenow`, `aria-valuemin`, `aria-valuemax`.
   - `<Toast>` (`client/src/components/Toast.jsx`):
     - Notificación viva con `role="status"` y `aria-live="polite"`.

3. **Infraestructura de Roles y Rutas (RF-179):**
   - Crear `client/src/auth/RequireAnyRole.jsx`.
   - Refactorizar `RequireAdmin.jsx`, `RequireRole.jsx`, `RequireResultsRole.jsx`, `RequirePenaltiesRole.jsx`, `RequireVotingObserverRole.jsx` para delegar en `RequireAnyRole`.
   - Crear `client/src/auth/role-routes.js` con el mapeo canónico de roles a rutas principales (`ADMIN` → `#/admin/competencia`, `JUDGE` → `#/judge`, `VEEDOR` → `#/veedor`, `COMISARIO` → `#/comisario/penalties`, `SCRUTINEER`/`ESCRIBANO` → `#/scrutineer/results`).

4. **Diccionario i18n de Errores (RF-180):**
   - Crear `client/src/i18n/errors.js` y `errors.test.js`.
   - Registrar los códigos de error del backend (autenticación, 2FA, planilla, votación, penalizaciones, actas, límites HTTP, concurrencia).
   - Función helper `formatErrorMessage(error)`.

5. **PWA y Accesibilidad Global (RF-181):**
   - Generar iconos SVG y PNG en `client/public/icons/`.
   - Actualizar `client/public/manifest.webmanifest`.
   - Actualizar `client/index.html` con `<meta name="theme-color" content="#090D16" />`, skip-link `#main-content`, y precarga de fuentes.
   - Actualizar `App.jsx` para integrar el skip-link y el contenedor principal con soporte `data-layer`.

6. **Verificación y Pruebas:**
   - Tests unitarios de todos los componentes nuevos.
   - Ejecución de los 138 tests existentes del cliente.
   - Build de producción con `npm run build`.
