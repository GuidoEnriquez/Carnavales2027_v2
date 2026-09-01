# Validación - Spec 004: Completitud obligatoria de planillas

## Estado

- **Validado:** 2026-08-31.
- **Aceptado:** 2026-08-31.
- **Resultado:** modelo semántico, API, interfaz y documentación actualizados sin fallos; el jurado recibe un diálogo modal accesible al intentar confirmar con pendientes.

## Evidencia ejecutada

| Área | Comando | Resultado |
|---|---|---|
| API | `npm test` en `api/` | 57 passed, 0 failed |
| Persistencia | `npm run db:test` en `api/` | 26 passed, 0 failed |
| Cliente | `npm test` en `client/` | 46 passed, 0 failed |
| Build | `npm run build` en `client/` | exitoso, 45 módulos transformados |
| Migraciones | `npm run db:migrate -- --status` | 001-047 aplicadas, sin pendientes |

## Matriz de requisitos

| Requisito | Evidencia |
|---|---|
| RF-57, RF-58 | Migraciones 046-047 y `ballots.test.js` prueban `PENDING`/NULL, `SCORED`/1-10 y `NOT_PRESENTED`/0, además de combinaciones inválidas rechazadas. |
| RF-59, RF-60 | `JudgeBallotPage.jsx` y su prueba muestran botones 1-10 y la acción separada `No se presentó`; 0 no aparece como puntuación ordinaria. |
| RF-61 | `voting-api.test.js` comprueba que la confirmación y el cierre rechazan ítems pendientes y devuelven ítem, jurado y comparsa; `AdminVotingPage.test.jsx` verifica que ADMIN recibe ese detalle. |
| RF-62 | Evidencia histórica. El requisito queda derogado por Spec 007; `JudgeBallotPage.test.jsx` ahora verifica la confirmación e inmutabilidad por ítem. |
| RF-63 | `ballot-service.js` registra `SCORE_DECISION_SAVED` con actor y `scoreId`, sin el valor del score. |
| RF-64 | Migraciones 035-046 y Spec 006 preservan inmutabilidad; `049_disable_ballot_reopen.sql` impide nuevas reaperturas y permite finalizar solo registros históricos `REOPENED`. |
| RF-65 | Las dos rutas de omisión/subsanación ya no están montadas; migración 047 normaliza borradores heredados y permite resolverlos sin modificar la historia bloqueada. |
| RF-66 | `JudgeBallotPage.test.jsx` verifica que el diálogo enumera todos los pendientes con comparsa, rubro e ítem, evita el envío local, cierra por evento `cancel` y devuelve el foco al disparador. El error `BALLOT_INCOMPLETE` del servidor abre el mismo diálogo. Los estilos limitan ancho y alto con unidades fluidas, ofrecen scroll para listas extensas y ajustan el diálogo a pantallas de hasta 36rem. |

## Notas

- La migración 046 desactiva triggers de usuario únicamente durante su backfill transaccional y los reactiva antes de aplicar la constraint y el guard final. La 047 normaliza solo omisiones heredadas que aún estaban en `DRAFT`; los registros bloqueados permanecen históricos.
- La regla de subsanación "5 por equidad" no forma parte de la implementación validada. Por decisión de producto del 2026-09-01, es nula para planillas digitales porque la prevención de omisiones elimina su causa técnica.
- Offline/sync, resultados, penalizaciones, escrutinio operativo y actas continúan fuera de alcance.
