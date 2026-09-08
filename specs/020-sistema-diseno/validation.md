# Validación — Spec 020: Fundación del Sistema de Diseño

## Estado de Validación

- **Fecha:** 2026-09-08
- **Alcance evaluado:** T01 a T06 de Spec 020.
- **Resultado General:** EXITOSA (100% pruebas aprobadas).

## Matriz de Cobertura de Requisitos

| Requisito | Descripción | Estado | Evidencia |
|---|---|---|---|
| RF-176 | Sistema de tokens semánticos (`tokens.css`), escalas y media queries accesibles | Validado | `client/src/styles/tokens.css`, `client/src/tests/tokens.test.js` |
| RF-177 | Capa visual dual Marca vs Instrumento (`data-layer="brand" \| "instrument"`) | Validado | `client/src/App.jsx`, `client/src/tests/tokens.test.js` |
| RF-178 | Componentes compartidos atómicos (`Dialog`, `Button`, `StatusPill`, `ProgressBar`, `Toast`) | Validado | `client/src/components/*`, `client/src/tests/components.test.jsx` |
| RF-179 | Consolidación de guardas de rol (`RequireAnyRole`) y enrutamiento centralizado | Validado | `client/src/auth/RequireAnyRole.jsx`, `client/src/auth/role-routes.js`, `client/src/tests/RequireAnyRole.test.jsx` |
| RF-180 | Diccionario de errores y mensajes en lenguaje de usuario (`i18n/errors.js`) | Validado | `client/src/i18n/errors.js`, `client/src/tests/errors.test.js` |
| RF-181 | PWA completa (iconos, theme-color, manifest válido) y skip-link accesible | Validado | `client/public/manifest.webmanifest`, `client/index.html`, `client/src/tests/pwa-metadata.test.js` |

## Registro de Pruebas Automatizadas

### 1. Tests de Cliente (`npm test` en `client/`)
```
Test Files  36 passed (36)
     Tests  168 passed (168)
  Duration  5.66s
```
- 138 tests preexistentes pasaron sin ninguna alteración ni regresión.
- 30 tests nuevos cubrieron al 100% tokens, componentes atómicos, guardas consolidadas, i18n de errores y PWA.

### 2. Build de Producción (`npm run build` en `client/`)
```
✓ 63 modules transformed.
dist/index.html                   0.82 kB │ gzip:  0.44 kB
dist/assets/index-CiD9HJd2.css   70.96 kB │ gzip: 13.59 kB
dist/assets/index-CUjpHUx5.js   349.29 kB │ gzip: 96.91 kB
✓ built in 806ms
```

### 3. Verificación de Suites Globales (API y BD)
- `npm test` en `api/`: 134/134 tests aprobados.
- `npm run db:test` en `api/`: 68/68 tests aprobados.

## Verificación de Integridad

- Retrocompatibilidad absoluta: los alias de variables CSS anteriores aseguran que ninguna pantalla previa se vea afectada visualmente de forma negativa.
- Accesibilidad: `<Dialog>` respeta focus trapping y retorno de foco con `focusReturnRef`; `<Button>` respeta `aria-busy` y target táctil ≥ 48px; `index.html` incluye skip-link para lectores de pantalla y teclado.
- PWA instalable: `manifest.webmanifest` con iconos vectoriales y rasterizados (192px y 512px maskable).

## T07: consolidacion CSS, tarea 1.1 (2026-09-08)

**Resultado:** unidad validada con el alcance y las limitaciones siguientes. No cierra el resto del plan de consolidacion.

- Requisitos mantenidos: Spec-020/RF-176 y RF-177. Se trasladaron 15 declaraciones de `index.css` al final de `tokens.css`, sin modificar valores, selectores de capa, preferencias de accesibilidad ni reglas de componentes. `--text-inverse` conserva `#0f172a`.
- La regresion verifica los 15 valores, la posicion final del bloque, los imports y la ausencia de bloques `:root` en las otras dos hojas. Es una prueba estructural, no un motor de cascada CSS.
- No se modificaron JSX, rutas, autenticacion, votos, resultados, actas, API ni BD. Las eliminaciones preexistentes de cuatro archivos `PLAN-*` no forman parte de esta tarea.

### Pruebas ejecutadas

Comandos npm ejecutados desde `client/`:

