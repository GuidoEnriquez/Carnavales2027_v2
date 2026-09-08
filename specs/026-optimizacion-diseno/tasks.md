# Tareas — Spec 026: Optimización de Diseño sin Framework

## T01 — Inventario y línea base (sin código)

- [x] Mapear cada selector CSS a páginas que lo usan; listar duplicados y candidatos a muerto.
- [x] Medir LOC por hoja, hex fuera de tokens, estilos inline no dinámicos, tamaño CSS/JS del build.
- [x] Decidir `EventCard.jsx`: ADOPTAR (estilos con tokens en `admin.css:487-529`, uso real en `App.jsx`; test dedicado pendiente en T07).
- [x] Registrar métricas en `validation.md`. Detenerse.

## T02 — Código CSS muerto probado (RNF-OPT-01, RNF-OPT-02)

- [x] Eliminar solo declaraciones probadamente sobrescritas en `client/src/index.css` (~40 en 12 puntos; ver evidencia).
- [x] Archivos: `client/src/index.css` (único tocado).
- [x] Tests: específicos 57/57, suite 40/253, build OK (CSS −1.26 kB), equivalencia de cascada 380/380 sin diffs, `git diff --check` limpio. Sin capturas de navegador (no disponible); equivalencia por prueba determinista + suite. Detenerse.

## T03 — Fuente única `.ballot-status-*` (RNF-OPT-01/02/03)

- [x] Eliminar duplicados de `index.css` (conservar comentario de canonicidad); `styles/judge.css` retiene las definiciones.
- [x] Regresión en `tokens.test.js` que fija la fuente única.
- [x] Suite + build + equivalencia de cascada. Sin capturas de navegador (no disponible).
- [x] Hallazgo registrado: `judge.css` no está importada (solo `index.css` vía `main.jsx`); reconciliación completa va a T11. Detenerse.

## T04 — Badges monitor/workflow a tokens (RNF-OPT-01/03)

- [x] Migrar `.monitor-status-*` a pares semánticos oscuros y workflow a `var(--success)` (valor idéntico).
- [x] Archivos: `client/src/index.css` (único tocado) + regresión en `tokens.test.js`.
- [x] Suite 40/255, build OK, cascada acotada a las sondas objetivo, `git diff --check` limpio. Normalización visual intencional documentada; sin capturas (no hay navegador). Detenerse.

## T05 — Resultados/portal a tokens (RNF-OPT-01/03)

- [x] Migrar 27 hex de `styles/components.css` a tokens (cero restantes); micro-delta intencional solo en `.col-penalty`.
- [x] Tests: regresión nueva, suite 40/256, build OK, cascada sin diffs salvo micro-delta documentado, `git diff --check` limpio. Detenerse.

## T06 — `utilities.css` (RNF-OPT-03/04)

- [x] Crear `client/src/styles/utilities.css` (12 clases `u-*`, cero hex, sin `:root`).
- [x] Importarla al final de `index.css`; orden de 8 imports validado en `tokens.test.js`.
- [x] Sin migración de consumidores (la adoptan T07/T08).
- [x] Suite 40/256, build OK (+0.37 kB CSS), `git diff --check` limpio. Detenerse.

## T07 — `PageShell` + páginas admin (RNF-OPT-01/05)

- [x] Crear `client/src/components/PageShell.jsx` (`layer`, `className`, `children` → `<main data-layer>`).
- [x] Migrar 9 páginas (Penalties piloto + Competencia, Judges, Assignments, Events, EventConfiguration, Voting, Results, OfficialRecord).
- [x] Nuevo `EventCard.test.jsx` (decisión T01 saldada con tests).
- [x] Suite 41/258, build OK, `git diff --check` limpio. Flakies documentados (no causados). Detenerse.

## T08 — `PageShell` jurado/resto + `DialogFooter` (RNF-OPT-01/05)

- [x] Migrar JudgeHome, JudgeBallot (×4 mains, 2 sin capa → `instrument`), Veedor, Home, Login, Portal (`id` por passthrough), Assignment (sin capa → `instrument`), 3 invitaciones (sin capa → `brand`).
- [x] Nuevo `DialogFooter.jsx`; 4 llamadas migradas en `JudgeBallotPage`.
- [x] Adopción 100%: cero `<main` crudos en `pages/`.
- [x] Suite 41/258, build 71 módulos OK, `git diff --check` limpio. Detenerse.

## T08 — `PageShell` en jurado + patrones de diálogo (RNF-OPT-01/05)

- [ ] Migrar `JudgeHomePage`/`JudgeBallotPage` y extraer footer de diálogo compartido.
- [ ] Tests: suites de jurado + suite + build + teclado/táctil en flujos tocados. Detenerse.

## T09 — `useApiResource`/helpers, condicional (RNF-OPT-01/05)

