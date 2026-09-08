# Clarificaciones — Spec 020

## Preguntas y Decisiones de Arquitectura

### 1. ¿Cómo coexisten los nuevos tokens con los estilos existentes de `index.css`?
**Decisión:**
Se creará `client/src/styles/tokens.css` conteniendo las variables semánticas. Para evitar regresiones en las 20+ páginas ya desarrolladas y probadas, las variables antiguas (ej. `--primary-color`, `--bg-color`, `--text-color`) se mapearán como alias hacia los nuevos tokens semánticos (ej. `--bg-color: var(--surface-base)`), garantizando que todo el código existente herede automáticamente la paleta oscura de alto contraste sin romper clases existentes.

### 2. ¿Cómo se implementa `data-layer` en el frontend?
**Decisión:**
El shell de la aplicación (`App.jsx` o layout de página) expondrá un atributo `data-layer="brand"` o `data-layer="instrument"` en el contenedor principal o `<div id="root">`.
- Por defecto, las pantallas operativas (`JudgeBallotPage`, `AdminCompetenciaPage`, `AdminUsersPage`, `AdminEventsPage`, `VeedorMonitorPage`, `ComisarioPenaltiesPage`, `AdminResultsPage`, `OfficialRecordPage`) usarán `instrument`.
- Las pantallas públicas y de bienvenida (`HomePage`, `LoginPage`, `AcceptJudgeInvitationPage`, `AcceptRoleInvitationPage`) usarán `brand`.

### 3. ¿Cómo se unifica `<RequireAnyRole>` preservando los tests existentes?
**Decisión:**
`RequireAnyRole` será el componente núcleo:
```jsx
export function RequireAnyRole({ allowedRoles, children }) { ... }
```
Los componentes existentes `RequireAdmin`, `RequireRole`, `RequireResultsRole`, `RequirePenaltiesRole` y `RequireVotingObserverRole` se reescribirán como wrappers transparentes delegando en `RequireAnyRole`. Por ejemplo:
```jsx
export function RequireAdmin({ children }) {
  return <RequireAnyRole allowedRoles={["ADMIN"]}>{children}</RequireAnyRole>;
}
```
Esto preserva 100% la interfaz y las aserciones de los tests existentes (`RequireAdmin.test.jsx`, `RequireRole.test.jsx`, etc.) eliminando la duplicación.

### 4. ¿Qué formato de iconos se usará para el PWA?
**Decisión:**
Se incluirán iconos SVG vectoriales y PNGs generados en `client/public/icons/` referenciados en `manifest.webmanifest` con `purpose: "any maskable"`, resolviendo la advertencia de PWA instalable de Lighthouse y navegadores móviles.

### 5. ¿Cómo se estructura `i18n/errors.js`?
**Decisión:**
Un mapa exhaustivo `ERROR_MESSAGES[code]` con fallback amigable para códigos desconocidos o errores de red (`NETWORK_ERROR`), acompañado de una función helper `getErrorMessage(error)` que extraiga código de error, propiedad `message` o excepciones genéricas.

### 6. Consolidacion CSS aprobada por el usuario (2026-09-08)

La tarea 1.1 del plan aprobado se ejecuta como mantenimiento de RF-176/RF-177, sin ampliar capacidades. Se conserva CSS global. El bloque oscuro heredado de Spec 009 en `index.css` no es equivalente a los alias iniciales de `tokens.css`: se traslada intacto al final de este ultimo archivo para conservar valores y precedencia, incluso frente a las preferencias de accesibilidad. Las capas en elementos descendientes mantienen sus acentos actuales.

No se redefine `--text-inverse` (actualmente `#0f172a`) como blanco ni se equiparan colores distintos. La tokenizacion adicional, reorganizacion de reglas y cambios visuales quedan para unidades posteriores. Las discrepancias historicas sobre portal publico y confirmacion de votos no se resuelven mediante este refactor.

### 7. Tokens faltantes, tarea 1.2 aprobada (2026-09-08)

