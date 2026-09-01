# Plan - Completitud obligatoria de planillas

> Histórico: el punto 5 fue reemplazado por Spec 007 el 2026-09-01. Las decisiones confirmadas ya no pueden volver a `PENDING`.

## Objetivo

Hacer explícita la decisión de cada ítem de planilla y bloquear toda confirmación o cierre que conserve pendientes.

## Diseño

1. Agregar `evaluation_state` a `ballot_score` mediante migraciones incrementales 046-047; conservar `status` como mutabilidad técnica y normalizar omisiones editables heredadas a `PENDING`.
2. Backfill: score `NULL` pasa a `PENDING`, score 1-10 a `SCORED` y score 0 a `NOT_PRESENTED`; datos históricos con subsanación se preservan sin crear nuevos flujos.
3. Validar en trigger que estado y score siempre coincidan, incluidos cambios directos en base de datos. Las nuevas reaperturas fueron retiradas posteriormente por Spec 006.
4. Cambiar la API de guardado a una transición semántica explícita y retirar las rutas de omisión/subsanación.
5. Histórico: cambiar la UI a botones de 1-10, acción separada de no presentación y acción explícita para quitar una decisión. Spec 007 retiró posteriormente esa acción.
6. Actualizar confirmación/cierre para consultar `evaluation_state = 'PENDING'`.
7. Cubrir migración, base de datos, API, UI y regresiones; documentar resultados reales.
8. En la planilla del jurado, interceptar localmente la confirmación con pendientes y mostrar un diálogo modal accesible con comparsa, rubro e ítem. Mantener la respuesta `BALLOT_INCOMPLETE` del servidor como defensa ante estado desactualizado.
9. Validar foco, cierre explícito y con `Escape`, retorno al disparador, lista extensa y viewports móvil, tablet y desktop.

## Riesgos controlados

- No modificar migraciones 001-045 ya aplicadas.
- No convertir ni eliminar datos históricos de subsanación.
- No implementar cálculos ni nuevos workflows de escrutinio.