| Comando | Resultado |
|---|---|
| `npm test -- src/tests/tokens.test.js` antes de agregar regresiones | 5/5 aprobados |
| Mismo comando con regresiones y antes del traslado | 2 fallos esperados, 5 aprobados: detecta el bloque ausente en tokens y presente en index |
| Mismo comando despues del traslado | 7/7 aprobados |
| `npm test` | 40 archivos, 202 tests aprobados; 7.45 s |
| `npm run build` | Vite 7.3.6, 68 modulos; exitoso en 2.32 s. CSS 93.09 kB (gzip 16.95 kB) |
| `git diff --check` desde la raiz | Sin errores |
| `.opencode/skills/impeccable/scripts/impeccable detect --json client/src/index.css client/src/styles/tokens.css` | 25 advertencias sobre bordes laterales y fuente Inter preexistentes; ninguna corresponde a las declaraciones trasladadas |

### Comparacion en navegador

Se inicio Vite con `npm run dev -- --host 127.0.0.1 --port 5179 --strictPort`. Se capturo `#/login` antes y despues con Firefox headless, en un perfil temporal aislado para no interferir con el navegador del usuario:

```bash
firefox --headless --no-remote --profile /tmp/opencode/css-firefox --window-size 390,844 --screenshot /tmp/opencode/css-before-390.png "http://127.0.0.1:5179/#/login"
firefox --headless --no-remote --profile /tmp/opencode/css-firefox --window-size 390,844 --screenshot /tmp/opencode/css-after-390.png "http://127.0.0.1:5179/#/login"
magick compare -metric AE /tmp/opencode/css-before-390.png /tmp/opencode/css-after-390.png null:
```

Los mismos comandos se ejecutaron con `768,1024` (sufijo `768`) y `1440,900` (sufijo `1440`). Las seis capturas estan en `/tmp/opencode/`, no versionadas.

| Viewport | Diferencia absoluta de pixeles (AE) |
|---|---|
| 390x844 | `0 (0)` |
| 768x1024 | `0 (0)` |
| 1440x900 | `0 (0)` |

### Limites y pendientes

- La comparacion visual cubre el viewport inicial del login, no capturas de pagina completa, OTP, dashboard autenticado, planilla, impresion ni preferencias de contraste/movimiento en navegador. No se afirma una auditoria WCAG completa ni se corrigen defectos visuales previos.
- El cliente no define scripts `lint` ni `typecheck`. No se agregaron herramientas para esta unidad. Migraciones y suites de API/BD no aplican al traslado exclusivamente CSS y no se ejecutaron.
- Los reemplazos de colores restantes, tokens adicionales, wallboard, impresion y organizacion por secciones quedan pendientes desde la tarea 1.2. Deben conservar diferencias semanticas y valores existentes, no mapear colores por aproximacion.

## T08: tokens faltantes, tarea 1.2 (2026-09-08)

**Resultado:** unidad validada. Requisito cubierto: Spec-020/RF-176. Se definieron seis tokens con valores exactos de estilos existentes, segun clarificacion 7: `--surface-input`, `--surface-login-input`, `--border-input`, `--surface-hover-subtle`, `--text-on-primary` y `--text-on-accent`.

- Se mantienen distintos los fondos de campos generales y login/OTP, los textos de acciones heredadas y solidas, y el token preexistente `--text-inverse`.
- No se migraron consumidores ni se modificaron valores existentes, capas, media queries o el bloque heredado final de T07. La busqueda de referencias `var(...)` a los seis nombres en `client/src/` (CSS/JS/JSX) devolvio cero coincidencias.
- Archivos de esta unidad: `client/src/styles/tokens.css`, `client/src/tests/tokens.test.js` y `clarifications.md`, `plan.md`, `tasks.md`, `validation.md` de Spec 020. Los cambios de T07 y las eliminaciones preexistentes de `PLAN-*` permanecen intactos.

### Validaciones ejecutadas

| Comando | Resultado |
|---|---|
| `npm test -- src/tests/tokens.test.js` en `client/`, antes de definir los tokens | 6 fallos esperados por tokens ausentes, 7 pruebas anteriores aprobadas |
| Mismo comando despues de definirlos | 13/13 aprobados; verifica valor exacto, disponibilidad en el primer `:root` y declaracion unica, ademas de regresiones T07 |
| `npm test` en `client/` | 40 archivos, 208 tests aprobados; 6.38 s |
| `npm run build` en `client/` | Exitoso; 68 modulos, 2.17 s; CSS 93.29 kB (gzip 17.01 kB) |
| `.opencode/skills/impeccable/scripts/impeccable detect --json client/src/styles/tokens.css` | `[]`, sin hallazgos |
| `git diff --check` | Sin errores |

### Limites y siguiente unidad

No se ejecutaron nuevas capturas ni pruebas manuales de teclado, contraste o responsive: los tokens nuevos aun no afectan estilos renderizados. Las pruebas son estructurales, no certifican WCAG. Lint/typecheck siguen sin scripts disponibles; migraciones y suites API/BD no aplican a esta adicion CSS sin consumidores.