Se define un primer conjunto acotado bajo RF-176, sin migrar consumidores ni modificar tokens existentes. Cada valor coincide exactamente con estilos actuales; no implica una nueva paleta ni certificacion de contraste.

| Token nuevo | Valor | Uso previsto y evidencia actual |
|---|---|---|
| `--surface-input` | `#0d1523` | Campos generales `input, select, textarea`, campos de penalizaciones y textarea de revocacion en `index.css`; no aplicar automaticamente a paneles con el mismo color |
| `--surface-login-input` | `#304258` | Usuario, password y OTP: `.login-card input`, `.otp-input-group input` en `index.css` |
| `--border-input` | `rgba(148, 163, 184, 0.34)` | Borde de usuario, password y OTP en los mismos selectores; no sustituye bordes con otra opacidad |
| `--surface-hover-subtle` | `rgba(148, 163, 184, 0.1)` | Hover neutral de enlaces de navegacion y botones de competencia; no equivale al estado activo de opacidad 0.12 |
| `--text-on-primary` | `#082b61` | Texto e iconos de botones primarios heredados: `button, .button-link`, `.score-grid button:hover`, `.assignment-confirm-btn-icon` |
| `--text-on-accent` | `#ffffff` | Texto sobre acciones solidas: `.app-button-primary`, `.app-button-danger`, `.score-option-btn.is-staged` en `components.css`; no usar para fondos de impresion ni redefinir `--text-inverse` |

Los valores ya coincidentes con `--text-primary`, `--text-secondary`, `--text-muted` y `--surface-card` reutilizaran esos tokens al migrar usos. No se agregan alias duplicados ni tokens de wallboard, impresion o estados semanticos adicionales en esta unidad. Los tokens nuevos no tienen referencias operativas aun; su adopcion y contraste por contexto se verificaran al migrarlos.

### 8. Primeros consumidores, tarea 1.3 aprobada (2026-09-08)

La primera migracion se limita al fondo y borde de `.login-card input` y `.otp-input-group input`: `#304258` se reemplaza por `var(--surface-login-input)` y el color del borde de 2px por `var(--border-input)`. La notacion `.34` y `0.34` expresa la misma opacidad. No se cambian anchos, padding, selectores, especificidad, orden, foco, disabled, textos ni logica de autenticacion. Los otros cuatro tokens de T08 permanecen sin consumidores nuevos.

Se compara login y OTP con respuestas de autenticacion simuladas en un navegador aislado, sin API real ni entrega de correos. Los defectos preexistentes encontrados en esa comparacion se registran como pendientes, no se corrigen como parte de este refactor sin cambios visuales.

### 9. Campos generales y penalizaciones, tarea 1.4 aprobada (2026-09-08)

La adopcion de `--surface-input` (`#0d1523`) se limita estrictamente a los campos de formulario:
- `input, select, textarea` (campos base de formulario en `client/src/index.css`)
- `.penalty-form input, .penalty-form select, .penalty-form textarea` (formulario de comisariato)
- `.penalty-modal textarea` (textarea del modal de revocacion de penalizaciones)

No se aplica a paneles, filas ni cajas que compartan `#0d1523` (como `.sync-panel`, `.tie-breaker-pool li`, `.results-row`, `.penalties-row`, `.penalty-summary-box` o `.assignment-confirm-field`), ya que corresponden a superficies de contenedor y no a campos de entrada de datos. No se alteran dimensiones, bordes, foco, disabled ni comportamiento reactivo o de API.

### 10. Acciones, texto y hovers, tarea 1.5 aprobada (2026-09-08)

