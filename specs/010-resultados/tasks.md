# Tasks — Spec 010: Resultados

## Reglas de ejecución

- Implementar una sola tarea por vez y verificarla antes de avanzar.
- No modificar voto/planilla ni ampliar penalizaciones, actas u offline.
- El criterio 1 de desempate está confirmado por Confluence C2. No modificar el alcance del sorteo ceremonial, que pertenece a Spec 011.

## Estado

| Tarea | Estado | Evidencia |
|---|---|---|
| T01–T06 | Completadas históricamente | Evidencia en `validation.md`; el cierre queda reabierto por T07. |
| T07 | Pendiente | Guardia de integridad de liberación (RF-94a). |

## T01 — Servicio de consolidación de puntajes

**RF:** RF-89, RF-90.
- Agregar por rubro/comparsa las puntuaciones confirmadas (`SCORED` 1–10 y `NOT_PRESENTED` 0) de todas las noches puntuables.
- Cálculo puro y determinístico; no muta voto ni planilla.
- Manejar rubro sin puntuaciones (sin ganador/indefinido) y comparsa sin planillas confirmadas.
- Cubrir rubros nominativos y aleatorios.

**Hecho cuando:** el servicio produce puntajes acumulados correctos y un test lo verifica; no modifica datos originales.

## T02 — Servicio de resultados y ranking

**RF:** RF-91, RF-92, RF-93.
- Mejor Comparsa = suma de solo rubros nominativos.
- Ranking por rubro y ranking general (Mayor→menor).
- Resultado determinístico y reproducible.

**Hecho cuando:** tests verifican Mejor Comparsa con rubros nominativos y ranking correcto.

## T03 — Servicio de desempate (solo Mejor Comparsa)

**RF:** RF-95, RF-96.
- Secuencia reglamentaria de 3 criterios. El criterio 1 (`mayor cantidad de rubros nominativos ganados` según Confluence) queda marcado `[NECESITA ACLARACIÓN]` y aislado para confirmación.
- El criterio 3 (sorteo) con registro auditado; la autoría del sorteo (sistema vs operador) queda marcada `[NECESITA ACLARACIÓN]`.

**Hecho cuando:** los tests cubren empate parcial/persistente y el desempate solo aplica a Mejor Comparsa.

## T04 — Exposición controlada de resultados

**RF:** RF-94.
- Resultados/rankings solo visibles para roles autorizados y en la etapa autorizada (análogo al secreto pre-escrutinio existente).
- Sin exponer resultados antes de la etapa correspondiente.

**Hecho cuando:** tests de autorización verifican acceso restringido y ocultamiento pre-etapa.

## T05 — Auditoría

**RF:** RF-97.
- Registrar consolidación, ranking, resultado y desempate en auditoría append-only sin secretos.

**Hecho cuando:** tests verifican eventos de auditoría por cada operación.

## T06 — Validación final

**Dependencias:** T01–T05.
- Ejecutar suites API/DB/cliente aplicables, build y `git diff --check`.
- Documentar matriz RF→evidencia en `validation.md`.
- Confirmar ausencia de penalizaciones, actas u offline.

**Hecho cuando:** la matriz cubre RF-89 a RF-97 con evidencia real y no hay errores de diff.

## T07 — Integridad de liberación

**RF:** RF-94a.
- Antes de crear `results_release`, verificar en la misma transacción que no existen ventanas competitivas abiertas, planillas no confirmadas ni scores `PENDING` del evento.
- Responder `409 RESULTS_NOT_READY` sin revelar puntajes, jurados ni decisiones.
- Cubrir cada precondición y el camino exitoso en DB/API; repetir las suites y actualizar `validation.md`.

**Hecho cuando:** no es posible liberar ni consultar resultados parciales.