La tarea 1.3 debe adoptar un primer grupo de tokens en consumidores reales, preservando valores y validando las pantallas afectadas. La creacion de este conjunto no completa la tokenizacion del sitio ni el rediseño visual.

## T09: consumidores login/OTP, tarea 1.3 (2026-09-08)

**Resultado:** migracion acotada validada sin diferencias visuales. Requisito cubierto: Spec-020/RF-176. Se mantienen los contratos visuales de Specs 009 y 023; no se modifican autenticacion, 2FA ni redirecciones.

Se reemplazaron cuatro valores en `client/src/index.css`: fondo y color del borde de `.login-card input` y `.otp-input-group input`, usando `--surface-login-input` y `--border-input`. No se modificaron tokens, dimensiones, selectores ni reglas de foco/disabled. Se agregaron dos casos de regresion en `client/src/tests/tokens.test.js`. Se actualizaron clarificaciones, plan, tareas y esta evidencia de Spec 020.

### Pruebas ejecutadas

| Comando | Resultado |
|---|---|
| `npm test -- src/tests/tokens.test.js` en `client/`, antes de migrar | 2 fallos esperados por falta de adopcion, 13 pruebas anteriores aprobadas |
| `npm test -- src/tests/tokens.test.js src/tests/LoginPage.test.jsx src/tests/LoginPageRedirect.test.jsx` en `client/` | 32/32 aprobados en 3 archivos |
| `npm test` en `client/` | 210/210 aprobados en 40 archivos; 5.92 s |
| `npm run build` en `client/` | Exitoso; 68 modulos, 1.95 s; CSS 93.33 kB (gzip 17.01 kB) |
| `.opencode/skills/impeccable/scripts/impeccable detect --json client/src/index.css` | 25 advertencias preexistentes sobre bordes laterales y fuente Inter, ninguna en las reglas migradas |
| `git diff --check` | Sin errores |

### Comparacion real en Firefox

Se uso Firefox 155.0.1 headless por WebDriver BiDi y Vite local, con perfil aislado. El harness temporal simulo las respuestas de autenticacion y uso datos sinteticos; no realizo llamadas a la API real, envio de correos ni creacion de sesiones reales. El countdown OTP se fijo en 28 segundos para comparar capturas deterministas.

```bash
node /tmp/opencode/css-verification-start.mjs
node /tmp/opencode/css-verification.mjs before
node /tmp/opencode/css-verification.mjs after
```

El ultimo comando finalizo con codigo 0: las seis capturas completas coinciden pixel a pixel y los 72 registros de estilos calculados (2 campos de credenciales + 6 OTP, en 3 estados y 3 viewports) son identicos. Se comprobaron fondo, borde, texto, opacidad, outline y sombra, ademas de dimensiones/layout. Los estados normal, foco y disabled se ejercitaron programaticamente; no se declara una recorrida manual completa de teclado.

| Viewport | Credenciales: pixeles distintos | OTP: pixeles distintos | Estilos y layout |
|---|---|---|---|
| 390x844 | 0 | 0 | Identicos |
| 768x1024 | 0 | 0 | Identicos |
| 1440x900 | 0 | 0 | Identicos |

Capturas y resultados en `/tmp/opencode/css-input-baseline/before/` y `after/`; comparacion en `after/comparison.json`, metodologia en `/tmp/opencode/css-input-baseline/README.md`. El harness y la evidencia son temporales, no versionados. No hubo errores de consola; Vite y Firefox de verificacion se detuvieron al terminar.

### Hallazgos previos y limites

- En 390x844, la tarjeta OTP mide 406px y queda recortada a la derecha. Los seis campos permanecen visibles. Se observo antes y despues; no es una regresion de la migracion.
- Los seis campos OTP carecen de etiquetas individuales aunque el grupo tiene nombre. Pendiente de una unidad de accesibilidad.
- Se preserva apariencia, no se certifica contraste WCAG ni se valida todo el sitio. No se probaron preferencias de alto contraste o movimiento reducido en navegador.
- Lint/typecheck siguen sin scripts disponibles; migraciones y suites API/BD no aplican al refactor CSS. Los otros cuatro tokens de T08 y el resto de consumidores siguen pendientes.

## T10: campos generales y penalizaciones, tarea 1.4 (2026-09-08)

**Resultado:** migracion acotada validada sin alteraciones visuales ni de comportamiento. Requisito cubierto: Spec-020/RF-176.

