# Validación - Spec 009: Experiencia operativa del jurado

## Estado

- Implementación y validación automatizada completadas el 2026-09-01.
- Pendiente: comprobación manual en 390x844, 768x1024 y 1440x900 con teclado y emulación táctil.

## Evidencia ejecutada

| Área | Comando | Resultado |
|---|---|---|
| Cliente afectado | `npm.cmd test -- --run src/tests/App.test.jsx src/tests/JudgeBallotPage.test.jsx src/tests/JudgeHomePage.test.jsx` en `client/` | 11 passed, 0 failed. |
| Cliente completo | `npm.cmd test` en `client/` | 18 archivos, 53 passed, 0 failed. |
| Build | `npm.cmd run build` en `client/` | Exitoso; 48 módulos transformados. |
| Revisión | `git diff --check` | Sin errores de whitespace. |

## Cobertura

| Requisito | Evidencia |
|---|---|
| RF-80, RF-81 | `App.test.jsx` y `LoginPage.test.jsx` verifican el acceso público y los controles de autenticación del login rediseñado. |
| RF-82 | `JudgeHomePage.test.jsx` verifica el progreso derivado de ítems resueltos y los estados en progreso y cerrada. |
| RF-83, RF-84, RF-87 | `JudgeBallotPage.test.jsx` verifica contexto de comparsa, escala 1 a 10 sin botón 0, acción separada `No se presentó`, navegación lateral de comparsas para escritorio y sincronización de la decisión. |
| RF-85 | `JudgeBallotPage.test.jsx` verifica la representación de lectura bloqueada para una decisión confirmada. |
| RF-86 | `JudgeBallotPage.test.jsx` conserva el diálogo de pendientes, cierre por `cancel` y retorno de foco al disparador. |
| RF-88 | `App.test.jsx`, `LoginPage.test.jsx`, `JudgeHomePage.test.jsx` y `JudgeBallotPage.test.jsx` verifican identidad de login, cards derivadas por comparsa y su navegación hacia la planilla, sin introducir edición de decisiones confirmadas. |

## Comprobación manual pendiente

1. Abrir login, home y planilla en 390x844, 768x1024 y 1440x900.
2. Verificar controles de nota de al menos 48 px y operación con emulación táctil sin hover.
3. Recorrer los tres diálogos con teclado: foco inicial, Tab, Escape y retorno de foco.
4. Confirmar que conexión, progreso, comparsa y especialidad permanecen legibles durante la carga.
