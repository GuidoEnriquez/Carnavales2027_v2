# Spec 003 — Votación: planillas y carga de puntuaciones

## Estado

- **Fase SDD:** I3 implementado; completitud semántica evolucionada por Spec 004 y reapertura reemplazada por Spec 006.
- **Implementación:** planillas y puntuaciones; Offline-First se implementa exclusivamente en Spec 005. Penalizaciones, escrutinio, resultados y actas continúan diferidos.
- **Fuentes:** `docs/source-map.md`, RF-07–RF-12 y RF-16 de Spec 001, Jira SVC2-13, SVC2-14, SVC2-26, SVC2-27, SVC2-28, SVC2-80.

## Objetivo general

Permitir que un jurado habilitado cargue puntuaciones por comparsa e ítem dentro de su planilla, confirme la planilla y la vuelva inmutable, preservando secreto de puntajes durante la competencia y trazando toda acción en auditoría.

## Incremento I3 — Planillas y carga de puntuaciones

**Objetivo histórico:** un ADMIN abre la ventana de votación por noche; un jurado asignado carga y confirma sus puntuaciones; la planilla confirmada queda inmutable. Spec 006 elimina la reapertura administrativa para nuevas transiciones.

**Incluye:**

- Planilla (`ballot`) por jurado y noche con estados `OPEN`, `SUBMITTED`, `REOPENED`.
- Puntuación (`ballot_score`) por ítem evaluable; su modelo semántico definitivo está en Spec 004.
- Impedimento de confirmar con ítems obligatorios sin resolver.
- Planilla confirmada = inmutable.
- Reapertura por ADMIN una sola vez con motivo y auditoría (reemplazada por Spec 006).
- Ventana de votación persistida por noche; una vez cerrada no vuelve a abrirse.
- Secreto de puntajes durante competencia: un jurado solo ve los suyos.
- Veedor: ve estado operativo de planillas sin puntajes.

**Excluye:** offline/sync; penalizaciones; escrutinio; resultados; actas; sorteo de orden; ventanas temporales avanzadas.

## Requisitos funcionales I3

- **RF-44.** EL SISTEMA DEBE crear una planilla por cada jurado con asignación activa al abrir la ventana de votación de una noche.
- **RF-45.** CADA planilla DEBE identificar jurado, noche, evento, especialidad y asignación, y DEBE comenzar en estado `OPEN`.
- **RF-46.** EL SISTEMA DEBE mostrar al jurado únicamente los ítems evaluable activos de su especialidad para cada comparsa programada en la noche.
- **RF-47.** Evolucionado por RF-57 a RF-65 de Spec 004.
- **RF-48.** La subsanación operativa queda diferida al incremento de escrutinio; se conservan sus datos históricos.
- **RF-49.** Evolucionado por RF-61 de Spec 004.
- **RF-50.** CUANDO un jurado confirme una planilla, EL SISTEMA DEBE pasar su estado a `SUBMITTED` y volver todos sus scores inmutables.
- **RF-51.** MIENTRAS se realiza la competencia, EL SISTEMA NO DEBE exponer puntajes de otros jurados, totales, rankings ni resultados preliminares a ningún actor.
- **RF-52.** Reemplazado por RF-67 y RF-68 de Spec 006: no se permiten nuevas reaperturas.
- **RF-52a.** Reemplazado por Spec 006; las subsanaciones históricas permanecen inmutables.
- **RF-53.** EL SISTEMA DEBE registrar en auditoría apertura, guardado parcial, confirmación y reapertura de cada planilla, sin incluir los puntajes en el registro.
- **RF-54.** EL VECEDOR DEBE poder ver el estado de las planillas por noche (conteo de OPEN, SUBMITTED, REOPENED) sin acceder a puntajes.
- **RF-55.** I3 NO DEBE implementar offline/sync, penalizaciones, consolidación de resultados ni actas. El registro reglamentario de subsanaciones no calcula ni expone resultados.
- **RF-56.** Diferido al incremento de escrutinio; los registros existentes se mantienen inmutables.

## Contratos HTTP I3

- `POST /api/v1/events/:eventId/nights/:nightId/voting/open`: abre ventana de votación (ADMIN).
- `POST /api/v1/events/:eventId/nights/:nightId/voting/close`: cierra ventana de votación (ADMIN).
- `GET /api/v1/events/:eventId/nights/:nightId/voting/status`: estado de la ventana y conteo de planillas (ADMIN/VEEDOR).
- `GET /api/v1/events/:eventId/nights/:nightId/voting/ballots`: lista operativa de planillas sin puntajes (ADMIN).
- `GET /api/v1/judge/ballots`: lista de planillas propias (JUDGE).
- `GET /api/v1/judge/ballots/:ballotId`: planilla del jurado con ítems y scores (JUDGE).
- `PUT /api/v1/judge/ballots/:ballotId/scores/:scoreId`: guardar puntuación de un ítem (JUDGE).
- `POST /api/v1/judge/ballots/:ballotId/submit`: confirmar planilla (JUDGE).
- El endpoint de reapertura fue retirado por Spec 006.

## Alcance confirmado

- La identidad y sesión continúan bajo Better Auth; roles y relaciones de dominio permanecen separados.
- Todos los accesos protegidos requieren 2FA verificado.
- Un jurado sin asignación activa no puede acceder a ninguna planilla.
- Una planilla confirmada no vuelve a editarse. Las planillas históricas ya `REOPENED` solo pueden finalizar en `SUBMITTED`.
- Los registros históricos de subsanación no modifican una planilla confirmada y bloquean su reapertura.
- Los puntajes son secretos durante la competencia para todos excepto el jurado titular.

## Criterios de aceptación I3

- Un jurado solo ve sus propios ítems y scores.
- Un jurado no puede confirmar con ítems obligatorios pendientes.
- Una planilla confirmada es inmutable.
- No existe control ni endpoint para reabrir una planilla.
- La auditoría registra cada acción sin exponer puntajes.
- No existen rutas de offline/sync, penalizaciones, consolidación de resultados ni actas como resultado de I3.