Se reemplazo el color de fondo `#0d1523` por `var(--surface-input)` exclusivamente en tres reglas de campos de entrada en `client/src/index.css`:
1. `input, select, textarea` (campos generales operativos)
2. `.penalty-form input, .penalty-form select, .penalty-form textarea` (formulario de aplicacion de penalizaciones)
3. `.penalty-modal textarea` (textarea del modal de revocacion de penalizaciones)

Se preservaron intactas las superficies de contenedores y paneles que comparten incidentalmente `#0d1523` (`.sync-panel`, `.tie-breaker-pool li`, `.results-row`, `.penalties-row`, `.penalty-summary-box` y `.assignment-confirm-field`), conservando su semantica de superficie contenedora.

### Pruebas ejecutadas

| Comando | Resultado |
|---|---|
| `npm test -- src/tests/tokens.test.js` antes de la migracion | 3 fallos esperados por falta de adopcion, 15 pruebas anteriores aprobadas |
| Mismo comando despues de migrar | 18/18 aprobados en 1 archivo; valida adopcion estricta en las tres reglas y ausencia de `#0d1523` en las mismas |
| `npm test -- src/tests/tokens.test.js src/features/penalties/RevokePenaltyModal.test.jsx src/pages/AdminPenaltiesPage.test.jsx src/tests/AdminCompetenciaPage.test.jsx` | 63/63 aprobados en 4 archivos |
| `npm test` en `client/` | 213/213 aprobados en 40 archivos; 6.97 s |
| `npm run build` en `client/` | Exitoso; 68 modulos, 914 ms; CSS 93.36 kB (gzip 17.02 kB) |
| `git diff --check` | Sin errores |

### Limites y siguiente unidad

- Esta unidad no modifica botones, estados hover, ni resuelve los dos hallazgos preexistentes de OTP (recorte en 390x844 y etiquetas individuales), los cuales quedan preservados como tareas pendientes independientes.
- Siguientes consumidores a migrar: `--text-on-primary`, `--text-on-accent` y `--surface-hover-subtle` (tarea 1.5 / T11).

## T11: acciones, textos y hovers, tarea 1.5 (2026-09-08)

**Resultado:** migracion acotada validada sin alteraciones visuales ni de comportamiento. Requisito cubierto: Spec-020/RF-176.

Se adoptaron tres tokens semanticos en reglas de interaccion y acciones:
1. `--text-on-primary` (`#082b61`) en `client/src/index.css`:
   - `button, .button-link`
   - `.score-grid button:hover:not(:disabled)`
   - `.assignment-confirm-btn-icon`
2. `--surface-hover-subtle` (`rgba(148, 163, 184, 0.1)`) en `client/src/index.css`:
   - `.app-navigation nav a:hover`
   - `.competencia-nav button:hover:not(:disabled)`
3. `--text-on-accent` (`#ffffff`) en `client/src/styles/components.css`:
   - `.app-button-primary`
   - `.app-button-danger`
   - `.score-option-btn.is-staged` y su `.score-anchor-text`

Se preservo `--text-inverse` (`#0f172a`) intacto y no se alteraron fondos ni colores de impresion.

### Pruebas ejecutadas

| Comando | Resultado |
|---|---|
| `npm test -- src/tests/tokens.test.js` antes de migrar | 9 fallos esperados por falta de adopcion, 18 pruebas anteriores aprobadas |
| Mismo comando despues de migrar | 27/27 aprobados en 1 archivo; valida adopcion de los 3 grupos y ausencia de valores hardcodeados |
| `npm test -- src/tests/tokens.test.js src/tests/components.test.jsx src/tests/JudgeBallotPage.test.jsx src/tests/AppNavigation.test.jsx src/tests/AdminAssignmentsPage.test.jsx` | 46/46 aprobados en 5 archivos |
| `npm test` en `client/` | 222/222 aprobados en 40 archivos; 7.38 s |
| `npm run build` en `client/` | Exitoso; 68 modulos, 902 ms; CSS 93.51 kB (gzip 17.04 kB) |
| `git diff --check` | Sin errores |

### Limites y pendientes

- Se completan los consumidores previstos para los seis tokens agregados en T08 (`--surface-input`, `--surface-login-input`, `--border-input`, `--surface-hover-subtle`, `--text-on-primary`, `--text-on-accent`).
- Siguiente unidad: T12 (subsanacion de accesibilidad y viewport movil de tarjeta OTP).

## T12: subsanación responsive y accesibilidad de OTP, tarea 1.6 (2026-09-08)

**Resultado:** subsanacion completa y validada de los dos hallazgos preexistentes de OTP detectados en T09. Requisitos cubiertos: Spec-020/RF-176 y RF-181.

