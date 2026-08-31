# Clarificaciones - Spec 006: Cierre de votacion sin reapertura

## Decisiones resueltas

| Tema | Decision |
|---|---|
| Reapertura | No se permiten nuevas reaperturas de planillas confirmadas. |
| Planillas historicas | Una planilla que ya estaba `REOPENED` puede solo volver a `SUBMITTED`; no puede iniciarse otra reapertura. |
| Pendientes al cerrar | Bloquean el cierre; no se convierten automaticamente en ausencia ni en `NOT_PRESENTED`. |
| Aviso | ADMIN recibe un modal con jurado, comparsa, rubro e item por cada pendiente, para localizar el voto faltante. |
| Audiencia | El modal pertenece al control administrativo de cierre; no expone valores de puntajes. |
| Accesibilidad | El modal conserva foco, cierre explicito y con `Escape`, retorno al disparador y lista desplazable. |

## Riesgo de fuente

El reglamento formal no esta distribuido en el repositorio. Esta decision de producto no modifica la semantica de `PENDING`, `SCORED` y `NOT_PRESENTED` ni implementa subsanaciones. Si una fuente reglamentaria exigiera corregir una planilla confirmada, debe registrarse en un incremento SDD posterior antes de restaurar cualquier mecanismo de reapertura.
