# Spec 003 — Votación: planillas y carga de puntuaciones

## Estado

- **Fase SDD:** I3 en implementación y validación final.
- **Implementación:** planillas, puntuaciones y subsanaciones reglamentarias; módulos de penalizaciones, offline/sync, resultados y actas diferidos.
- **Fuentes:** `docs/source-map.md`, RF-07–RF-12 y RF-16 de Spec 001, Jira SVC2-13, SVC2-14, SVC2-26, SVC2-27, SVC2-28, SVC2-80.

## Objetivo general

Permitir que un jurado habilitado cargue puntuaciones por comparsa e ítem dentro de su planilla, confirme la planilla y la vuelva inmutable, preservando secreto de puntajes durante la competencia y trazando toda acción en auditoría.

## Incremento I3 — Planillas y carga de puntuaciones

**Objetivo:** un ADMIN abre la ventana de votación por noche; un jurado asignado carga y confirma sus puntuaciones; la planilla confirmada queda inmutable; un ADMIN puede reabrirla una sola vez con motivo.

**Incluye:**

- Planilla (`ballot`) por jurado y noche con estados `OPEN`, `SUBMITTED`, `REOPENED`.
- Puntuación (`ballot_score`) por ítem evaluable con score 0–10.
- Score 0 reservado para "no presentado / no evaluado"; NULL = pendiente.
- Omisión marcada: score NULL con `requires_subsanation = true`; la marca solo la registra un `SCRUTINEER`.
- Subsanación reglamentaria: un `SCRUTINEER` registra de forma separada, auditable e inmutable los 5 puntos de una omisión en una planilla confirmada, sin modificar el voto original.
- Impedimento de confirmar con ítems obligatorios sin resolver.
- Planilla confirmada = inmutable.
- Reapertura por ADMIN una sola vez con motivo y auditoría.
- Ventana de votación persistida por noche; una vez cerrada no vuelve a abrirse.
- Secreto de puntajes durante competencia: un jurado solo ve los suyos.
- Veedor: ve estado operativo de planillas sin puntajes.
- Rol `SCRUTINEER`, limitado a registrar omisiones y subsanaciones; no puede alterar votos del jurado.

**Excluye:** offline/sync; penalizaciones; escrutinio; resultados; actas; sorteo de orden; ventanas temporales avanzadas.

## Requisitos funcionales I3

- **RF-44.** EL SISTEMA DEBE crear una planilla por cada jurado con asignación activa al abrir la ventana de votación de una noche.
- **RF-45.** CADA planilla DEBE identificar jurado, noche, evento, especialidad y asignación, y DEBE comenzar en estado `OPEN`.
- **RF-46.** EL SISTEMA DEBE mostrar al jurado únicamente los ítems evaluable activos de su especialidad para cada comparsa programada en la noche.
- **RF-47.** EL JURADO DEBE poder puntuar cada ítem en escala de 0 a 10; el valor 0 DEBE estar reservado para "no presentado" y no ser el valor por defecto.
- **RF-48.** SI un ítem queda omitido (score = NULL), ENTONCES solo un `SCRUTINEER` puede registrarlo como omisión con `requires_subsanation = true` mientras la planilla está editable. El score 0 no es elegible porque representa "no presentado".
- **RF-49.** CUANDO un jurado intente confirmar una planilla con ítems obligatorios sin resolver, EL SISTEMA DEBE rechazar la operación e informar los ítems pendientes, excepto los marcados como omisión por un `SCRUTINEER`. El cierre administrativo de votación también DEBE rechazar planillas `OPEN` o `REOPENED` con ítems pendientes.
- **RF-50.** CUANDO un jurado confirme una planilla, EL SISTEMA DEBE pasar su estado a `SUBMITTED` y volver todos sus scores inmutables.
- **RF-51.** MIENTRAS se realiza la competencia, EL SISTEMA NO DEBE exponer puntajes de otros jurados, totales, rankings ni resultados preliminares a ningún actor.
- **RF-52.** UN ADMIN CON 2FA DEBE poder reabrir una planilla confirmada una sola vez, con motivo obligatorio y auditoría; la planilla reabierta pasa a `REOPENED` y puede editarse y reconfirmarse.
- **RF-52a.** UNA planilla con subsanación registrada NO DEBE poder reabrirse.
- **RF-53.** EL SISTEMA DEBE registrar en auditoría apertura, guardado parcial, confirmación y reapertura de cada planilla, sin incluir los puntajes en el registro.
- **RF-54.** EL VECEDOR DEBE poder ver el estado de las planillas por noche (conteo de OPEN, SUBMITTED, REOPENED) sin acceder a puntajes.
- **RF-55.** I3 NO DEBE implementar offline/sync, penalizaciones, consolidación de resultados ni actas. El registro reglamentario de subsanaciones no calcula ni expone resultados.
- **RF-56.** SOLO un `SCRUTINEER` con 2FA puede registrar una subsanación reglamentaria de 5 puntos para una omisión de una planilla `SUBMITTED`; la subsanación debe ser un registro separado, auditable e inmutable y no puede modificar el score NULL, estado ni contenido del voto original.

## Contratos HTTP I3

- `POST /api/v1/events/:eventId/nights/:nightId/voting/open`: abre ventana de votación (ADMIN).
- `POST /api/v1/events/:eventId/nights/:nightId/voting/close`: cierra ventana de votación (ADMIN).
- `GET /api/v1/events/:eventId/nights/:nightId/voting/status`: estado de la ventana y conteo de planillas (ADMIN/VEEDOR).
- `GET /api/v1/events/:eventId/nights/:nightId/voting/ballots`: lista operativa de planillas sin puntajes (ADMIN).
- `GET /api/v1/judge/ballots`: lista de planillas propias (JUDGE).
- `GET /api/v1/judge/ballots/:ballotId`: planilla del jurado con ítems y scores (JUDGE).
- `PUT /api/v1/judge/ballots/:ballotId/scores/:scoreId`: guardar puntuación de un ítem (JUDGE).
- `POST /api/v1/judge/ballots/:ballotId/submit`: confirmar planilla (JUDGE).
- `POST /api/v1/events/:eventId/ballots/:ballotId/reopen`: reabrir planilla (ADMIN).
- `POST /api/v1/scrutiny/ballots/:ballotId/scores/:scoreId/omissions`: marcar una omisión NULL antes de confirmar (SCRUTINEER).
- `POST /api/v1/scrutiny/ballots/:ballotId/scores/:scoreId/subsanations`: registrar una subsanación de 5 sobre una omisión confirmada (SCRUTINEER).

## Alcance confirmado

- La identidad y sesión continúan bajo Better Auth; roles y relaciones de dominio permanecen separados.
- Todos los accesos protegidos requieren 2FA verificado.
- Un jurado sin asignación activa no puede acceder a ninguna planilla.
- Una planilla confirmada solo cambia por reapertura administrativa auditada.
- El `SCRUTINEER` no modifica una planilla confirmada: agrega una subsanación reglamentaria separada e inmutable.
- Los puntajes son secretos durante la competencia para todos excepto el jurado titular.

## Criterios de aceptación I3

- Un jurado solo ve sus propios ítems y scores.
- Un jurado no puede confirmar con ítems obligatorios pendientes.
- Una planilla confirmada es inmutable.
- Un ADMIN puede reabrir solo una vez con motivo.
- La auditoría registra cada acción sin exponer puntajes.
- No existen rutas de offline/sync, penalizaciones, consolidación de resultados ni actas como resultado de I3.
