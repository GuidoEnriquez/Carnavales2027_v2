# Tareas de Implementación — Spec 025: Votación Secuencial por Orden de Pasada

## Fase 1 — Secuencialidad en Home del Jurado (RF-189, RF-190)

- [x] Agregar lógica de cálculo secuencial `isTroupeLockedInSequence(troupeIndex, troupesList)` en `JudgeHomePage.jsx`.
- [x] Aplicar clase `.is-locked` y estado de candado en `.judge-ballot-card` para comparsas bloqueadas.
- [x] Deshabilitar el botón de acción en comparsas bloqueadas con etiqueta accesible explicativa.
- [x] Agregar pruebas en `client/src/tests/JudgeHomePage.test.jsx` validando el bloqueo de comparsa 2 hasta que comparsa 1 esté 100% resuelta.
- [x] Ejecutar suite de pruebas de cliente y verificar regresiones.


## Fase 2 — Guardia de Navegación y Continuidad en Planilla (RF-191, RF-192)

- [x] Incorporar guardia en `JudgeBallotPage.jsx` contra accesos URL directos a comparsas bloqueadas.
- [x] Crear pantalla de espera y redirección a la comparsa activa actual.
- [x] Implementar banner/modal de finalización de comparsa con botón de salto inmediato a la siguiente pasada.
- [x] Agregar pruebas en `client/src/tests/JudgeBallotPage.test.jsx`.
- [x] Ejecutar suite completa y verificar build.

## Fase 3 — Guardia de Integridad en Backend (RF-193)

- [x] Agregar verificación de precedencia de orden de pasada en `ballot-service.js` antes de persistir puntajes.
- [x] Manejar error `TROUPE_PRECEDENCE_REQUIRED` (409 Conflict) en la API.
- [x] Crear pruebas automatizadas en suite backend de ballots.
- [x] Ejecutar suites de API y validar consistencia.

## Fase 4 — Control Centralizado por Administrador / Mesa de Control (RF-194)

- [x] Incorporar control de "Comparsa activa en pista" en `AdminVotingPage.jsx`.
- [x] Exponer endpoint o actualización de estado para la comparsa en pista (`GET .../voting/status` con `troupes` y `activeTroupe`).
- [x] Agregar pruebas de interacción en `AdminVotingPage.test.jsx`.
- [x] Validación integral de extremo a extremo (142/142 API tests, 247/247 client tests, Vite build limpio, `git diff --check` limpio).

