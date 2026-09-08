# Plan de Implementación — Spec 023: Capa de Marca y Home por Rol

## Arquitectura y Diseño

### 1. Capa de Marca vs Instrumento en tokens y estilos
- `tokens.css`: Definición de acentos de marca:
  - `--brand-gold: #f5b301;`
  - `--brand-magenta: #e11d74;`
  - `--brand-cyan: #14b8a6;`
  - `--brand-seal: #8f2e22;`
- Atributo `data-layer="brand"`:
  - Aplica tipografía display con acentos de color festivos en títulos.
  - Sutil gradiente decorativo en fondos ceremoniales.
  - `@media (prefers-reduced-motion: reduce)` para desactivar transiciones y giros ornamentales.
- Atributo `data-layer="instrument"`:
  - Preserva fondos sobrios oscuros, tipografía sans funcional y máxima claridad en datos.

### 2. Login con Identidad Carnaval
- Asegurar que `LoginPage.jsx` porte `data-layer="brand"`.
- Afinar detalles de accesibilidad y visualización:
  - Iconos SVG limpios en campos.
  - Botón accesible para alternar visibilidad de contraseña (`aria-label`).
  - Inputs OTP de 6 dígitos con teclado numérico (`inputMode="numeric"`), selector `pattern="[0-9]"`, pegado íntegro y foco automático.

### 3. Home Consciente del Rol (`HomePage.jsx`)
- Asegurar que `HomePage.jsx` porte `data-layer="brand"`.
- Estructurar tarjetas con iconos y etiquetas descriptivas:
  - `ADMIN`: Administración (Eventos, Personas, Asignaciones, Votación).
  - `JUDGE`: Mi panel de jurado.
  - `COMISARIO`: Comisariato y penalizaciones reglamentarias.
  - `SCRUTINEER` / `ESCRIBANO`: Escrutinio y Acta Oficial.
  - `VEEDOR`: Supervisión operativa de votación.
- Soporte para usuarios multi-rol y mensaje de ayuda para usuarios sin roles.

### 4. Redirección Inteligente Post-Login
- Consolidar `goToRoleHome(session)`:
  - Un rol `ADMIN` → `#/admin/events`
  - Un rol `JUDGE` → `#/judge`
  - Un rol `COMISARIO` → `#/admin/penalties`
  - Un rol `SCRUTINEER` o `ESCRIBANO` → `#/admin/results`
  - Un rol `VEEDOR` → `#/veedor`
  - Varios roles → `#/home`

### 5. Stepper Guiado y Condiciones de Escrutinio (`AdminResultsPage.jsx`)
- Panel de requisitos previos de liberación con checklist visible:
  - Jornadas cerradas.
  - Planillas presentadas / suplidas.
  - Sin pendientes.
  - Permisos de Escrutinio / Escribanía.

### 6. Validación
- Pruebas en `client/src/tests/` para `HomePage.test.jsx`, `LoginPage.test.jsx`, y `AdminResultsPage.test.jsx`.
- Chequeo de compilación y suites completas.