Se migran a tokens semánticos de T08 los siguientes tres grupos de interacción:
1. `--text-on-primary` (`#082b61`): texto e iconos sobre botones primarios heredados en `index.css` (`button, .button-link`, `.score-grid button:hover:not(:disabled)` y `.assignment-confirm-btn-icon`).
2. `--surface-hover-subtle` (`rgba(148, 163, 184, 0.1)`): hover neutral sin estado activo en `.app-navigation nav a:hover` y `.competencia-nav button:hover:not(:disabled)` en `index.css`.
3. `--text-on-accent` (`#ffffff`): texto sobre acciones sólidas de acento en `styles/components.css` (`.app-button-primary`, `.app-button-danger` y `.score-option-btn.is-staged`). No se altera `--text-inverse` (#0f172a) ni los textos de impresión.

### 11. Subsanación responsive y accesibilidad de OTP, tarea 1.6 aprobada (2026-09-08)

Se resuelven los dos hallazgos preexistentes identificados durante la validación de T09:
1. **Accesibilidad unitaria de OTP:** Se asigna un atributo `aria-label={`Dígito ${i + 1} de 6`}` a cada uno de los 6 inputs dentro de `.otp-input-group`, garantizando nombres accesibles independientes para tecnologías de asistencia sin romper el pegado, el autocompletado del sistema ni la navegación con teclado.
2. **Dimensionamiento responsivo de tarjeta OTP:** Se ajustan los paddings de `.login-card` (`clamp(1.25rem, 5vw, 4rem)`) y su formulario (`clamp(0.75rem, 3vw, 2rem)`), junto al ancho y espaciado de `.otp-input-group` (`width: clamp(2.25rem, 8.5vw, 2.75rem)`, `gap: clamp(0.25rem, 1.5vw, 0.5rem)`), permitiendo que la tarjeta se ajuste sin desbordar el viewport de 390px, eliminando el recorte lateral y manteniendo las dimensiones completas en tablet (768px) y desktop (1440px).

### 12. Capa Instrumento y Tokens Semánticos en Dashboard de Administración, tarea 1.7 (2026-09-08)

Conforme a RF-176 y RF-177, los paneles operativos de administración (`AdminCompetenciaPage`, `AdminJudgesPage`, `AdminAssignmentsPage`) deben operar bajo la capa `data-layer="instrument"`, eliminando fondos claros heredados (`#fbfcff`, `#fff8e7`, `#dce8ff`) y colores fijos no tokenizados en favor de los tokens semánticos del sistema:
1. **Atributo de Capa:** Se declara `data-layer="instrument"` de forma explícita en los contenedores `<main className="admin-shell ...">` de `AdminCompetenciaPage.jsx`, `AdminJudgesPage.jsx` y `AdminAssignmentsPage.jsx`.
2. **Superficies y Tarjetas Administrativas:**
   - `.config-card, .record, .rubric-card`: sustitución de `background: #fbfcff;` por `background: var(--surface-card); border: 1px solid var(--border-subtle);`.
   - `.operational-user`: sustitución de `background: #fbfcff;` por `background: var(--surface-card); border-inline-start: 4px solid var(--accent-primary);`.
   - `.matrix-detail`: uso de `background: var(--surface-card); border: 1px solid var(--border-subtle);`.
   - `.matrix-detail-item`: uso de `background: var(--surface-raised); border: 1px solid var(--border-subtle);` y `.matrix-detail-item strong` con `color: var(--text-primary);`.
   - `.invitation-link`: uso de `background: var(--surface-raised); border-inline-start: 4px solid var(--warning);` y `code` con `color: var(--text-primary);`.
3. **Indicadores de Estado y Padrón:**
   - `.roster-count`: sustitución de `#dce8ff` por `color: var(--text-primary); background: var(--surface-raised); border: 1px solid var(--border-subtle);`.
   - `.status-invited`: uso de `color: var(--warning-text); background: var(--warning-bg); border: 1px solid var(--warning-border);`.
   - `.status-registered`: uso de `color: var(--success-text); background: var(--success-bg); border: 1px solid var(--success-border);`.
   - `.status-suspended`: uso de `color: var(--danger-text); background: var(--danger-bg); border: 1px solid var(--danger-border);`.
   - `.status-active` y `.matrix-yes`: uso de `color: var(--success-text);`.
   - `.status-inactive`: uso de `color: var(--danger-text);`.
   - `.matrix-no`: uso de `color: var(--text-muted);`.
   - `.matrix-rubric-btn:hover:not(:disabled)`: uso de `background: var(--surface-hover-subtle);`.
4. **Encabezados y Tipografía:**
   - `.event-header`: sustitución de la línea inferior rígida por `border-block-end: 4px solid var(--accent-primary);`.
   - `.event-header h1` y `.section-heading h2`: reemplazo de tipografía serif por `font-family: var(--font-display, var(--font-sans));`.
5. **Invariantes:** No se alteran rutas, permisos de administración, contratos de API, lógica de validación, drag-and-drop / reorder, modales ni persistencia.

### 13. Capa Instrumento y Tokens en Submódulos Restantes de Administración, tarea 1.8 (2026-09-08)

Conforme a RF-176 y RF-177, se extiende la sobriedad operativa y la tokenización a los submódulos restantes del área de administración (`AdminEventsPage`, `EventConfigurationPage` y `AdminVotingPage`):
1. **Atributo de Capa:** Se declara `data-layer="instrument"` de forma explícita en los contenedores `<main>` de:
   - `AdminEventsPage.jsx`: `<main className="container" data-layer="instrument">` (en estado cargado, error y principal).
   - `EventConfigurationPage.jsx`: `<main className="admin-shell" data-layer="instrument">`.
   - `AdminVotingPage.jsx`: `<main className="admin-shell voting-page" data-layer="instrument">`.
2. **Tokens en Panel de Votación y Diálogo:**
   - `.voting-summary strong`: uso de `color: var(--accent-primary); font-family: var(--font-display, var(--font-sans));`.
   - `.pending-dialog-content h2`: uso de `font-family: var(--font-display, var(--font-sans));`.
   - `.pending-dialog-list li`: uso de `background: var(--surface-raised); border-inline-start: 3px solid var(--warning);`.
3. **Tokens en Preparación y Resumen Operativo:**
   - `.readiness-ok`: `color: var(--success-text);`.
   - `.readiness-pending`: `color: var(--warning-text);`.
   - `.readiness-checklist li`: `border: 1px solid var(--border-subtle);`.
   - `.readiness-fail`: `border-inline-start: 3px solid var(--danger);` y su icono con `color: var(--danger-text);`.
   - `.readiness-ok-item`: `border-inline-start: 3px solid var(--success); color: var(--success-text);` y su icono con `color: var(--success-text);`.
   - `.operations-summary`: `border: 1px solid var(--border-subtle); background: var(--surface-card);`.
   - `.operations-summary-list article`: `border-inline-start: 4px solid var(--accent-primary);`.
   - `.user-admin`: `border-block-start: 1px solid var(--border-subtle);`.
   - `.user-admin li`: `border: 1px solid var(--border-subtle); background: var(--surface-card);`.
4. **Invariantes:** Se mantiene inalterada la lógica de apertura y cierre de eventos y noches, verificación de completitud, administración de usuarios y roles, y contratos de API.

### 14. Modularización Estructural CSS: Sorteo Ceremonial y Penalizaciones, tarea 1.9 (2026-09-08)

Conforme a RF-176 y la arquitectura modular sin CSS Modules ni librerías externas (Frente B):
1. **Extracción Atómica:** Se desacoplan las reglas especializadas de Spec 011 (Sorteo Ceremonial y Resultados) y Spec 014 (Penalizaciones y Comisariato) de `client/src/index.css` hacia sus respectivos módulos CSS en `client/src/styles/`:
   - `client/src/styles/ceremony.css`: Reglas de `.ceremonial-draw-*`, `.countdown-display`, `.winner-reveal*`, `.results-page`, `.tie-breaker-*`, `.results-*` y sus adaptaciones responsivas `@media (max-width: 36rem)`.
   - `client/src/styles/penalties.css`: Reglas de `.penalties-page`, `.penalty-form*`, `.penalties-table`, `.penalties-row*`, `.penalty-cell-*`, `.penalty-status-badge`, `.badge-applied`, `.badge-revoked`, `.penalty-modal*` y sus adaptaciones responsivas `@media (max-width: 48rem)` y `@media (max-width: 36rem)`.
2. **Jerarquía e Imports:** Ambos módulos se importan en la cabecera de `client/src/index.css` respetando el orden estricto de la cascada:
   ```css
   @import "./styles/tokens.css";
   @import "./styles/components.css";
   @import "./styles/ceremony.css";
   @import "./styles/penalties.css";
   ```
3. **Invariantes Arquitectónicas:**
   - Ningún módulo importado puede declarar bloque `:root` (reservado exclusivamente para `tokens.css`).
   - Las pruebas de regresión en `client/src/tests/tokens.test.js` deben validar la inclusión de los imports en `index.css`, la ausencia de `:root` en `ceremony.css` y `penalties.css`, y la integridad de tokens en `.penalty-form` y `.penalty-modal`.
   - Se mantiene 100% la compatibilidad visual y funcional sin alteraciones en componentes JSX ni lógica de negocio.

### 15. Modularización Estructural CSS: Actas Notariales y Escrutinio, tarea 1.10 (2026-09-08)

Conforme a RF-176 y la continuidad del Frente B:
1. **Extracción Atómica:** Se desacoplan las reglas especializadas de Spec 015 (Actas Oficiales y Escrutinio Notarial) de `client/src/index.css` hacia `client/src/styles/scrutiny.css`:
   - `client/src/styles/scrutiny.css`: Reglas de `.official-record-page`, `.record-controls-*`, `.record-pending-card*`, `.record-certify-box*`, `.official-record-banner*`, `.official-record-document`, `.record-doc-header*`, `.record-header-republic*`, `.record-title`, `.record-number-badge`, `.record-seal-banner`, `.seal-badge`, `.seal-hash*`, `.seal-meta`, `.record-intro-narrative`, `.record-section*`, `.record-troupes-list`, `.record-judges-grid`, `.record-judge-item*`, `.record-table*`, `.overall-table*`, `.winner-tag`, `.record-signatures-section`, `.signatures-intro`, `.signatures-grid`, `.signature-slot`, `.sig-line`, `.sig-name`, `.sig-role`, y el bloque de `@media print`.
2. **Jerarquía e Imports:** El nuevo módulo se importa inmediatamente después de `penalties.css` en `client/src/index.css`:
   ```css
   @import "./styles/tokens.css";
   @import "./styles/components.css";
   @import "./styles/ceremony.css";
   @import "./styles/penalties.css";
   @import "./styles/scrutiny.css";
   ```
3. **Invariantes Arquitectónicas:**
   - `scrutiny.css` no declara bloque `:root`.
   - El bloque `@media print` queda encapsulado de forma limpia en `scrutiny.css`, manteniendo sus directivas de no visualización para elementos de navegación y formato blanco puro para impresión de actas.
   - Se mantiene intacta la lógica notarial y de certificación en `OfficialRecordPage.jsx` y `useCeremonialDraw.js`.

### 16. Modularización Estructural CSS: Administración y Mesa de Control, tarea 1.11 (2026-09-08)

Conforme a RF-176 y el avance sistemático del Frente B de consolidación CSS:
1. **Extracción Atómica:** Se desacoplan las reglas operativas de administración y mesa de control de `client/src/index.css` hacia `client/src/styles/admin.css`:
   - `client/src/styles/admin.css`: Reglas de `.admin-shell`, `.event-header`, `.event-actions`, `.config-section`, `.section-heading`, `.config-grid`, `.config-card`, `.record`, `.rubric-card`, `.criterion`, `.rubric-list`, `.user-admin`, `.roster-page`, `.roster-count`, `.judge-create-form`, `.judge-grid`, `.judge-card`, `.judge-card-heading`, `.invitation-link`, `.operational-roster`, `.operational-user*`, `.status-invited`, `.status-registered`, `.status-suspended`, `.invitation-state`, `.assignment-page`, `.event-picker`, `.assignment-form`, `.quota-list`, `.assignment-grid`, `.assignment-card`, `.assignment-revoked`, `.assignment-actions`, `.voting-page`, `.voting-pickers`, `.voting-summary`, `.reopen-form`, `.pending-dialog*`, `.operations-summary*`, junto con sus reglas adaptativas `@container (min-width: 38rem)` y `@container (min-width: 62rem)`.
2. **Jerarquía e Imports:** El módulo se importa inmediatamente después de `scrutiny.css` en `client/src/index.css`:
   ```css
   @import "./styles/tokens.css";
   @import "./styles/components.css";
   @import "./styles/ceremony.css";
   @import "./styles/penalties.css";
   @import "./styles/scrutiny.css";
   @import "./styles/admin.css";
   ```
3. **Invariantes Arquitectónicas:**
   - `admin.css` no declara bloque `:root`.
   - Las pruebas de regresión en `client/src/tests/tokens.test.js` deben validar la presencia de `@import "./styles/admin.css";` y la ausencia de `:root` en `admin.css`.
   - Se conserva 100% la compatibilidad visual de todas las vistas de administración (`AdminEventsPage.jsx`, `EventConfigurationPage.jsx`, `AdminCompetenciaPage.jsx`, `AdminJudgesPage.jsx`, `AdminAssignmentsPage.jsx`, `AdminVotingPage.jsx`).

### 17. Modularización Estructural CSS: Competencia y Configuración de Reglas, tarea 1.12 (2026-09-08)

Conforme a RF-176 y la continuidad del Frente B de consolidación CSS:
1. **Extracción Atómica:** Se desacoplan las reglas del módulo de competencia (Spec 017) de `client/src/index.css` hacia `client/src/styles/competencia.css`:
   - `client/src/styles/competencia.css`: Reglas de `.competencia-nav`, `.competencia-overview-grid`, `.overview-stat`, `.overview-number`, `.overview-label`, `.overview-alert`, `.readiness-panel`, `.readiness-summary`, `.readiness-ok`, `.readiness-pending`, `.readiness-checklist`, `.readiness-fail`, `.readiness-ok-item`, `.readiness-icon`, `.rubric-card-header`, `.rubric-meta`, `.rubric-expanded`, `.rubric-edit-form`, `.subrecord`, `.subrecord-summary`, `.criterion-list`, `.criterion`, `.inline-criterion-form`, `.inline-item-form`, `.matrix-wrapper`, `.matrix-table`, `.matrix-yes`, `.matrix-no`, `.matrix-rubric-btn`, `.matrix-detail`, `.matrix-detail-item`, `.status-active`, `.status-inactive`, `.mono-text`, y sus adaptaciones responsivas `@media (max-width: 36rem)`.
2. **Jerarquía e Imports:** El módulo se importa inmediatamente después de `admin.css` en `client/src/index.css`:
   ```css
   @import "./styles/tokens.css";
   @import "./styles/components.css";
   @import "./styles/ceremony.css";
   @import "./styles/penalties.css";
   @import "./styles/scrutiny.css";
   @import "./styles/admin.css";
   @import "./styles/competencia.css";
   ```
3. **Invariantes Arquitectónicas:**
   - `competencia.css` no declara bloque `:root`.
   - Las pruebas de regresión en `client/src/tests/tokens.test.js` deben validar la presencia de `@import "./styles/competencia.css";`, la ausencia de `:root` en `competencia.css`, y la adopción de tokens en `competencia.css` (incluyendo hovers de navegación, celdas de matriz y checklist de preparación).
   - Se mantiene intacta la lógica de evaluación, reordenamiento atómico de items/criterios y derivación de especialidades en `AdminCompetenciaPage.jsx`.
