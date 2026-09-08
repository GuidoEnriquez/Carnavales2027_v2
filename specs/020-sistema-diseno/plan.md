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

## Mantenimiento aprobado: tarea 1.1 de consolidacion CSS (2026-09-08)

1. Trasladar las 15 declaraciones del bloque `:root` oscuro de `index.css` al final de `tokens.css`, sin cambiar valores ni los imports tokens/componentes.
2. Mantener los alias existentes y las reglas de capa y accesibilidad. No sustituir tonos por aproximaciones ni introducir dependencias.
3. Agregar regresion del bloque y su ubicacion; comprobar equivalencia visual antes/despues en 390x844, 768x1024 y 1440x900 cuando el navegador disponible lo permita.
4. Ejecutar tests especificos, suite cliente y build; registrar limitaciones reales. Lint/typecheck no tienen scripts en el cliente; migraciones y suites de API/BD no corresponden a esta unidad exclusivamente CSS.
5. Detenerse tras validar esta unidad (T07); el resto de la fase permanece pendiente.

## Mantenimiento aprobado: tarea 1.2 de consolidacion CSS (2026-09-08)

1. Definir en el primer `:root` de `tokens.css` los seis tokens documentados en clarificacion 7, junto a sus grupos de superficie, texto y borde. Conservar sin cambios el bloque heredado final de T07 y las capas/media queries.
2. Agregar pruebas parametrizadas de disponibilidad global, valor exacto y declaracion unica de cada token; mantener las regresiones previas de T07.
3. Ejecutar test especifico, suite cliente, build y detector sobre `tokens.css`; revisar el diff y confirmar ausencia de referencias operativas a los nombres nuevos. Al no migrar consumidores ni cambiar valores existentes, no corresponde una nueva validacion visual de pantallas en esta unidad.
4. Registrar evidencia como T08 y detenerse. La tarea 1.3 migrara un grupo acotado de consumidores con comprobacion visual; no ejecutar reemplazos masivos en T08.

## Mantenimiento aprobado: tarea 1.3 de consolidacion CSS (2026-09-08)

1. Capturar una linea base de login y OTP en Firefox a 390x844, 768x1024 y 1440x900, con datos sinteticos y autenticacion simulada, sin solicitudes a la API real.
2. Reemplazar solo cuatro valores (fondo/borde en dos selectores) por los tokens de T08. Agregar regresion de adopcion de ambos tokens en los dos selectores.
3. Comparar capturas y estilos calculados de los campos antes/despues, incluyendo normal, foco y disabled. Mantener el layout, opacidades y focus rings existentes.
4. Ejecutar pruebas de tokens/login/redirecciones, suite cliente, build, detector y revision del diff. Registrar evidencia y hallazgos previos como T09; no declarar un rediseño ni una auditoria WCAG completa.
5. Detenerse tras esta unidad. Campos generales, navegacion, botones, wallboard e impresion siguen pendientes.

## Mantenimiento aprobado: tarea 1.4 de consolidacion CSS (2026-09-08)

1. Sustituir `#0d1523` por `var(--surface-input)` exclusivamente en las tres reglas de campos de formulario en `client/src/index.css`: campos base `input, select, textarea`, campos de penalizaciones `.penalty-form input, .penalty-form select, .penalty-form textarea`, y textarea de revocacion `.penalty-modal textarea`.
2. Preservar intactas las superficies de paneles, listas, filas de resultados y tarjetas que compartan `#0d1523`.
3. Agregar regresiones en `client/src/tests/tokens.test.js` que verifiquen la adopcion de `--surface-input` en las tres reglas y prohiban `#0d1523` en las mismas.
4. Ejecutar suite de pruebas de cliente (`npm test`), build de produccion (`npm run build`) y verificacion de diff (`git diff --check`).
5. Registrar evidencia como T10 en `validation.md` y marcar tareas en `tasks.md`. Detenerse tras completar la unidad.

## Mantenimiento aprobado: tarea 1.5 de consolidacion CSS (2026-09-08)