Se resolvieron ambos problemas manteniendo intacta la logica de Better Auth, 2FA, sesiones y redirecciones:
1. **Accesibilidad individual:** En `client/src/pages/LoginPage.jsx`, se incorporo `aria-label={`Dígito ${i + 1} de 6`}` a cada uno de los seis inputs. La prueba de accesibilidad verifica la presencia de los 6 textboxes por rol y nombre accesible.
2. **Dimensionamiento responsivo:** En `client/src/index.css`, se actualizaron los paddings y dimensiones fijas con funciones `clamp()` y `max-inline-size: 100%`:
   - `.login-card`: `max-inline-size: 100%`, `padding: clamp(1.25rem, 5vw, 4rem)`.
   - `.login-card form`: `padding: clamp(0.75rem, 3vw, 2rem)`.
   - `.otp-input-group`: `max-inline-size: 100%`, `gap: clamp(0.25rem, 1.5vw, 0.5rem)`.
   - `.otp-input-group input`: `width: clamp(2.25rem, 8.5vw, 2.75rem)`, `font-size: clamp(1.2rem, 5vw, 1.5rem)`, `max-inline-size: 100%`.

En viewport movil de 390x844, la tarjeta pasa de medir 406px (con desborde) a ~315px, encajando comodamente en los 366px disponibles del contenedor sin recorte lateral alguno. En viewports tablet (768px) y desktop (1440px), las dimensiones se mantienen en los valores maximos originales (44px de ancho por digito, 4rem de padding en tarjeta).

### Pruebas ejecutadas

| Comando | Resultado |
|---|---|
| `npm test -- src/tests/tokens.test.js src/tests/LoginPage.test.jsx` antes de implementar | 2 fallos esperados (1 por inputs sin nombre accesible, 1 por falta de reglas clamp/max-inline-size) |
| Mismo comando despues de implementar | 37/37 aprobados en 2 archivos (28 tokens, 9 login) |
| `npm test` en `client/` | 224/224 aprobados en 40 archivos; 6.70 s |
| `npm run build` en `client/` | Exitoso; 68 modulos, 898 ms; CSS 93.64 kB (gzip 17.08 kB) |
| `git diff --check` | Sin errores |

## T13: Capa Instrumento y Tokens Semánticos en Dashboard de Administración, tarea 1.7 (2026-09-08)

**Resultado:** migración y sobriedad operativa validada en los paneles de administración y gestión de jurados. Requisitos cubiertos: Spec-020/RF-176 y RF-177.

Se implementaron las directrices de la capa de instrumento y la tokenización de componentes administrativos:
1. **Atributo de Capa:** Se incorporó de manera explícita `data-layer="instrument"` en los contenedores principales `<main className="admin-shell ...">` de `AdminCompetenciaPage.jsx`, `AdminJudgesPage.jsx` y `AdminAssignmentsPage.jsx`.
2. **Superficies y Tarjetas Administrativas:**
   - `.config-card, .record, .rubric-card`: reemplazo de fondo claro heredado `#fbfcff` por `var(--surface-card)` y borde `var(--border-subtle)`.
   - `.operational-user`: reemplazo de `#fbfcff` por `var(--surface-card)` y borde lateral `var(--accent-primary)`.
   - `.matrix-table`: celdas y cabeceras actualizadas a `var(--border-subtle)` y `var(--surface-raised)`.
   - `.matrix-yes`: texto actualizado a `var(--success-text)`.
   - `.matrix-no`: texto actualizado a `var(--text-muted)`.
   - `.matrix-rubric-btn:hover`: hover actualizado a `var(--surface-hover-subtle)`.
   - `.matrix-detail` y `.matrix-detail-item`: superficies actualizadas a `var(--surface-card)` y `var(--surface-raised)` con borde `var(--border-subtle)`.
   - `.invitation-link`: fondo `var(--surface-raised)` con borde de advertencia `var(--warning)`.
3. **Indicadores de Estado y Padrón:**
   - `.roster-count`: actualizado a `color: var(--text-primary); background: var(--surface-raised); border: 1px solid var(--border-subtle);`.
   - `.status-invited`: actualizado a `var(--warning-text)` sobre `var(--warning-bg)` con borde `var(--warning-border)`.
   - `.status-registered`: actualizado a `var(--success-text)` sobre `var(--success-bg)` con borde `var(--success-border)`.
   - `.status-suspended`: actualizado a `var(--danger-text)` sobre `var(--danger-bg)` con borde `var(--danger-border)`.
   - `.status-active` y `.status-inactive`: actualizados a `var(--success-text)` y `var(--danger-text)`.
4. **Encabezados y Tipografía:**
   - `.event-header`: línea inferior migrada a `var(--accent-primary)`.
   - `.event-header h1` y `.section-heading h2`: tipografía modernizada con `var(--font-display, var(--font-sans))`.

