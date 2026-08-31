# Tasks — Spec 003: Incremento I3 · Votación — Planillas y puntuaciones

> Registro histórico de tareas de I3. Las tareas sobre omisión y subsanación pre-confirmación fueron evolucionadas por Spec 004 y no describen el comportamiento vigente.

## Reglas de ejecución

- Implementar **una sola tarea por vez** y no iniciar la siguiente sin verificar la actual.
- Cada tarea debe respetar `docs/constitution.md`, `spec.md`, `clarifications.md` y el plan aprobado.
- Tests primero cuando aplique. No declarar éxito sin salida real de test, migración, build o verificación indicada.
- No push, merge, deploy ni operaciones destructivas sin autorización explícita.
- Si una fuente funcional contradice una tarea, detener implementación y actualizar primero la spec.

## Estado general

| ID | Estado | Dependencias |
|---|---|---|
| T01–T10 | Completadas históricamente; evolución de completitud en Spec 004 | — |

---

## T01 — Crear artefactos SDD de I3

**Dependencias:** Ninguna.

- Crear `specs/003-votacion-planillas/spec.md`, `clarifications.md` y `tasks.md`.
- Crear `.hermes/plans/2026-08-30_i3-votacion-planillas.md`.

**Hecho cuando:** los 4 archivos existen y documentan I3 según SDD.

## T02 — Crear migraciones de planillas, scores y auditoría

**RF:** RF-44–RF-55.
**Dependencias:** T01.

- Crear migraciones 031–045 para claves compuestas, planillas, puntuaciones, auditoría, guards, reapertura, puntuación por comparsa, roles `VEEDOR`/`SCRUTINEER`, subsanaciones inmutables y ventanas de votación.
- Crear triggers `ballot_guard` y `ballot_score_guard` para la máquina de estados, inmutabilidad y subsanación.

**Hecho cuando:** `npm run db:migrate` aplica 031–045; pruebas DB validan triggers y restricciones.

## T03 — Implementar servicio de votación

**RF:** RF-44–RF-53.
**Dependencias:** T02.

- Crear `api/src/modules/ballots/ballot-service.js`.
- Implementar `openVoting`, `closeVoting`, `getBallot`, `saveScore`, `submitBallot`, `reopenBallot`, marcado de omisión y registro de subsanación.
- Transacciones con `FOR UPDATE` donde aplique.
- Secreto: el jurado solo ve su planilla; admin solo ve estado.

**Hecho cuando:** servicio exporta funciones y tests unitarios pasan.

## T04 — Implementar rutas API de votación

**RF:** RF-44–RF-55.
**Dependencias:** T03.

- Crear `api/src/routes/voting.routes.js`.
- Endpoints: open/close/status/listado operativo, listado/lectura/carga/confirmación del jurado, reapertura y operaciones de omisión/subsanación.
- Autorización: ADMIN para open/close/reopen; ADMIN o VEEDOR para status; JUDGE para sus propias planillas, scores y submit; SCRUTINEER para omisiones y subsanaciones.
- Agregar códigos de error a `http-errors.js`.
- Montar en `app.js`.

**Hecho cuando:** tests de API cubren todos los endpoints, autorización y errores.

## T05 — Implementar UI planilla del jurado

**RF:** RF-46, RF-47, RF-49, RF-50.
**Dependencias:** T04.

- Crear `client/src/pages/JudgeBallotPage.jsx`.
- Lista de comparsas → ítems por especialidad → scores editables.
- Selector de score con 0 explícito (no presentado).
- Submit con validación de ítems pendientes.
- Estilos responsive en `client/src/index.css`.

**Hecho cuando:** test de cliente cubre carga, guardado, submit y rechazo por pendientes.

## T06 — Implementar UI control de votación

**RF:** RF-44, RF-51, RF-52, RF-54.
**Dependencias:** T04.

- Crear `client/src/pages/AdminVotingPage.jsx`.
- Abrir/cerrar votación por noche.
- Ver estado de planillas (conteo OPEN/SUBMITTED/REOPENED) sin puntajes.
- Reabrir planilla con motivo.
- Estilos responsive.

**Hecho.when:** test de cliente cubre open, close, status y reopen.

## T07 — Agregar tests DB de I3

**RF:** RF-44–RF-55.
**Dependencias:** T02.

- Crear `api/src/db/tests/ballots.test.js`.
- Probar creación de planillas, scores, inmutabilidad, subsanación, reapertura, auditoría y secretos.

**Hecho cuando:** `npm run db:test` pasa 15+ tests sin fallos.

## T08 — Agregar tests API de I3

**RF:** RF-44–RF-55.
**Dependencias:** T04.

- Crear `api/src/tests/voting-api.test.js`.
- Probar endpoints completos, autorización, errores y concurrencia.

**Hecho cuando:** `npm test` pasa todos los tests API sin fallos.

## T09 — Agregar tests UI de I3

**RF:** RF-44–RF-55.
**Dependencias:** T05, T06.

- Crear `client/src/tests/JudgeBallotPage.test.jsx` y `client/src/tests/AdminVotingPage.test.jsx`.

**Hecho cuando:** `npm test` en cliente pasa todos los tests.

## T10 — Validación final I3

**RF:** RNF-04, RNF-05.
**Dependencias:** T07–T09.

- Ejecutar suites completas, build, migraciones, seeds, auditoría.
- Actualizar `specs/003-votacion-planillas/validation.md`.
- Actualizar `README.md` si es necesario.
- Revisar diff, secrets y estado final.

**Hecho cuando:** todo pasa y documentación refleja el estado real.