1. Sustituir `#082b61` por `var(--text-on-primary)` en `button, .button-link`, `.score-grid button:hover:not(:disabled)` y `.assignment-confirm-btn-icon` en `client/src/index.css`.
2. Sustituir `rgba(148, 163, 184, 0.1)` por `var(--surface-hover-subtle)` en `.app-navigation nav a:hover` y `.competencia-nav button:hover:not(:disabled)` en `client/src/index.css`.
3. Sustituir `#ffffff` por `var(--text-on-accent)` en `.app-button-primary`, `.app-button-danger`, `.score-option-btn.is-staged` y su `.score-anchor-text` en `client/src/styles/components.css`.
4. Agregar pruebas de regresión en `client/src/tests/tokens.test.js` para los tres grupos.
5. Ejecutar suite de pruebas de cliente (`npm test`), build (`npm run build`) y verificar diff (`git diff --check`).
6. Registrar evidencia como T11 en `validation.md` y marcar tareas en `tasks.md`. Detenerse tras completar la unidad.

## Mantenimiento aprobado: tarea 1.6 de consolidacion CSS (2026-09-08)

1. Agregar atributos `aria-label={`Dígito ${i + 1} de 6`}` a los seis inputs en `client/src/pages/LoginPage.jsx`.
2. Actualizar paddings de `.login-card` y su formulario en `client/src/index.css` con escalas `clamp()`.
3. Actualizar ancho y espaciado de `.otp-input-group` e inputs en `client/src/index.css` con escalas `clamp()` y `max-inline-size: 100%`.
4. Agregar pruebas de accesibilidad unitaria en `client/src/tests/LoginPage.test.jsx` y prueba estructural responsiva en `client/src/tests/tokens.test.js`.
5. Ejecutar suite de pruebas de cliente (`npm test`), build (`npm run build`) y verificar diff (`git diff --check`).
6. Registrar evidencia como T12 en `validation.md` y marcar tareas en `tasks.md`. Detenerse tras completar la unidad.

## Mantenimiento aprobado: tarea 1.7 de consolidación CSS (2026-09-08)

1. Declarar `data-layer="instrument"` en los contenedores `<main className="admin-shell ...">` de `client/src/pages/AdminCompetenciaPage.jsx`, `client/src/pages/AdminJudgesPage.jsx` y `client/src/pages/AdminAssignmentsPage.jsx`.
2. Actualizar las reglas de administración en `client/src/index.css`:
   - `.config-card, .record, .rubric-card`: `background: var(--surface-card); border: 1px solid var(--border-subtle);`
   - `.operational-user`: `background: var(--surface-card); border-inline-start: 4px solid var(--accent-primary);`
   - `.matrix-table th`: `background: var(--surface-raised); border: 1px solid var(--border-subtle);`
   - `.matrix-table td`: `border: 1px solid var(--border-subtle);`
   - `.matrix-yes`: `color: var(--success-text);`
   - `.matrix-no`: `color: var(--text-muted);`
   - `.status-active`: `color: var(--success-text);`
   - `.status-inactive`: `color: var(--danger-text);`
   - `.matrix-rubric-btn:hover:not(:disabled)`: `background: var(--surface-hover-subtle);`
   - `.matrix-detail`: `background: var(--surface-card); border: 1px solid var(--border-subtle);`
   - `.matrix-detail-item`: `background: var(--surface-raised); border: 1px solid var(--border-subtle);`
   - `.matrix-detail-item strong`: `color: var(--text-primary);`
   - `.roster-count`: `color: var(--text-primary); background: var(--surface-raised); border: 1px solid var(--border-subtle);`
   - `.invitation-link`: `background: var(--surface-raised); border-inline-start: 4px solid var(--warning);`
   - `.invitation-link code`: `color: var(--text-primary);`
   - `.status-invited`: `color: var(--warning-text); background: var(--warning-bg); border: 1px solid var(--warning-border);`
   - `.status-registered`: `color: var(--success-text); background: var(--success-bg); border: 1px solid var(--success-border);`
   - `.status-suspended`: `color: var(--danger-text); background: var(--danger-bg); border: 1px solid var(--danger-border);`
   - `.event-header`: `border-block-end: 4px solid var(--accent-primary);`
   - `.event-header h1`, `.section-heading h2`: `font-family: var(--font-display, var(--font-sans));`
