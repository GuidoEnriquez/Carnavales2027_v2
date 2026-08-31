# Clarificación — Spec 003: Votación — Planillas y puntuaciones

## Estado

- **Fase SDD:** I3 implementado; completitud semántica evolucionada por Spec 004 y reapertura reemplazada por Spec 006.
- **Código:** planillas y puntajes; Offline-First se implementa exclusivamente en Spec 005. Penalizaciones, escrutinio, resultados y actas continúan diferidos.

## Decisiones ya resueltas

| Tema | Decisión | Impacto en spec |
|---|---|---|
| Scope I3 | Planillas, carga de scores, inmutabilidad, secreto y veedor. | Offline-First se implementó posteriormente en Spec 005; penalizaciones, consolidación de resultados y actas siguen fuera de alcance. |
| Puntuaciones | La semántica de puntajes y pendientes está definida por Spec 004. | El flujo no permite omisiones operativas antes de confirmar. |
| Subsanación | Los registros existentes se conservan como historial. | El procedimiento operativo se difiere a escrutinio. |
| Reapertura | Reemplazada por Spec 006. | No se permiten reaperturas nuevas; las históricas pueden finalizar. |
| Secreto | Un jurado solo ve sus scores. Admin ve estado sin puntajes. Veedor ve conteos. | No se exponen totales, rankings ni scores de otros jurados. |
| Actas | I3 no genera actas. | Quedan para un incremento SDD posterior. |
| Rubros nominativos vs aleatorios | I3 no los diferencia. La distinción queda pendiente para un futuro incremento de penalizaciones. | Todos los rubros se puntúan igual en I3. |

## Pendientes de clarificación

1. `[RESUELTO EN I3]` Semántica exacta de una puntuación 0: se define como "no presentado / no evaluado".
2. `[DIFERIDO A ESCRUTINIO]` Subsanación: Spec 004 impide que nuevas planillas confirmadas tengan ítems sin resolver; el procedimiento reglamentario queda para su incremento propio.
3. `[DIFERIDO A I5]` Medio, formato y procedimiento de actas oficiales.
4. `[REEMPLAZADO POR SPEC 006]` No existe corrección por reapertura, dentro ni fuera de la ventana; una planilla confirmada no vuelve a editarse.

## Estado posterior de decisiones históricas

- Offline-First y sincronización idempotente se implementaron exclusivamente en Spec 005.
- La definición de rubros nominativos o aleatorios y la regla de mínimo de integrantes por noche y rubro siguen pendientes para un incremento SDD de penalizaciones.
