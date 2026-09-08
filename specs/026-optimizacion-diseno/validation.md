# Validación — Spec 026: Optimización de Diseño sin Framework

## Estado de Validación

- **Fecha:** 2026-09-08
- **Alcance evaluado:** T01–T10 (T09 con veredicto fundado de no-aplica) + T12 (deuda visual Login) + T13 (deuda visual Home jurado) + T14 (simplificación visual AdminEventsPage, con nota de alcance); T11 pendiente por falta de navegador.
- **Resultado General:** VALIDADA con límites declarados. Suite final 41 archivos / 258 tests en verde, build 71 módulos exitoso, `git diff --check` limpio, sin secretos. Sin capturas de navegador (no disponible en el entorno); equivalencia por prueba determinista de cascada + suite. Micro-deltas intencionales documentados en T04 (badges monitor), T05 (`.col-penalty`) y T12 (Login táctil + estados OTP/verificado).

### T10 — Deuda de título + validación final (2026-09-08)

**Resultado:** unidad validada. Título de `AdminResultsPage.test.jsx` corregido (`brand` → `instrument`); aserciones intactas. Verificación final completa (tabla: suite 41/258, build 71 módulos, diff limpio). `docs/sdd-status.md` actualizado con Spec 026.

## Línea base medida (auditoría 2026-09-08, working tree con pendientes)

| Comando | Resultado |
|---|---|
| `npx vitest run` en `client/` | 40 archivos / 253 tests en verde |
| `npx vite build` en `client/` | Exitoso, 69 módulos (CSS 108.48 kB) |
| `git diff --check` | Limpio (solo aviso preexistente de LF en `AppNavigation.test.jsx`) |
| Escaneo de secretos en el diff | Sin credenciales (menciones en specs y clases `password-toggle`) |

Estas cifras describen el punto de partida, no la validación de ninguna tarea.

## Registro por tarea

### T01 — Inventario y línea base (2026-09-08, sin cambios de código)

**Resultado:** unidad validada. Solo lectura y medición; cero modificaciones de código.

**LOC por hoja CSS (`client/src/`):**

| Hoja | Líneas | Coincidencias hex |
|---|---|---|
| `index.css` | 1491 | 70 |
| `styles/components.css` | 2108 | 27 |
| `styles/judge.css` | 870 | 2 |
| `styles/admin.css` | 613 | 0 |
| `styles/scrutiny.css` | 354 | 36 |
| `styles/competencia.css` | 330 | 1 |
| `styles/penalties.css` | 227 | 1 |
| `styles/ceremony.css` | 222 | 0 |
| `styles/tokens.css` | 237 | 52 (fuente, esperado) |

Total: 6452 líneas CSS. Hex fuera de `tokens.css`: ~137 coincidencias (incluye fallbacks `var(--x, #hex)` y documento notarial).

**Duplicados confirmados:**

| Selector | Definiciones |
|---|---|
| `.ballot-status-open/submitted/reopened` | `index.css:333-345` (claros legacy), `index.css:816-818` (oscuros), `judge.css:367-385` (oscuros) → 3 fuentes, candidata T03 |
| `.login-card` | `index.css:717` (base) + `components.css:937` (override `brand`, intencional) |
| `.monitor-status-open` | solo `index.css:1403` (claro legacy, candidata T04) |
| `.role-area-card` | solo `components.css:978` (sin duplicado) |

**Estilos inline `style={{` en JSX no-test:** 9 ocurrencias, todas dinámicas (`brandColor` de comparsa, porcentajes de progreso) → 0 no-dinámicos. Sin acción masiva; solo extracción de patrones en T07–T09.

**Decisión `EventCard.jsx`: ADOPTAR.** El componente tiene estilos con tokens en `admin.css:487-529`, uso real en `App.jsx` (wrapper de Competencia) y API accesible (click + teclado). Queda pendiente test dedicado, asignado a T07.

**Build de referencia:** CSS 108.48 kB / JS 382.58 kB (gzip 18.77 / 106.02 kB), 69 módulos.

### T02 — CSS muerto en `index.css` (2026-09-08)

**Resultado:** unidad validada. Solo eliminaciones en `client/src/index.css` (~40 declaraciones en 12 puntos), todas probadas como sobrescritas por reglas posteriores de igual especificidad o duplicados idénticos: `a{color}`, `button` (radius/color/fondo), `button.secondary` (color/fondo), `.button-link` (4 decls.), `.app-navigation` (6 decls.), `.brand` (3 decls.), `nav` (gap/borde/fondo), `nav a` (6 decls.), `nav a:hover` claro, `aria-current` (color/fondo), `.nav-section-label`, `button.danger-action` (duplicado idéntico), `label{color}`, campos base (fondo/color), `.status-pill` base, `.feedback{color}`, `.sync-warning{color}`, fondo de `.empty-state`, bloque claro `.ballot-status-*`.