- [x] Evaluado con medición por página: volumen existe pero flujos heterogéneos (OTP/2FA, polling, SSE, cargas dependientes) → **no aplica**; abstracción prematura con riesgo desproporcionado.
- [x] Sin cambios de código; evidencia registrada en `validation.md`. Detenerse.

## T10 — Deuda de título + validación final (RNF-OPT-05)

- [x] Corregir título de `AdminResultsPage.test.jsx` (`brand` → `instrument`), sin cambiar aserciones.
- [x] Verificación final: suite 41/258, build 71 módulos OK, `git diff --check` limpio.
- [x] Consolidar `validation.md` y actualizar `docs/sdd-status.md` con Spec 026.

## T11 — Reconciliación de `judge.css` huérfana (hallazgo T03, pendiente)

- [ ] `judge.css` (870 líneas) no está importada: solo `index.css` entra vía `main.jsx` (verificado en HEAD y working tree). Sus reglas no aplican en producción; la planilla se estiliza con copias en `index.css`.
- [ ] Decidir: importarla + dedupar copias de planilla en `index.css`, o declararla obsoleta y eliminarla. Unidad de alto riesgo de cascada: requiere capturas de navegador antes/después en 3 viewports.
- [ ] No iniciar sin navegador disponible o equivalencia visual garantizada. Detenerse.

## T12 — Deuda visual Login: táctil 48px + estados sin estilo (RNF-OPT-03/05, RF-178 de Spec 020)

- [x] `LoginPage.jsx`: retirado `→` decorativo del botón primario (nombre accesible `Ingresar` intacto; sin sufijos `→` por guía de copy del proyecto).
- [x] `index.css`: `.login-password-toggle` a área táctil 48px (`--touch-target-min`) y hover con `:not(:disabled)` para no perder especificidad contra el `button:hover` global (restituye el fondo sutil intencional en vez del primario).
- [x] `index.css`: estilos con tokens para `.resend-cooldown`, `.resend-link` y `.verified-session`, que se renderizaban sin regla (defaults del navegador).
- [x] Micro-deltas intencionales (precedente T04/T05, exceden RNF-OPT-01 con justificación): corrección táctil y de especificidad + estados OTP/verificado con tokens. Sin cambios de comportamiento, auth, 2FA, rutas ni dependencias; cero hex nuevos.
- [x] Tests: `LoginPage.test.jsx` 9/9 + `App.test.jsx` 4/4; suite 41/258; build 71 módulos; `git diff --check` limpio; sin secretos. Sin navegador: comprobación manual en 3 viewports + táctil queda pendiente (igual que T11). Detenerse.

## T13 — Deuda visual Home jurado: sufijo `→` en acción de card (RNF-OPT-05)

- [x] `JudgeHomePage.jsx`: retirada 1 línea (`<span aria-hidden="true"> →</span>`) del link de acción de la card (nombre accesible `Ver planilla`/`Comenzar`/`Continuar` intacto; sin sufijos `→` por guía de copy del proyecto).
- [x] Sin cambios de comportamiento, rutas, estados ni estilos: el `→` estaba excluido del nombre accesible, por lo que tests por rol/regex no cambian.
- [x] No tocado a propósito: el `→` de `JudgeBallotPage.jsx:553` (prompt de continuidad de pasadas) pertenece a Spec 025, en `[NECESITA ACLARACIÓN]`; cualquier cambio ahí requiere resolver esa contradicción primero.
- [x] Tests: `JudgeHomePage.test.jsx` 7/7; suite 41/258; build 71 módulos; `git diff --check` limpio. Sin navegador: comprobación manual en 3 viewports queda pendiente (igual que T11/T12). Detenerse.

## T14 — Simplificación visual de `AdminEventsPage` (lista de eventos)

- [x] `AdminEventsPage.jsx` (solo vista de lista; lógica, API, Dialog, `EventConfigurationPage` y flujos intactos): encabezado único (eyebrow → h1, fuera títulos `Carnavales 2027`/h2 en competencia); crear + configurar agrupados en `.event-actions`; mensaje de estado solo cuando hay contenido (`className="feedback"`); usuarios/ADMIN en segunda `.card` separada por ser otra incumbencia; separador `·` de metadatos.
- [x] **Nota de alcance:** es reorganización visual, excede RNF-OPT-01 y el "sin rediseños" del spec más que T12/T13. Se acoge a cambio trivial (sin comportamiento) con verificación completa; si el equipo exige cobertura SDD plena, extraer a micro-spec dedicada.
- [x] Tests: `AdminEventsPage.test.jsx` 3/3; suite 41/258; build 71 módulos; `git diff --check` limpio; sin secretos. Sin navegador: comprobación manual en 3 viewports queda pendiente. Detenerse.
