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

## T07 — Consolidacion CSS, tarea 1.1 aprobada (RF-176, RF-177)

- [x] Centralizar las 15 variables heredadas en `tokens.css`, preservando valores y precedencia sin cambios funcionales.
- [x] Agregar y ejecutar regresion especifica, suite cliente y build.
- [x] Comprobar equivalencia visual proporcional y registrar evidencia y limitaciones en `validation.md` (login en tres viewports; no equivale a validar visualmente todo el sitio).

Las tareas 1.2 en adelante del plan de consolidacion quedan fuera de esta unidad atomica.

## T08 — Consolidacion CSS, tarea 1.2 aprobada (RF-176)

- [x] Definir seis tokens justificados por usos actuales, sin redefinir valores existentes ni migrar consumidores.
- [x] Verificar disponibilidad global, valores exactos y unicidad mediante pruebas, conservando regresiones T07.
- [x] Ejecutar suite cliente, build y detector; revisar diff y registrar alcance y limites en `validation.md`.

La tarea 1.3 y la migracion de consumidores quedan fuera de esta unidad atomica.

## T09 — Consolidacion CSS, tarea 1.3 aprobada (RF-176)

- [x] Migrar fondo y borde de campos de login/OTP a los tokens existentes, sin cambios de valores ni comportamiento.
- [x] Agregar y ejecutar regresiones de adopcion de tokens y las pruebas de login/redirecciones.
- [x] Comparar capturas y estilos calculados antes/despues en tres viewports; ejecutar suite cliente, build y detector, revisar diff y registrar evidencia.

No incluye migracion de los demas consumidores ni correccion de hallazgos visuales preexistentes.

### Pendientes encontrados al validar T09

- [x] Corregir el recorte de la tarjeta OTP en 390x844 en una unidad visual separada, con regresion responsive (resuelto en T12).
- [x] Agregar nombres accesibles individuales a los seis campos OTP en una unidad de accesibilidad separada, preservando pegado, autocompletado y navegacion (resuelto en T12).

## T10 — Consolidacion CSS, tarea 1.4 aprobada (RF-176)

- [x] Migrar fondo de campos generales y de penalizaciones a `--surface-input` en `index.css`.
- [x] Agregar regresiones en `tokens.test.js` para asegurar la adopcion de `--surface-input` en los tres selectores.
- [x] Ejecutar suite completa, build, verificar diff y registrar evidencia en `validation.md`.

## T11 — Consolidacion CSS, tarea 1.5 aprobada (RF-176)

