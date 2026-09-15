# Validación — Spec 028

Evidencia real (2026-09-11, commit `62aa52a`):

- `JudgeHomePage.test.jsx`: 9/9 (2 nuevos Tarea 2: CTA protagonista único, acceso a cerradas).
- `JudgeBallotPage.test.jsx` + `JudgeBallotPageV3.test.jsx`: 18/18 (nuevos Fase 3: sidebar actual, salto desde resumen, lista-para-revisar, readonly como resumen; migrados RF-184/RF-187 y copy "Decisión registrada").
- Suite cliente completa: 286 passed; 3 failed preexistentes de entorno local (`AdminEventContext` ×1, `AdminCompetenciaRoute` ×2 — `window.localStorage` undefined en jsdom con Node 26; verificados idénticos vía `git stash` sin los cambios; en CI Node 20 pasan en verde).
- Build Vite: exitoso (~850ms). `git diff --check`: limpio.
- Un test de tokens roto por la Fase 1 (colisión de regex con regla nueva) se dejó verde retirando la regla, sin tocar el test.
- Revisión visual del producto: aprobada ("me gusto como quedo", 2026-09-11). Comprobación manual de viewports: aprobada por el producto (2026-09-11). Spec 028 cerrada.

## FIX-HOME — 2026-09-15

Implementado y validado automáticamente; comprobación visual nueva pendiente.
RF-HOME-01–04: completitud por comparsa separada de confirmación por planilla,
AHORA solo con pendientes, completas en EVALUADAS con consulta, revisión de
planillas completas y tarjeta de progreso sin grid heredado estrecho.

### Comandos ejecutados (client/)

| Comando | Resultado final |
|---|---|
| `npm.cmd test -- --run src/tests/JudgeHomePage.test.jsx src/tests/JudgeBallotPage.test.jsx src/tests/JudgeBallotPageV3.test.jsx` | 36/36, 3 archivos; home 18, planilla 8, v3 10 |
| `npm.cmd test -- --run` | 325/325, 48 archivos, 0 fallos; 13,61 s |
| `npm.cmd run build` | Vite exitoso, 88 módulos; 2,73 s |
| `git diff --check` | Sin errores; avisos de normalización LF/CRLF |

No hay scripts lint ni typecheck en el cliente. No aplica migración ni suite
API: no se modifican backend, datos ni contratos. Build realizado tras los
cambios productivos; cambios posteriores solo amplían tests y corrigen
indentación JSX/documentación.

### Evidencia y revisión

- Captura reproducida con fixture: dos comparsas completas, tercera habilitada
  protagonista, cuarta en espera sin enlace; cada completa solo en EVALUADAS.
- Consulta y progreso de comparsas completas sin declarar SUBMITTED; barra con
  valores de ítems resueltos y contador de comparsas evaluadas.
- Revisión de `OPEN` y `REOPENED` históricos completos; enlaces por ID propio
  para varias planillas, incluidos estados mixtos pendiente/completa/confirmada.
- Una planilla con 299/300 no muestra confirmación ni revisión final; 0/0 no
  se considera evaluada. La confirmación global exige todas SUBMITTED.
- Fallback de detalles probado con SCORED y NOT_PRESENTED, sin perder acceso a
  revisión. El camino include=progress mantiene una sola llamada.
- Revisión delegada read-only sin defectos productivos introducidos; observó
  huecos de tests de planillas mixtas y fallback, cubiertos en la versión final.
- Una corrida intermedia dio 324/325: el test de confirmación online pulsaba
  submit tras verificar la llamada PUT, antes de que React reflejara su respuesta.
  Se agregó espera a la región "Lista para revisar" antes del clic, sin retirar
  aserciones ni cambiar el código de planilla. Focal y suite posteriores verdes.

### Archivos y pendiente visual

Código: `client/src/pages/JudgeHomePage.jsx`, `client/src/index.css`.
Tests: `client/src/tests/JudgeHomePage.test.jsx` y espera de sincronización en
`client/src/tests/JudgeBallotPage.test.jsx`. Artefactos: spec, clarifications,
plan, tasks y validation de Spec 028.

Pendiente navegador en 390x844, 768x1024 y 1440x900, teclado/táctil. No se afirma
validación manual de esta corrección a partir de jsdom ni del build. Los estilos
de la planilla y el bloqueo secuencial se mantienen; los cambios previos de
login, asignaciones y apertura administrativa no son parte de este FIX-HOME.

## FIX-RAIL — 2026-09-15

Corregido el desborde visual observado en el rail desktop de la planilla:
`.ballot-context-rail` ahora puede encogerse y oculta solo el overflow horizontal;
listas, botones y nombres tienen límites de ancho; los nombres largos muestran
elipsis. No cambia navegación, estados, puntuación ni contrato de API.

Se agregó regresión de CSS en `client/src/tests/tokens.test.js`. La comprobación
manual de la captura en 1440x900 y la revisión equivalente en 768x1024/390x844
siguen pendientes de navegador.

### Evidencia automatizada FIX-RAIL

| Comando | Resultado |
|---|---|
| `npm.cmd test -- --run src/tests/tokens.test.js src/tests/JudgeBallotPage.test.jsx src/tests/JudgeBallotPageV3.test.jsx` | 59/59, 3 archivos |
| `npm.cmd test -- --run` | 326/326, 48 archivos, 0 fallos |
| `npm.cmd run build` | Vite exitoso, 88 módulos |
| `git diff --check` | Sin errores; avisos LF/CRLF de Git |

## FIX-SHELL — 2026-09-15

El shell operativo de la planilla se desplaza 3rem hacia la izquierda en
`min-width: 80rem`, conservando el margen derecho automático. El cambio reduce
el espacio visual libre del lado derecho observado en la captura y no altera
la grilla, el rail ni los breakpoints de móvil/tablet. Se agregó una aserción
de CSS en `tokens.test.js`. Validación manual de viewport sigue pendiente.

El encabezado de jurado (`.judge-navigation`) ahora comparte `1160px` y el
mismo eje de margen con la planilla, alineando el logo superior con el inicio
del contenido operativo.

Desplazamiento de ~150px a la izquierda (≈198px a la izquierda del centro)
para logo y planilla, con piso en cero para no desbordar en viewports angostos.
Solo `min-width: 80rem`; móvil y tablet conservan el centrado original.