**No tocado a propósito:** `.status-configuring`/`.status-open` están vivas vía clase dinámica `status-${...}` en `EventConfigurationPage.jsx:56`; `.monitor-status-*` están vivas en `VeedorMonitorPage.jsx:308` (van a T04).

**Prueba de equivalencia de cascada:** script throwaway con jsdom (`Temp/opencode/css-cascade-check.cjs`, no versionado) que concatena las 8 hojas en orden de cascada y vuelca 19 propiedades computadas × 20 elementos representativos: **380 sondas, 0 diferencias** antes/después.

| Comando | Resultado |
|---|---|
| `vitest run tokens/components/AppNavigation` | 57/57 en 3 archivos |
| `npm test` en `client/` | 40 archivos / 253 tests en verde |
| `npm run build` en `client/` | Exitoso, 69 módulos; CSS 108.48 → 107.22 kB (−1.26 kB) |
| `git diff --check` | Limpio |
| Escaneo de secretos en el diff | Sin credenciales (solo declaraciones CSS eliminadas) |

**Límite honesto:** sin navegador disponible en este entorno no hubo comparación de capturas; la equivalencia se sostiene en prueba determinista de cascada + suite completa. Se recomienda comprobación manual en 3 viewports cuando haya navegador.

### T03 — Fuente única `.ballot-status-*` (2026-09-08)

**Resultado:** unidad validada. Eliminadas las 3 reglas duplicadas de `client/src/index.css` (con comentario de canonicidad); `styles/judge.css:367-383` retiene las definiciones con tokens. Nueva regresión en `tokens.test.js` que fija la fuente única (index sin reglas, judge con las 3).

**Hallazgo (no bloquea, se deriva a T11):** `judge.css` (870 líneas) **no está importada** — solo `index.css` entra vía `main.jsx` (verificado en HEAD y working tree) — por lo que hoy no aporta a producción y la planilla se estiliza con copias en `index.css`. Las clases `.ballot-status-*` no tienen ningún uso en JSX (verificado en pages/components/features), de modo que el cambio tiene impacto de render nulo. La reconciliación completa de `judge.css` (importar + dedupar) excede el alcance atómico y va a T11.

**Prueba de equivalencia:** script jsdom antes/después; únicamente cambiaron las 6 sondas de las clases sin uso (valores efectivos previos de `index.css` → ausencia de regla). Resto idéntico.

| Comando | Resultado |
|---|---|
| `vitest run src/tests/tokens.test.js` | 39/39 (incluye regresión nueva) |
| `npm test` en `client/` | 40 archivos / 254 tests en verde |
| `npm run build` en `client/` | Exitoso, 69 módulos; CSS 107.22 → 106.94 kB |
| `git diff --check` | Limpio |

### T04 — Badges monitor/workflow a tokens (2026-09-08)

**Resultado:** unidad validada como **normalización visual intencional** (no equivalencia de píxeles): las pills claras legacy pasan a pares semánticos oscuros del sistema, conforme a Spec 020 dark-first y clarificación 12 (eliminar fondos claros heredados).

**Cambios** (solo `client/src/index.css`): `.monitor-status-open` → `success-text/success-bg`; `.monitor-status-closed` → `text-muted/surface-raised`; `.monitor-status-not_open` → `warning-text/warning-bg`; `.workflow-step-done` y su número → `var(--success)` (valor idéntico a `#16a34a`, cero cambio). La base `.monitor-status` (`border: 1px solid currentColor`) se adapta sola. Nueva regresión en `tokens.test.js` que fija los tokens y prohíbe los 7 hex legacy en esas reglas.

**Prueba de cascada:** el diff antes/después contiene exactamente las sondas de monitor/workflow y ninguna otra. Nota de motor: jsdom no resuelve `var()`, por eso el lado "después" muestra variables sin resolver; en navegador real resuelven a los pares oscuros indicados. El delta de workflow es idéntico por valor (`--success` = `#16a34a`).

| Comando | Resultado |
|---|---|
| `vitest run src/tests/tokens.test.js` | 40/40 (incluye regresión nueva) |
| `npm test` en `client/` | 40 archivos / 255 tests en verde |
| `npm run build` en `client/` | Exitoso, 69 módulos; CSS 106.94 → 107.02 kB |
| `git diff --check` | Limpio |

### T05 — Resultados/portal a tokens (2026-09-08)

