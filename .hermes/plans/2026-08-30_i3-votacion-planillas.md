# Plan: I3 — Votación: Planillas y carga de puntuaciones

> Histórico: las decisiones de omisión y subsanación de este plan fueron reemplazadas por la Spec 004. El modelo vigente exige una decisión completa por ítem antes de confirmar; el contenido siguiente preserva el plan original y no describe rutas operativas vigentes.

## Objetivo

Un jurado habilitado puede cargar y confirmar puntuaciones por comparsa e ítem dentro de su planilla, manteniendo secreto de puntajes durante la competencia y conservando la inmutabilidad tras la confirmación.

## Decisiones clave

- Score 0 = "no presentado / no evaluado"; NULL = pendiente u omisión marcada.
- Subsanación: solo SCRUTINEER marca una omisión NULL antes de confirmar y, tras la confirmación, registra de forma separada e inmutable la subsanación reglamentaria de 5; nunca altera el voto original.
- Reapertura: una sola vez por planilla, solo ADMIN con 2FA, motivo obligatorio.
- Secreto: jurado solo ve sus scores; admin y veedor ven estado sin puntajes.
- Offline/sync, penalizaciones, resultados y actas quedan fuera de I3.

## Arquitectura

```text
api/src/modules/ballots/     # ballot-service.js (dominio de votación)
api/src/routes/voting.routes.js  # endpoints ADMIN, JUDGE, VEEDOR y SCRUTINEER
client/src/pages/JudgeBallotPage.jsx   # UI jurado
client/src/pages/AdminVotingPage.jsx   # UI admin control
```

## Modelo de datos

- `ballot`: jurado + noche + evento, estados OPEN/SUBMITTED/REOPENED.
- `ballot_score`: ballot + evaluation_item, score 0–10, status DRAFT/LOCKED.
- `ballot_audit_log`: trazabilidad de acciones sin puntajes.
- `ballot_score_subsanation`: subsanación reglamentaria inmutable, separada del voto original.

## Migraciones

- `031_add_unique_constraints.sql` a `045_enforce_ballot_score_rubric_integrity.sql`.

## Flujo

1. ADMIN abre votación → se crean planillas para jurados asignados.
2. JUDGE carga scores ítem por ítem (guardado parcial DRAFT).
3. SCRUTINEER puede marcar una omisión NULL mientras la planilla es editable.
4. JUDGE confirma → SUBMITTED → scores LOCKED.
5. SCRUTINEER registra, sin reabrir, la subsanación de 5 de una omisión confirmada.
6. Si falta ítem obligatorio → rechazo con lista de pendientes.
7. ADMIN reabre una vez → REOPENED → JUDGE puede reeditar y reconfirmar.

## Fuentes Jira

- SVC2-13: Cargar puntuaciones por comparsa
- SVC2-14: Validar carga de puntuaciones
- SVC2-26: Máquina de estados e inmutabilidad
- SVC2-27: Reglas de cierre y modificación
- SVC2-28: Auditoría y trazabilidad
- SVC2-80: Confirmar planilla de evaluación

## Validación

- DB: triggers, restricciones, inmutabilidad, subsanación.
- API: endpoints, autorización, errores, concurrencia.
- UI: planilla de jurado, control de votación.
- Build, audit, migraciones, seeds.
