# Plan - Completitud obligatoria de planillas

## Objetivo

Hacer explícita la decisión de cada ítem de planilla y bloquear toda confirmación o cierre que conserve pendientes.

## Diseño

1. Agregar `evaluation_state` a `ballot_score` mediante migraciones incrementales 046-047; conservar `status` como mutabilidad técnica y normalizar omisiones editables heredadas a `PENDING`.
2. Backfill: score `NULL` pasa a `PENDING`, score 1-10 a `SCORED` y score 0 a `NOT_PRESENTED`; datos históricos con subsanación se preservan sin crear nuevos flujos.
3. Validar en trigger que estado y score siempre coincidan, incluidos cambios directos en base de datos y reaperturas.
4. Cambiar la API de guardado a una transición semántica explícita y retirar las rutas de omisión/subsanación.
5. Cambiar la UI a botones de 1-10, acción separada de no presentación y acción explícita para quitar una decisión.
6. Actualizar confirmación/cierre para consultar `evaluation_state = 'PENDING'`.
7. Cubrir migración, base de datos, API, UI y regresiones; documentar resultados reales.

## Riesgos controlados

- No modificar migraciones 001-045 ya aplicadas.
- No convertir ni eliminar datos históricos de subsanación.
- No implementar cálculos ni nuevos workflows de escrutinio.
