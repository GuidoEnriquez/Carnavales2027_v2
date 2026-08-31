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
| Migración de datos | La migración es incremental y no reescribe scores, auditoría ni subsanaciones históricas. |

El diálogo usa el estado cargado de la planilla para prevenir un envío evitable. `BALLOT_INCOMPLETE` continúa siendo la validación autoritativa del servidor para estados desactualizados y se representa con el mismo diálogo.

## Riesgo de fuente

El repositorio no contiene el Reglamento de Carnavales 2027. La decisión de producto se implementa bajo esta spec y debe contrastarse con el texto reglamentario cuando esté disponible. Si el reglamento exige una excepción adicional, debe abrirse una nueva clarificación antes de alterar este flujo.
