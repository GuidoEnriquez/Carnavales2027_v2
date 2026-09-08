# Tareas — Spec 020: Fundación del Sistema de Diseño

## T01 — Sistema de tokens semánticos y capas visuales (RF-176, RF-177)

- [x] Crear directorio `client/src/styles/` si no existe.
- [x] Crear `client/src/styles/tokens.css` con variables de color, tipografía, espaciado, radios, z-index y target táctil.
- [x] Implementar variables de capa `[data-layer="brand"]` y `[data-layer="instrument"]`.
- [x] Incluir reglas para `prefers-reduced-motion` y `prefers-contrast`.
- [x] Vincular `tokens.css` en `client/src/main.jsx` o cabecera de `index.css`.
- [x] Mapear variables antiguas (`--bg-color`, `--text-color`, `--card-bg`, etc.) hacia los nuevos tokens semánticos.
- [x] Crear prueba automatizada o de snapshot que valide la disponibilidad de tokens y compatibilidad visual.

## T02 — Componentes compartidos atómicos (RF-178)

- [x] Implementar `<Dialog>` en `client/src/components/Dialog.jsx` (modal nativo con focus trap, focus return, cierre por ESC y click en backdrop).
- [x] Implementar `<Button>` en `client/src/components/Button.jsx` (variantes, estado `busy` accesible, altura mínima 48px).
- [x] Implementar `<StatusPill>` en `client/src/components/StatusPill.jsx` (estados operativos con alto contraste).
- [x] Implementar `<ProgressBar>` en `client/src/components/ProgressBar.jsx` (roles ARIA, etiquetas accesibles).
- [x] Implementar `<Toast>` en `client/src/components/Toast.jsx` (`role="status"`, `aria-live="polite"`).
- [x] Crear pruebas unitarias completas para `<Dialog>`, `<Button>`, `<StatusPill>`, `<ProgressBar>` y `<Toast>`.

## T03 — Consolidación de guardas y rutas por rol (RF-179)

- [x] Crear `client/src/auth/RequireAnyRole.jsx`.
- [x] Refactorizar `RequireAdmin.jsx`, `RequireRole.jsx`, `RequireResultsRole.jsx`, `RequirePenaltiesRole.jsx` y `RequireVotingObserverRole.jsx` para reutilizar `RequireAnyRole`.
- [x] Crear `client/src/auth/role-routes.js` con el mapa único rol → ruta.
- [x] Crear prueba unitaria para `RequireAnyRole.jsx` y verificar que las suites existentes de guardas sigan pasando.

## T04 — Diccionario centralizado de errores i18n (RF-180)

- [x] Crear `client/src/i18n/errors.js` con el mapa exhaustivo de códigos y la función `formatErrorMessage()`.
- [x] Crear prueba unitaria `client/src/i18n/errors.test.js` verificando traducciones de códigos conocidos y fallbacks seguros.

## T05 — Configuración PWA y accesibilidad global (RF-181)

- [x] Generar iconos SVG y PNG en `client/public/icons/`.
- [x] Actualizar `client/public/manifest.webmanifest` con la colección de `"icons"`, `theme_color: "#090D16"`, `background_color: "#090D16"`.
- [x] Actualizar `client/index.html` con `<meta name="theme-color" content="#090D16" />`, skip-link `#main-content`, y precarga tipográfica.
- [x] Integrar skip-link y `data-layer` en `client/src/App.jsx`.
- [x] Crear prueba que verifique la presencia del skip-link y la estructura del manifiesto PWA.

## T06 — Validación integral y reporte

- [x] Ejecutar suite completa de tests de cliente (`npm test` en `client/`).
- [x] Ejecutar build de producción del cliente (`npm run build` en `client/`).
- [x] Ejecutar suites de API y BD (`npm test` y `npm run db:test` en `api/`) para asegurar cero regresiones globales.
- [x] Documentar evidencias en `specs/020-sistema-diseno/validation.md`.
- [x] Actualizar `docs/sdd-status.md` y `docs/source-map.md`.
