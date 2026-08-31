# Clarificaciones - Spec 004: Completitud obligatoria de planillas

## Decisiones resueltas

| Tema | Decisión |
|---|---|
| Estado semántico | `PENDING`, `SCORED` y `NOT_PRESENTED` son exhaustivos para nuevas planillas. |
| Estado técnico | `DRAFT` y `LOCKED` mantienen la mutabilidad; no expresan una decisión del jurado. |
| Escala ordinaria | Solo enteros 1 a 10. |
| Cero | Solo `NOT_PRESENTED`, registrado por acción explícita y no como opción de la escala. |
| Pendiente | `PENDING` almacena `NULL` y bloquea confirmar/cerrar. |
| Modal de pendientes | `Confirmar planilla` sigue habilitado; al pulsarlo con pendientes abre un diálogo modal y no envía la confirmación. El diálogo lista comparsa, rubro e ítem, se cierra con acción explícita o `Escape`, recibe el foco y lo devuelve al botón disparador. |
| Corrección previa | El jurado puede quitar una decisión y volver a `PENDING` mientras la planilla sea editable. |
| Subsanación | No forma parte del flujo de nuevas planillas. La entidad histórica se conserva y el procedimiento operativo queda para el incremento de escrutinio. |
| `5 por equidad` | No está implementado ni disponible. El reglamento vigente todavía lo contempla y su eventual eliminación para nuevas planillas digitales requiere una resolución formal pendiente de la COC. |
| Migración de datos | La migración es incremental y no reescribe scores, auditoría ni subsanaciones históricas. |

El diálogo usa el estado cargado de la planilla para prevenir un envío evitable. `BALLOT_INCOMPLETE` continúa siendo la validación autoritativa del servidor para estados desactualizados y se representa con el mismo diálogo.

## Riesgo de fuente

El repositorio no contiene el Reglamento de Carnavales 2027 ni la resolución COC pendiente. Cuando exista, debe incorporarse con identificador o número, fecha, autoridad aprobatoria, texto o regla aprobada y referencia al acta o documento de respaldo. Hasta entonces, no se declara eliminado el `5 por equidad` ni se altera este flujo. El core técnico de I4-A Offline-First queda separado: puede sincronizar únicamente los estados ya definidos por esta spec, sin crear ni resolver subsanaciones.