### Pruebas ejecutadas

| Comando | Resultado |
|---|---|
| `npx vitest run src/tests/AdminCompetenciaPage.test.jsx src/tests/tokens.test.js` | 70/70 aprobados en 2 archivos |
| `npx vitest run src/tests/AdminJudgesPage.test.jsx src/tests/AdminAssignmentsPage.test.jsx src/tests/AdminEventsPage.test.jsx src/tests/AdminVotingPage.test.jsx` | 11/11 aprobados en 4 archivos |
| `npm test` en `client/` | 237/237 aprobados en 40 archivos; 6.59 s |
| `npm run build` en `client/` | Exitoso en 894 ms (68 módulos; CSS 97.02 kB, JS 372.23 kB) |
| `git diff --check` | 0 advertencias / 0 errores |

## T14: Capa Instrumento y Tokens en Submódulos de Administración, tarea 1.8 (2026-09-08)

**Resultado:** sobriedad operativa y semántica de tokens validada en Eventos, Configuración de Jornadas y Mesa de Control de Votación. Requisitos cubiertos: Spec-020/RF-176 y RF-177.

Se extendieron las directrices del sistema de diseño a los submódulos de administración:
1. **Atributo de Capa:** Se incorporó `data-layer="instrument"` de manera explícita en:
   - `AdminEventsPage.jsx`: contenedores `<main className="container" data-layer="instrument">`.
   - `EventConfigurationPage.jsx`: `<main className="admin-shell" data-layer="instrument">`.
   - `AdminVotingPage.jsx`: `<main className="admin-shell voting-page" data-layer="instrument">`.
2. **Panel de Votación y Diálogo:**
   - `.voting-summary strong`: número con `color: var(--accent-primary)` y `font-family: var(--font-display, var(--font-sans))`.
   - `.pending-dialog-content h2`: tipografía normalizada con `var(--font-display, var(--font-sans))`.
   - `.pending-dialog-list li`: actualizado a `background: var(--surface-raised); border-inline-start: 3px solid var(--warning);`.
3. **Preparación y Operaciones:**
   - `.readiness-ok` y `.readiness-pending`: uso de `var(--success-text)` y `var(--warning-text)`.
   - `.readiness-checklist li`: `border: 1px solid var(--border-subtle);`.
   - `.readiness-fail`: `border-inline-start: 3px solid var(--danger);` con icono `color: var(--danger-text);`.
   - `.readiness-ok-item`: `border-inline-start: 3px solid var(--success); color: var(--success-text);` con icono `color: var(--success-text);`.
   - `.operations-summary`: `border: 1px solid var(--border-subtle); background: var(--surface-card);`.
   - `.operations-summary-list article`: `border-inline-start: 4px solid var(--accent-primary);`.
   - `.user-admin`: `border-block-start: 1px solid var(--border-subtle);`.
   - `.user-admin li`: `border: 1px solid var(--border-subtle); background: var(--surface-card);`.

### Pruebas ejecutadas

| Comando | Resultado |
|---|---|
| `npx vitest run src/tests/AdminEventsPage.test.jsx src/tests/AdminVotingPage.test.jsx src/tests/EventConfigurationPage.test.jsx src/tests/tokens.test.js` | 51/51 aprobados en 4 archivos |
| `npm test` en `client/` | 241/241 aprobados en 40 archivos; 6.70 s |
| `npm run build` en `client/` | Exitoso en 877 ms (68 módulos; CSS 97.15 kB, JS 372.36 kB) |
| `git diff --check` | 0 advertencias / 0 errores |

## T15: Modularización CSS de Sorteo Ceremonial y Penalizaciones, tarea 1.9 (2026-09-08)

**Resultado:** modularización estructural completada exitosamente sin alteraciones visuales, respetando la arquitectura atómica de CSS global y el orden estricto de la cascada. Requisito cubierto: Spec-020/RF-176.

Se desacoplaron 415 líneas históricas de `client/src/index.css` en dos módulos dedicados:
1. `client/src/styles/ceremony.css`: Reglas de Spec 011 (sorteo ceremonial y resultados), incluyendo `.ceremonial-draw-*`, `.countdown-display`, `.winner-reveal*`, `.results-page`, `.tie-breaker-*`, `.results-*` y sus adaptaciones responsivas `@media (max-width: 36rem)`.
2. `client/src/styles/penalties.css`: Reglas de Spec 014 (comisariato y penalizaciones), incluyendo `.penalties-page`, `.penalty-form*`, `.penalties-table`, `.penalties-row*`, `.penalty-cell-*`, `.penalty-status-badge`, `.badge-applied`, `.badge-revoked`, `.penalty-modal*` y sus adaptaciones responsivas `@media (max-width: 48rem)` y `@media (max-width: 36rem)`.
3. Inclusión en cabecera de `client/src/index.css` con `@import "./styles/ceremony.css";` y `@import "./styles/penalties.css";`.
4. Pruebas automatizadas en `client/src/tests/tokens.test.js` que validan el orden de imports, ausencia total de bloques `:root` fuera de `tokens.css` y la adopción de tokens en `penalties.css`.

