# Plan de Implementación — Spec 026

## Estrategia

Unidades atómicas, una por vez, con parada obligatoria tras cada validación. Secuencia para cada unidad:

1. Captura de línea base (tests específicos, suite, build, capturas si toca CSS).
2. Cambio mínimo acotado a la tarea.
3. Tests específicos + suite cliente completa + build + `git diff --check`.
4. Comparación visual en `390x844`, `768x1024` y `1440x900` si la unidad toca CSS.
5. Registro de evidencia en `validation.md`; recién entonces, siguiente tarea.

## Hojas canónicas (fuente única objetivo)

| Selector / zona | Hoja canónica | Se elimina de |
|---|---|---|
| `.ballot-status-*` | `styles/judge.css` | `index.css` (bloques claro y oscuro duplicados) |
| `.login-card` base | `index.css` | — (override de marca solo en `components.css`) |
| `.monitor-status-*`, workflow | `index.css` → tokens | valores hex literales |
| Resultados / portal público | `styles/components.css` | hex literales |
| Utilidades `u-*` | `styles/utilities.css` (nuevo) | repeticiones inline de layout |

## Orden de tareas

- T01 inventario y línea base (solo lectura + métricas, sin código).
- T02 código CSS muerto probado.
- T03 fuente única `.ballot-status-*`.
- T04 badges monitor/workflow a tokens.
- T05 hex de resultados/portal a tokens.
- T06 `utilities.css` + orden de imports + `tokens.test.js`.
- T07 `PageShell` + páginas admin.
- T08 `PageShell` en jurado + patrones de diálogo.
- T09 `useApiResource`/helpers (condicional al inventario de T01).
- T10 deuda de título de test + validación final.

## Verificación estándar por unidad

`npx vitest run <archivos>` → `npm test` (base 40/253) → `npm run build` → `git diff --check` → escaneo de secretos en el diff → visual 3 viewports si aplica → registro en `validation.md`.
