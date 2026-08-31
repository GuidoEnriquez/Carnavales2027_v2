# Clarificación — Spec 003: Votación — Planillas y puntuaciones

## Estado

- **Fase SDD:** I3 implementado; completitud semántica evolucionada por Spec 004.
- **Código:** planillas y puntajes; penalizaciones, offline/sync, escrutinio, resultados y actas diferidos.

## Decisiones ya resueltas

| Tema | Decisión | Impacto en spec |
|---|---|---|
| Scope I3 | Planillas, carga de scores, inmutabilidad, secreto y veedor. | Offline, penalizaciones, consolidación de resultados y actas quedan fuera. |
| Puntuaciones | La semántica de puntajes y pendientes está definida por Spec 004. | El flujo no permite omisiones operativas antes de confirmar. |
| Subsanación | Los registros existentes se conservan como historial. | El procedimiento operativo se difiere a escrutinio. |
| Reapertura | Una sola vez por planilla, solo ADMIN con 2FA, motivo obligatorio. | La planilla reabierta pasa a `REOPENED`, puede reconfirmarse. |
| Secreto | Un jurado solo ve sus scores. Admin ve estado sin puntajes. Veedor ve conteos. | No se exponen totales, rankings ni scores de otros jurados. |
| Actas | I3 no genera actas. | Queda para I5. |
| Rubros nominativos vs aleatorios | I3 no los diferencia. La distinción es relevante para I4 (penalizaciones). | Todos los rubros se puntúan igual en I3. |

## Pendientes de clarificación

1. `[RESUELTO EN I3]` Semántica exacta de una puntuación 0: se define como "no presentado / no evaluado".
2. `[DIFERIDO A ESCRUTINIO]` Subsanación: Spec 004 impide que nuevas planillas confirmadas tengan ítems sin resolver; el procedimiento reglamentario queda para su incremento propio.
3. `[DIFERIDO A I5]` Medio, formato y procedimiento de actas oficiales.
4. `[DIFERIDO A I4]` Corrección de planilla fuera de ventana: se resuelve con reapertura administrativa en I3; corrección por jurado queda fuera.

## Siguiente resolución prioritaria

Tras validar I3, el siguiente incremento (I4 — offline/sync y penalizaciones) requiere:
- Definición de rubros nominativos vs aleatorios para Goya 2027.
- Regla de mín. de integrantes por noche y rubro.
- Estrategia offline: PWA, localStorage y sincronización idempotente.
- Clarificación del>[DIFERIDO A I4]` Estrategia offline: PWA, localStorage, sync idempotente y resolución de conflictos.