3. Agregar pruebas automatizadas en `client/src/tests/AdminCompetenciaPage.test.jsx` (verificación de `data-layer="instrument"`) y `client/src/tests/tokens.test.js` (verificación de adopción de tokens semánticos en cards, tablas y badges de administración).
4. Ejecutar suite de pruebas de cliente (`npm test`), build (`npm run build`) y verificación de diff (`git diff --check`).
5. Registrar evidencia como T13 en `validation.md` y marcar tareas en `tasks.md`. Detenerse tras completar la unidad.

## Mantenimiento aprobado: tarea 1.8 de consolidación CSS (2026-09-08)

1. Declarar `data-layer="instrument"` en los contenedores `<main ...>` de `client/src/pages/AdminEventsPage.jsx`, `client/src/pages/EventConfigurationPage.jsx` y `client/src/pages/AdminVotingPage.jsx`.
2. Actualizar las reglas de submódulos administrativos en `client/src/index.css`:
   - `.voting-summary strong`: `color: var(--accent-primary); font-family: var(--font-display, var(--font-sans));`
   - `.pending-dialog-content h2`: `font-family: var(--font-display, var(--font-sans));`
   - `.pending-dialog-list li`: `background: var(--surface-raised); border-inline-start: 3px solid var(--warning);`
   - `.readiness-ok`: `color: var(--success-text);`
   - `.readiness-pending`: `color: var(--warning-text);`
   - `.readiness-checklist li`: `border: 1px solid var(--border-subtle);`
   - `.readiness-fail`: `border-inline-start: 3px solid var(--danger);` y su `.readiness-icon` con `color: var(--danger-text);`
   - `.readiness-ok-item`: `border-inline-start: 3px solid var(--success); color: var(--success-text);` y su `.readiness-icon` con `color: var(--success-text);`
   - `.operations-summary`: `border: 1px solid var(--border-subtle); background: var(--surface-card);`
   - `.operations-summary-list article`: `border-inline-start: 4px solid var(--accent-primary);`
   - `.user-admin`: `border-block-start: 1px solid var(--border-subtle);`
   - `.user-admin li`: `border: 1px solid var(--border-subtle); background: var(--surface-card);`
3. Agregar pruebas automatizadas en `client/src/tests/AdminEventsPage.test.jsx`, `client/src/tests/AdminVotingPage.test.jsx` y `client/src/tests/tokens.test.js`.
4. Ejecutar suite de pruebas de cliente (`npm test`), build (`npm run build`) y verificación de diff (`git diff --check`).
5. Registrar evidencia como T14 en `validation.md` y marcar tareas en `tasks.md`. Detenerse tras completar la unidad.

## Mantenimiento aprobado: tarea 1.9 de modularización CSS - Ceremonia y Penalizaciones (2026-09-08)

1. Crear `client/src/styles/ceremony.css` conteniendo las reglas de Spec 011 (sorteo ceremonial y resultados) y su media query móvil de 36rem.
2. Crear `client/src/styles/penalties.css` conteniendo las reglas de Spec 014 (comisariato y penalizaciones) y sus media queries móviles de 48rem y 36rem.
3. Actualizar `client/src/index.css`:
   - Declarar `@import "./styles/ceremony.css";` y `@import "./styles/penalties.css";` inmediatamente tras `@import "./styles/components.css";`.
   - Eliminar el bloque histórico de líneas 1300 a 1713 ahora externalizado en los módulos.
