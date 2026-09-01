# Validación — Spec 010: Resultados

## Estado

- **Implementación y validación automatizada completadas:** 2026-09-01.
- Pendiente: confirmación por el responsable del criterio 1 de desempate `[NECESITA ACLARACIÓN]` y de la autoría del sorteo (criterio 3).

## Evidencia ejecutada

| Área | Comando | Resultado |
|---|---|---|
| Persistencia | `npm run db:test` en `api/` | 37 passed, 0 failed. Incluye consolidación, rankings, desempate y auditoría. |
| API | `npm test` en `api/` | 71 passed, 0 failed. Incluye liberación, consulta, autorización y secreto. |
| Cliente | `npm test` en `client/` | 53 passed, 0 failed. |
| Build | `npm run build` en `client/` | Exitoso, 48 módulos transformados. |
| Migración | `053_rubric_kind_results_stage.sql` | Aplicada; agrega `rubric_kind` y `results_release` append-only. |
| Revisión | `git diff --check` | Sin errores. |

## Matriz de requisitos

| Requisito | Evidencia |
|---|---|
| RF-89 acumuulación por rubro/comparsa | `fetchConsolidatedScores` sobre `SCORED`/`NOT_PRESENTED` confirmados e inmutables; `results.test.js`. |
| RF-90 ganador por rubro | `computeRubricRankings` con `winnerTroupeIds`; `results.test.js`. |
| RF-91 Mejor Comparsa solo nominativos | `computeOverallRanking` filtra `rubric_kind = NOMINATIVE`; `results.test.js`. |
| RF-92 ranking | `computeRubricRankings` y `computeOverallRanking` ordenan de mayor a menor con rank denso. |
| RF-93 reproducibilidad/determinismo | Test explícito "resultado es determinístico (RF-93)" en `results.test.js`. |
| RF-94 secreto hasta etapa autorizada | `requireResultsAccess` (ADMIN/SCRUTINEER) + `requireResultsReleased`; `results-api.test.js` verifica 403 pre-liberación y negación a VEEDOR/JUDGE. |
| RF-95 desempate solo Mejor Comparsa | `determineBestTroupe` solo para Mejor Comparsa; `results.test.js`. |
| RF-96 secuencia de desempate | `resolveTieBreaker`: criterios 1 (conteo nominativos) y 2 (Batería), criterio 3 sorteo manual con `TIE_BREAKER_REQUIRES_MANUAL_DRAW`. |
| RF-97 trazabilidad/auditoría | `RESULTS_RELEASED`, `RESULTS_COMPUTED`, `RESULTS_TIE_BREAKER_APPLIED`; tests RF-97 cubren liberación, cómputo y desempate. |

## Dudas pendientes de confirmación

- **Criterio 1 de desempate:** implementada la interpretación de Confluence ("cantidad de rubros nominativos ganados"). Si el oficial es el de Obsidian ("suma de rubros nominativos"), ajustar `resolveTieBreaker`.
- **Sorteo (criterio 3):** implementado como error `TIE_BREAKER_REQUIRES_MANUAL_DRAW` para registro manual, sin generar aleatoriedad por sistema. Si el oficial es sorteo automático auditable, implementarlo en un ajuste.

## Límites de validación

- No se validó penalizaciones, actas con hash, offline-first ni publicación externa (fuera de alcance).
- No se modificaron votos ni planillas confirmadas; los cálculos son de solo lectura.