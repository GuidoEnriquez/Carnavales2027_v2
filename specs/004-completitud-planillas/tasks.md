# Tasks - Spec 004: Completitud obligatoria de planillas

## Estado general

| ID | Estado | Dependencias |
|---|---|---|
| T01-T06 | Completadas | Spec y clarificaciones aprobadas |

## T01 - Migrar estado semántico de score

**RF:** RF-57, RF-58, RF-64, RF-65.

- Crear migraciones incrementales 046-047 con `evaluation_state`, backfill no destructivo y normalización de omisiones editables heredadas.
- Reemplazar guards afectados para exigir las combinaciones estado/score y preservar inmutabilidad.
- Mantener datos y tablas históricas de subsanación sin escrituras nuevas.

**Hecho cuando:** pruebas DB cubren las tres combinaciones válidas, rechazan las inválidas y preservan registros históricos.

## T02 - Adaptar servicio y contratos de votación

**RF:** RF-57, RF-58, RF-61, RF-63, RF-65.

- Actualizar creación, lectura, guardado, confirmación y cierre para usar `evaluation_state`.
- Retirar el flujo operativo de omisión/subsanación y sus rutas.
- Emitir códigos de error estables para transiciones inválidas.

**Hecho cuando:** pruebas API cubren estados, acceso propio, confirmación, cierre con contexto de ítem/jurado/comparsa y ausencia de rutas retiradas.

## T03 - Adaptar UI de planilla

**RF:** RF-59, RF-60, RF-62.

- Reemplazar el selector que incluía 0 por controles 1-10, `No se presentó` y `Quitar decisión`.
- Representar visualmente los tres estados y los pendientes de confirmación.
- Conservar uso táctil y responsive.

**Hecho cuando:** pruebas de cliente cubren escala, acción independiente, retorno a pendiente y confirmación bloqueada.

## T04 - Actualizar pruebas de regresión

**RF:** RF-57-RF-65, RNF-04.

- Ampliar pruebas DB/API/UI y runner de migraciones.
- Eliminar expectativas del flujo de omisión pre-confirmación.

**Hecho cuando:** suites específicas pasan y las reglas críticas tienen evidencia automatizada.

## T05 - Actualizar documentación

**RF:** RNF-05.

- Actualizar README, Spec 003, mapa de fuentes y evidencia de validación.
- Mantener la Spec 004 como fuente del cambio y registrar el riesgo de ausencia del reglamento local.

**Hecho cuando:** documentación y contratos reflejan exactamente el comportamiento implementado.

## T06 - Validación final

**Dependencias:** T01-T05.

- Ejecutar pruebas API, DB y cliente; build; estado de migraciones; diff check.
- Revisar que no se incorporen offline/sync ni escrutinio operativo.

**Hecho cuando:** toda la matriz RF tiene evidencia real y no hay errores en el diff.