### Pruebas ejecutadas

| Comando | Resultado |
|---|---|
| `npx vitest run src/tests/tokens.test.js` | 38/38 aprobados en 1 archivo (valida imports, ausencia de `:root` en módulos y tokens de penalizaciones) |
| `npx vitest run src/pages/AdminPenaltiesPage.test.jsx src/pages/AdminResultsPage.test.jsx src/features/results/CeremonialDrawModal.test.jsx` | 17/17 aprobados en 3 archivos |
| `npm test` en `client/` | 241/241 aprobados en 40 archivos; 6.45 s |
| `npm run build` en `client/` | Exitoso en 871 ms (68 módulos; CSS 97.17 kB, JS 372.36 kB) |
| `git diff --check` | 0 advertencias / 0 errores |

## T16: Modularización CSS de Actas Notariales y Escrutinio, tarea 1.10 (2026-09-08)

**Resultado:** modularización estructural completada exitosamente sin alteraciones visuales, preservando la fidelidad notarial del documento y las reglas de impresión. Requisito cubierto: Spec-020/RF-176.

Se desacoplaron 349 líneas de `client/src/index.css` hacia `client/src/styles/scrutiny.css`:
1. `client/src/styles/scrutiny.css`: Reglas de Spec 015 (Actas Oficiales y Escrutinio Notarial), incluyendo `.official-record-page`, `.record-controls-*`, `.record-pending-card*`, `.record-certify-box*`, `.official-record-banner*`, `.official-record-document`, `.record-doc-header*`, `.record-header-republic*`, `.record-title`, `.record-number-badge`, `.record-seal-banner`, `.seal-badge`, `.seal-hash*`, `.seal-meta`, `.record-intro-narrative`, `.record-section*`, `.record-troupes-list`, `.record-judges-grid`, `.record-judge-item*`, `.record-table*`, `.overall-table*`, `.winner-tag`, `.record-signatures-section`, `.signatures-intro`, `.signatures-grid`, `.signature-slot`, `.sig-line`, `.sig-name`, `.sig-role`, y el bloque completo `@media print`.
2. Inclusión en cabecera de `client/src/index.css` con `@import "./styles/scrutiny.css";`.
3. Pruebas automatizadas en `client/src/tests/tokens.test.js` que validan el orden secuencial de los 5 `@import` y la ausencia de bloques `:root` en `scrutiny.css`.
4. Suite de `OfficialRecordPage.test.jsx` pasando 100% en verde.

### Pruebas ejecutadas

| Comando | Resultado |
|---|---|
| `npx vitest run src/tests/tokens.test.js src/pages/OfficialRecordPage.test.jsx` | 41/41 aprobados en 2 archivos (valida imports, ausencia de `:root` y render notarial) |
| `npm test` en `client/` | 241/241 aprobados en 40 archivos; 6.89 s |
| `npm run build` en `client/` | Exitoso en 950 ms (68 módulos; CSS 97.17 kB, JS 372.36 kB) |
| `git diff --check` | 0 advertencias / 0 errores |

## T17: Modularización CSS de Administración y Mesa de Control, tarea 1.11 (2026-09-08)

**Resultado:** modularización estructural completada exitosamente sin alteraciones visuales, desacoplando el shell, la configuración, el padrón, las asignaciones, la mesa de control y los diálogos de votación hacia un módulo dedicado. Requisito cubierto: Spec-020/RF-176.

