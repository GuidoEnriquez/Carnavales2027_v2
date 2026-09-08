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