- [x] Migrar `--text-on-primary` (#082b61) en botones primarios heredados en `index.css`.
- [x] Migrar `--surface-hover-subtle` (rgba(148, 163, 184, 0.1)) en hovers de navegación en `index.css`.
- [x] Migrar `--text-on-accent` (#ffffff) en acciones sólidas en `styles/components.css`.
- [x] Agregar regresiones en `tokens.test.js` para los tres grupos de tokens.
- [x] Ejecutar suite completa, build, verificar diff y registrar evidencia en `validation.md`.

## T12 — Consolidacion CSS, tarea 1.6 aprobada (RF-176, RF-181)

- [x] Agregar `aria-label` individual (`Dígito X de 6`) a los seis inputs OTP en `LoginPage.jsx`.
- [x] Ajustar escalas responsivas `clamp()` en `.login-card`, su formulario y `.otp-input-group` en `index.css` para evitar desborde en 390x844.
- [x] Agregar pruebas de accesibilidad en `LoginPage.test.jsx` y prueba estructural en `tokens.test.js`.
- [x] Ejecutar suite completa, build, verificar diff y registrar evidencia en `validation.md`.

## T13 — Consolidacion CSS, tarea 1.7 aprobada (RF-176, RF-177)

- [x] Incorporar `data-layer="instrument"` en `AdminCompetenciaPage.jsx`, `AdminJudgesPage.jsx` y `AdminAssignmentsPage.jsx`.
- [x] Migrar `.config-card, .record, .rubric-card` y `.operational-user` a `var(--surface-card)` y bordes semánticos en `index.css`.
- [x] Migrar `.matrix-table`, `.matrix-detail` y `.matrix-detail-item` a tokens semánticos en `index.css`.
- [x] Migrar badges de padrón y estados (`.roster-count`, `.status-invited`, `.status-registered`, `.status-suspended`, `.status-active`, `.status-inactive`) a tokens semánticos en `index.css`.
- [x] Migrar tipografía y bordes en `.event-header` y `.section-heading h2` a tokens semánticos en `index.css`.
- [x] Agregar pruebas de regresión en `AdminCompetenciaPage.test.jsx` y `tokens.test.js`.
- [x] Ejecutar suite completa, build, verificar diff y registrar evidencia en `validation.md`.

## T14 — Consolidacion CSS, tarea 1.8 aprobada (RF-176, RF-177)

- [x] Incorporar `data-layer="instrument"` en `AdminEventsPage.jsx`, `EventConfigurationPage.jsx` y `AdminVotingPage.jsx`.
- [x] Migrar `.voting-summary strong`, `.pending-dialog-content h2` y `.pending-dialog-list li` a tokens semánticos en `index.css`.
- [x] Migrar `.readiness-ok`, `.readiness-pending`, `.readiness-checklist`, `.readiness-fail` y `.readiness-ok-item` a tokens semánticos en `index.css`.
- [x] Migrar `.operations-summary`, `.operations-summary-list article`, `.user-admin` y sus elementos a tokens semánticos en `index.css`.
- [x] Agregar pruebas de regresión en `AdminEventsPage.test.jsx`, `AdminVotingPage.test.jsx`, `EventConfigurationPage.test.jsx` y `tokens.test.js`.
- [x] Ejecutar suite completa, build, verificar diff y registrar evidencia en `validation.md`.

## T15 — Modularización CSS: Ceremonia y Penalizaciones, tarea 1.9 aprobada (RF-176)

- [x] Crear `client/src/styles/ceremony.css` con las reglas de Spec 011 (sorteo ceremonial y resultados) y responsividad en 36rem.
- [x] Crear `client/src/styles/penalties.css` con las reglas de Spec 014 (comisariato y penalizaciones) y responsividad en 48rem y 36rem.
- [x] Incorporar `@import "./styles/ceremony.css";` y `@import "./styles/penalties.css";` en `client/src/index.css` y remover bloque extraído.
- [x] Actualizar `client/src/tests/tokens.test.js` para validar imports, ausencia de `:root` y adopción de tokens en `penalties.css`.
- [x] Ejecutar suite completa (`npm test`), build (`npm run build`), verificar diff y registrar evidencia en `validation.md`.

## T16 — Modularización CSS: Actas Notariales y Escrutinio, tarea 1.10 aprobada (RF-176)

- [x] Crear `client/src/styles/scrutiny.css` con las reglas de Spec 015 (Actas Oficiales, documento notarial, sellado, firmas y `@media print`).
- [x] Incorporar `@import "./styles/scrutiny.css";` en `client/src/index.css` tras `penalties.css` y remover bloque extraído.
- [x] Actualizar `client/src/tests/tokens.test.js` para validar el nuevo import y la ausencia de `:root` en `scrutiny.css`.
- [x] Ejecutar suite completa (`npm test`), suite de `OfficialRecordPage.test.jsx`, build (`npm run build`), verificar diff y registrar evidencia en `validation.md`.

## T17 — Modularización CSS: Administración y Mesa de Control, tarea 1.11 aprobada (RF-176)

- [x] Crear `client/src/styles/admin.css` con las reglas de administración, shell, configuración, padrón, asignaciones, mesa de control, diálogos y contenedores responsivos.
- [x] Incorporar `@import "./styles/admin.css";` en `client/src/index.css` tras `scrutiny.css` y remover bloques extraídos.
- [x] Actualizar `client/src/tests/tokens.test.js` para validar el nuevo import, ausencia de `:root` en `admin.css` y adopción de tokens en `admin.css`.
- [x] Ejecutar suite completa (`npm test`), suites de administración (`AdminEventsPage`, `EventConfigurationPage`, `AdminCompetenciaPage`, `AdminJudgesPage`, `AdminAssignmentsPage`, `AdminVotingPage`), build (`npm run build`), verificar diff y registrar evidencia en `validation.md`.

## T18 — Modularización CSS: Competencia y Configuración de Reglas, tarea 1.12 aprobada (RF-176)

- [x] Crear `client/src/styles/competencia.css` con las reglas de Spec 017 (navegación de tabs, overview de competencia, preparación de evento, rubros, subrecords, items, criterios, matriz de evaluación y adaptaciones responsivas móviles).
- [x] Incorporar `@import "./styles/competencia.css";` en `client/src/index.css` tras `admin.css` y remover bloque extraído.
- [x] Actualizar `client/src/tests/tokens.test.js` para validar el nuevo import, ausencia de `:root` en `competencia.css` y adopción de tokens en `competencia.css`.
- [x] Ejecutar suite completa (`npm test`), suite de `AdminCompetenciaPage.test.jsx`, build (`npm run build`), verificar diff y registrar evidencia en `validation.md`.