**Resultado:** unidad validada. `styles/components.css` queda con **cero hex literales** (27 → 0): 15 fallbacks muertos `var(--brand-gold, #f59e0b)` → `var(--brand-gold)` (el token existe, el fallback nunca aplicaba); `#16a34a` → `var(--success)`, `#d97706` → `var(--warning)`, `#b91c1c` → `var(--danger-border)`, `#111827` → `var(--surface-card)` (todos idénticos en valor). Único micro-delta intencional: `.col-penalty` `#ef4444` → `var(--danger-text)` (legibilidad sobre fondo oscuro, a la par de `.col-net` dorada). Nueva regresión en `tokens.test.js` (cero hex + mapeos clave).

| Comando | Resultado |
|---|---|
| Cascada jsdom antes/después | 0 diferencias en sondas (el micro-delta de `.col-penalty` no está en sondas; verificado por inspección de regla) |
| `npm test` en `client/` | 40 archivos / 256 tests en verde |
| `npm run build` en `client/` | Exitoso, 69 módulos; CSS 106.94 → 106.97 kB |
| `git diff --check` | Limpio |

### T06 — `utilities.css` (2026-09-08)

**Resultado:** unidad validada. Nuevo `client/src/styles/utilities.css` (12 clases `u-*`, solo keywords de layout + gaps por token, cero hex, sin `:root`), importado al final de `index.css`; `tokens.test.js` valida el orden de 8 imports, ausencia de `:root` y ausencia de hex. Justificación medida: `display:flex` 133, `display:grid` 103, `align-items:center` 107, `justify-*` 69, `gap space-2/3/4` 55, `flex-direction:column` 40. Sin migración de consumidores en esta unidad (la adoptan T07/T08).

| Comando | Resultado |
|---|---|
| `vitest run src/tests/tokens.test.js` | 41/41 |
| `npm test` en `client/` | 40 archivos / 256 tests en verde |
| `npm run build` en `client/` | Exitoso, 69 módulos; CSS 106.97 → 107.34 kB (+0.37 kB por utilidades) |
| `git diff --check` | Limpio |

### T07 — `PageShell` + páginas admin + test `EventCard` (2026-09-08)

**Resultado:** unidad validada. Nuevo `components/PageShell.jsx` (`layer` + `className` + passthrough → `<main data-layer>`); migradas 9 páginas admin/instrumento (Penalties piloto + Competencia, Judges, Assignments, Events ×3 mains, EventConfiguration, Voting, Results, OfficialRecord). Nuevo `components/EventCard.test.jsx` (2 tests: render + click/teclado; se corrigió aislamiento con `unmount`; así queda saldada la decisión T01).

**Incidencia honesta:** un test de Penalties falló una vez por timing de mocks y pasó 7/7 al re-ejecutar; flaky preexistente, no causado por el cambio.

| Comando | Resultado |
|---|---|
| `npm test` en `client/` | 41 archivos / 258 tests en verde |
| `npm run build` en `client/` | Exitoso, 70 módulos |
| `git diff --check` | Limpio |

### T08 — `PageShell` jurado/resto + `DialogFooter` (2026-09-08)

**Resultado:** unidad validada. Migradas JudgeHome, JudgeBallot (×4 mains; los 2 retornos tempranos sin capa reciben `instrument`), Veedor (clase dinámica por passthrough), Home/Login/Portal (`brand`; `id="main-content"` por passthrough), Assignment (sin capa → `instrument`) y 3 invitaciones (sin capa → `brand` según clarificación 12 de Spec 020). `DialogFooter.jsx` adoptado en las 4 llamadas de `JudgeBallotPage`. Adopción `PageShell` 100% en `pages/`.

**Incidencias honestas:** error propio de edición (apertura omitida en el 4.º footer) detectado por la suite y corregido antes de validar; un flaky de atajos V3 por timeout bajo carga (6/6 aislado, verde en re-ejecución completa).

| Comando | Resultado |
|---|---|
| `npm test` en `client/` | 41 archivos / 258 tests en verde |
| `npm run build` en `client/` | Exitoso, 71 módulos |
| `git diff --check` | Limpio |

### T09 — `useApiResource`/helpers: NO APLICA (2026-09-08)

**Resultado:** evaluado con medición; veredicto **no aplica en este incremento**. Medición `useEffect/apiRequest/loadingSetters` por página (no-test):