4. Actualizar `client/src/tests/tokens.test.js`:
   - Validar que `index.css` importe `ceremony.css` y `penalties.css`.
   - Verificar que ni `ceremony.css` ni `penalties.css` declaren bloques `:root`.
   - Adaptar las pruebas de adopción de `--surface-input` en `.penalty-form` y `.penalty-modal` apuntando al módulo `penalties.css`.
5. Ejecutar suite de pruebas de cliente (`npm test`), build (`npm run build`) y verificación de diff (`git diff --check`).
6. Registrar evidencia como T15 en `validation.md` y marcar tareas en `tasks.md`. Detenerse tras completar la unidad.

## Mantenimiento aprobado: tarea 1.10 de modularización CSS - Actas Notariales y Escrutinio (2026-09-08)

1. Crear `client/src/styles/scrutiny.css` conteniendo las reglas de Spec 015 (Actas Oficiales, documento notarial, sellado, firmas y `@media print`).
2. Actualizar `client/src/index.css`:
   - Declarar `@import "./styles/scrutiny.css";` inmediatamente tras `@import "./styles/penalties.css";`.
   - Eliminar el bloque histórico de líneas 1739 a 2087 ahora externalizado en `scrutiny.css`.
3. Actualizar `client/src/tests/tokens.test.js`:
   - Validar que `index.css` importe `scrutiny.css` en la secuencia requerida.
   - Verificar que `scrutiny.css` no declare bloques `:root`.
4. Ejecutar suite de pruebas de cliente (`npm test`), suite de `OfficialRecordPage.test.jsx`, build (`npm run build`) y verificación de diff (`git diff --check`).
5. Registrar evidencia como T16 en `validation.md` y marcar tareas en `tasks.md`. Detenerse tras completar la unidad.

## Mantenimiento aprobado: tarea 1.11 de modularización CSS - Administración y Mesa de Control (2026-09-08)

1. Crear `client/src/styles/admin.css` conteniendo las reglas de administración, shell, configuración, padrón, asignaciones, mesa de control y diálogos de votación.
2. Actualizar `client/src/index.css`:
   - Declarar `@import "./styles/admin.css";` inmediatamente tras `@import "./styles/scrutiny.css";`.
   - Eliminar los bloques históricos desacoplados ahora externalizados en `admin.css`.
3. Actualizar `client/src/tests/tokens.test.js`:
   - Validar que `index.css` importe `admin.css` en la secuencia requerida.
   - Verificar que `admin.css` no declare bloques `:root`.
   - Apuntar las validaciones de adopción de tokens en componentes administrativos hacia `admin.css`.
4. Ejecutar suite de pruebas de cliente (`npm test`), build (`npm run build`) y verificación de diff (`git diff --check`).
5. Registrar evidencia como T17 en `validation.md` y marcar tareas en `tasks.md`. Detenerse tras completar la unidad.

## Mantenimiento aprobado: tarea 1.12 de modularización CSS - Competencia y Configuración de Reglas (2026-09-08)

1. Crear `client/src/styles/competencia.css` conteniendo las reglas de Spec 017 (navegación de tabs, overview de competencia, preparación de evento, rubros, subrecords, items, criterios, matriz de evaluación y adaptaciones responsivas móviles).
2. Actualizar `client/src/index.css`:
   - Declarar `@import "./styles/competencia.css";` inmediatamente tras `@import "./styles/admin.css";`.
   - Eliminar el bloque histórico de Spec 017 ahora externalizado en `competencia.css`.
3. Actualizar `client/src/tests/tokens.test.js`:
   - Validar que `index.css` importe `competencia.css` en la secuencia requerida.
   - Verificar que `competencia.css` no declare bloques `:root`.
   - Apuntar las validaciones de adopción de tokens en componentes de competencia hacia `competencia.css`.
4. Ejecutar suite de pruebas de cliente (`npm test`), suite de `AdminCompetenciaPage.test.jsx`, build (`npm run build`) y verificación de diff (`git diff --check`).
5. Registrar evidencia como T18 en `validation.md` y marcar tareas en `tasks.md`. Detenerse tras completar la unidad.