Se desacoplaron más de 500 líneas de `client/src/index.css` hacia `client/src/styles/admin.css`:
1. `client/src/styles/admin.css`: Reglas de `.admin-shell`, `.event-header`, `.event-actions`, `.config-section`, `.section-heading`, `.config-grid`, `.config-card`, `.record`, `.rubric-card`, `.criterion`, `.rubric-list`, `.user-admin`, `.roster-page`, `.roster-count`, `.judge-create-form`, `.judge-grid`, `.judge-card`, `.judge-card-heading`, `.invitation-link`, `.operational-roster`, `.operational-user*`, `.status-invited`, `.status-registered`, `.status-suspended`, `.invitation-state`, `.assignment-page`, `.event-picker`, `.assignment-form`, `.quota-list`, `.assignment-grid`, `.assignment-card`, `.assignment-revoked`, `.assignment-actions`, `.voting-page`, `.voting-pickers`, `.voting-summary`, `.reopen-form`, `.pending-dialog*`, `.operations-summary*`, junto con las reglas adaptativas `@container (min-width: 38rem)` y `@container (min-width: 62rem)` y móviles `@media (max-width: 36rem)`.
2. Inclusión en cabecera de `client/src/index.css` con `@import "./styles/admin.css";`.
3. Pruebas automatizadas en `client/src/tests/tokens.test.js` que validan el orden secuencial de los 6 `@import`, la ausencia de bloques `:root` en `admin.css`, y la adopción de tokens semánticos en `admin.css`.
4. Las 6 suites de administración (`AdminEventsPage.test.jsx`, `EventConfigurationPage.test.jsx`, `AdminCompetenciaPage.test.jsx`, `AdminJudgesPage.test.jsx`, `AdminAssignmentsPage.test.jsx`, `AdminVotingPage.test.jsx`) pasando 100% en verde (54/54 tests).

### Pruebas ejecutadas

| Comando | Resultado |
|---|---|
| `npx vitest run src/tests/tokens.test.js` | 38/38 aprobados (valida imports, ausencia de `:root` en `admin.css` y adopción de tokens) |
| Suites de páginas de administración (6 archivos) | 54/54 aprobados en 3.40 s |
| `npm test` en `client/` | 247/247 aprobados en 40 archivos; 7.35 s |
| `npm run build` en `client/` | Exitoso en 874 ms (68 módulos; CSS 103.44 kB, JS 380.35 kB) |
| `npm test` en `api/` | 142/142 aprobados en 5 suites; 28.59 s |
| `git diff --check` | 0 advertencias / 0 errores |

## T18: Modularización CSS de Competencia y Configuración de Reglas, tarea 1.12 (2026-09-08)

**Resultado:** modularización estructural completada exitosamente sin alteraciones visuales ni funcionales, desacoplando la navegación de tabs, overview de competencia, preparación de evento (readiness), rubros, subrecords, items, criterios, matriz de evaluación y media queries móviles hacia un módulo dedicado. Requisito cubierto: Spec-020/RF-176.

Se desacoplaron 345 líneas de `client/src/index.css` hacia `client/src/styles/competencia.css`:
1. `client/src/styles/competencia.css`: Reglas de `.competencia-nav`, `.competencia-overview-grid`, `.overview-stat`, `.overview-number`, `.overview-label`, `.overview-alert`, `.readiness-panel`, `.readiness-summary`, `.readiness-ok`, `.readiness-pending`, `.readiness-checklist`, `.readiness-fail`, `.readiness-ok-item`, `.readiness-icon`, `.rubric-card-header`, `.rubric-meta`, `.rubric-expanded`, `.rubric-edit-form`, `.subrecord`, `.subrecord-summary`, `.criterion-list`, `.criterion`, `.inline-criterion-form`, `.inline-item-form`, `.matrix-wrapper`, `.matrix-table`, `.matrix-yes`, `.matrix-no`, `.matrix-rubric-btn`, `.matrix-detail`, `.matrix-detail-item`, `.status-active`, `.status-inactive`, `.mono-text`, y sus adaptaciones responsivas `@media (max-width: 36rem)`.
2. Inclusión en cabecera de `client/src/index.css` con `@import "./styles/competencia.css";` tras `admin.css`.
3. Pruebas automatizadas en `client/src/tests/tokens.test.js` que validan el orden secuencial de los 7 `@import`, la ausencia de bloques `:root` en `competencia.css`, y la adopción de tokens semánticos en `competencia.css` (incluyendo hovers de navegación, celdas de matriz y checklist de preparación).
4. La suite completa de `AdminCompetenciaPage.test.jsx` pasando 100% en verde (33/33 tests).

### Pruebas ejecutadas

| Comando | Resultado |
|---|---|
| `npx vitest run src/tests/tokens.test.js` | 38/38 aprobados (valida imports, ausencia de `:root` en `competencia.css` y adopción de tokens) |
| `npx vitest run src/tests/AdminCompetenciaPage.test.jsx` | 33/33 aprobados en 2.96 s |
| `npm test` en `client/` | 247/247 aprobados en 40 archivos; 7.11 s |
| `npm run build` en `client/` | Exitoso en 887 ms (68 módulos; CSS 103.44 kB, JS 380.35 kB) |
| `npm test` en `api/` | 142/142 aprobados en 5 suites; 26.70 s |
| `git diff --check` | 0 advertencias / 0 errores |