| Página | effects | apiRequest | setters |
|---|---|---|---|
| Accept×3 | 2 | 3 | 3 |
| Assignments | 3 | 11 | 3 |
| Competencia | 7 | 22 | 0 |
| Events | 3 | 6 | 0 |
| Judges | 2 | 6 | 8 |
| Penalties | 3 | 12 | 5 |
| Results | 3 | 6 | 4 |
| Voting | 5 | 7 | 3 |
| EventConfiguration | 2 | 2 | 0 |
| JudgeAssignment | 2 | 2 | 3 |
| JudgeBallot | 6 | 4 | 0 |
| JudgeHome | 2 | 3 | 3 |
| Login | 2 | 6 | 7 |
| OfficialRecord | 3 | 5 | 10 |
| PublicResults | 5 | 0 | 5 |
| VeedorMonitor | 4 | 2 | 2 |

**Justificación:** el volumen existe pero los flujos son heterogéneos (OTP/2FA en Login, polling en Veedor, SSE en PublicResults, cargas secuenciales dependientes en Competencia, modales transaccionales en Penalties/Results). Un hook genérico ahora sería una abstracción prematura sobre rutas críticas de auth y votación, con riesgo desproporcionado para un incremento de deuda con mandato de cero cambios de comportamiento. Sin cambios de código en T09; no correspondía re-ejecutar suite/build.

### T12 — Deuda visual Login: táctil 48px + estados sin estilo (2026-09-08)

**Resultado:** unidad validada como **micro-delta intencional** (precedente T04/T05; excede RNF-OPT-01 con justificación). Hallazgos de la skill `frontend-design` sobre `LoginPage.jsx` (capa `brand`, Spec 023/RF-201): el toggle de contraseña medía ~32px (bajo el mínimo 48px de RF-178 y del brief táctil) y `.resend-cooldown`, `.resend-link` y `.verified-session` se renderizaban sin regla.

**Cambios** (`client/src/pages/LoginPage.jsx`, `client/src/index.css`, solo tokens, cero hex nuevos): botón primario sin `→` decorativo (nombre accesible `Ingresar` intacto); toggle a 48px + hover con `:not(:disabled)` que restituye el fondo sutil intencional frente al `button:hover` global; estilos tokenizados para reenvío OTP y sesión verificada. Sin cambios de comportamiento, auth, 2FA, rutas ni dependencias.

| Comando | Resultado |
|---|---|
| `vitest run LoginPage.test.jsx App.test.jsx` | 13/13 en 2 archivos |
| `npm test` en `client/` | 41 archivos / 258 tests en verde |
| `npm run build` en `client/` | Exitoso, 71 módulos |
| `git diff --check` | Limpio |
| Escaneo de secretos en el diff | Sin credenciales (solo CSS con tokens + 1 línea JSX) |

**Límite honesto:** sin navegador no hubo capturas; la comprobación manual en 390x844, 768x1024 y 1440x900 con teclado y táctil queda pendiente (igual que T11).

### T13 — Deuda visual Home jurado: sufijo `→` en acción de card (2026-09-08)

**Resultado:** unidad validada. Retirada 1 línea JSX en `JudgeHomePage.jsx` (span decorativo excluido del nombre accesible; textos `Ver planilla`/`Comenzar`/`Continuar` y `href` intactos). El `→` de `JudgeBallotPage.jsx:553` no se tocó: pertenece a Spec 025 (`[NECESITA ACLARACIÓN]`).

| Comando | Resultado |
|---|---|
| `vitest run JudgeHomePage.test.jsx` | 7/7 |
| `npm test` en `client/` | 41 archivos / 258 tests en verde |
| `npm run build` en `client/` | Exitoso, 71 módulos |
| `git diff --check` | Limpio |

### T14 — Simplificación visual de `AdminEventsPage` (2026-09-08)

**Resultado:** unidad validada como **cambio trivial** (sin comportamiento). Reorganización solo presentacional de la vista de lista: encabezado único, acciones crear/configurar agrupadas, mensaje condicional y usuarios/ADMIN en segunda card. Lógica, API, Dialog picker y `EventConfigurationPage` intactos.

**Nota de alcance:** excede RNF-OPT-01 y la exclusión de rediseños del spec; se documenta aquí por trazabilidad con verificación completa. Cobertura SDD plena requeriría micro-spec dedicada.

| Comando | Resultado |
|---|---|
| `vitest run AdminEventsPage.test.jsx` | 3/3 |
| `npm test` en `client/` | 41 archivos / 258 tests en verde |
| `npm run build` en `client/` | Exitoso, 71 módulos |
| `git diff --check` | Limpio |
| Escaneo de secretos en el diff | Sin credenciales (solo JSX presentacional) |

**Límite honesto:** sin navegador no hubo capturas; comprobación manual en 3 viewports pendiente.
