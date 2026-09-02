# Validación — Spec 010: Resultados

## Estado

- Implementación base y validación automatizada completadas el 2026-09-01.
- **T07 completada y validada automáticamente:** la liberación devuelve `RESULTS_NOT_READY` sin una ventana competitiva cerrada; la suite conserva las comprobaciones de planillas y scores pendientes.
- La liberación excluye planillas `REPLACED` y sus scores pendientes: conservan historia, pero no representan un voto ni bloquean resultados.
- **Criterio 1 de desempate confirmado** (2026-09-01, responsable Guido): fuente oficial Confluence C2 «Guía del equipo» — *mayor cantidad de rubros nominativos ganados*. Implementación actual en `resolveTieBreaker` alineada.
- **Criterio 3 (sorteo):** implementado en Spec 011 «Sorteo ceremonial con conteo regresivo».
- **Cerrada el 2026-09-02.**

## Evidencia ejecutada

| Área | Comando | Resultado |
|---|---|---|
| Persistencia | `npm run db:test` en `api/` | 37 passed, 0 failed. Incluye consolidación, rankings, desempate y auditoría. |
| API | `npm test` en `api/` | 71 passed, 0 failed. Incluye liberación, consulta, autorización y secreto. |
| Cliente | `npm test` en `client/` | 53 passed, 0 failed. |
| Build | `npm run build` en `client/` | Exitoso, 48 módulos transformados. |
| Migración | `053_rubric_kind_results_stage.sql` | Aplicada; agrega `rubric_kind` y `results_release` append-only. |
| Revisión | `git diff --check` | Sin errores. |
| Revalidación T07 | `npm test` en `api/` | 78 passed, 0 failed. |
| Revalidación T07 | `npm run db:test` en `api/` | 38 passed, 0 failed. |
| Revalidación con Spec 013 | `npm test` en `api/` | 80 passed, 0 failed. `prioritized-substitutes.test.js` confirma reemplazo, cierre y liberación. |
| Cliente de resultados | `npm test` en `client/` | 69 passed, 0 failed. `AdminResultsPage` ofrece liberar y recargar resultados autorizados. |
| Build actualizado | `npm run build` en `client/` | Exitoso; 53 módulos transformados. |

## Matriz de requisitos

| Requisito | Evidencia |
|---|---|
| RF-89 acumuulación por rubro/comparsa | `fetchConsolidatedScores` sobre `SCORED`/`NOT_PRESENTED` confirmados e inmutables; `results.test.js`. |
| RF-90 ganador por rubro | `computeRubricRankings` con `winnerTroupeIds`; `results.test.js`. |
| RF-91 Mejor Comparsa solo nominativos | `computeOverallRanking` filtra `rubric_kind = NOMINATIVE`; `results.test.js`. |
| RF-92 ranking | `computeRubricRankings` y `computeOverallRanking` ordenan de mayor a menor con rank denso. |
| RF-93 reproducibilidad/determinismo | Test explícito "resultado es determinístico (RF-93)" en `results.test.js`. |
| RF-94 secreto hasta etapa autorizada | `requireResultsAccess` (ADMIN/SCRUTINEER) + `requireResultsReleased`; `results-api.test.js` verifica 403 pre-liberación y negación a VEEDOR/JUDGE. |
| RF-94a integridad de liberación | `releaseResults` bloquea ventanas abiertas o ausentes, planillas votantes no `SUBMITTED` y scores `PENDING`; excluye `REPLACED`. `results-api.test.js` y `prioritized-substitutes.test.js` verifican `RESULTS_NOT_READY` y la liberación tras reemplazo. |
| RF-95 desempate solo Mejor Comparsa | `determineBestTroupe` solo para Mejor Comparsa; `results.test.js`. |
| RF-96 secuencia de desempate | `resolveTieBreaker`: criterios 1 (conteo nominativos) y 2 (Batería), criterio 3 sorteo manual con `TIE_BREAKER_REQUIRES_MANUAL_DRAW`. |
| RF-97 trazabilidad/auditoría | `RESULTS_RELEASED`, `RESULTS_COMPUTED`, `RESULTS_TIE_BREAKER_APPLIED`; tests RF-97 cubren liberación, cómputo y desempate. |

## Dudas resueltas

- **Criterio 1 de desempate:** oficial = "mayor cantidad de rubros nominativos ganados" (Confluence). Implementación actual en `countWonNominativeRubrics` confirmada.
- **Sorteo (criterio 3):** se difiere a Spec 011 «Sorteo ceremonial con conteo regresivo». Hasta su aprobación, `resolveTieBreaker` arroja `TIE_BREAKER_REQUIRES_MANUAL_DRAW` y exige registro por el operador autorizado; el sistema no genera aleatoriedad.

## Límites de validación

- No se validó penalizaciones, actas con hash, offline-first ni publicación externa (fuera de alcance).
- No se modificaron votos ni planillas confirmadas; los cálculos son de solo lectura.
