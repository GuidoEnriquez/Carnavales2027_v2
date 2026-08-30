# Clarificación — Spec 003: Votación — Planillas y puntuaciones

## Estado

- **Fase SDD:** I3 en implementación y validación final.
- **Código:** planillas, puntajes y subsanaciones reglamentarias; penalizaciones, offline/sync, resultados y actas diferidos.

## Decisiones ya resueltas

| Tema | Decisión | Impacto en spec |
|---|---|---|
| Scope I3 | Planillas, carga de scores, inmutabilidad, secreto, veedor y subsanaciones reglamentarias. | Offline, penalizaciones, consolidación de resultados y actas quedan fuera. |
| Score 0 | Reservado exclusivamente para "no presentado / no evaluado". NULL = pendiente u omisión marcada. | El selector del jurado ofrece 0 de forma explícita; nunca es default y no puede subsanarse. |
| Omisión | Score NULL con `requires_subsanation = true`. | Solo `SCRUTINEER` puede marcarla mientras la planilla está editable; el jurado no puede hacerlo. |
| Subsanación | Un `SCRUTINEER` registra 5 puntos en una entidad separada sobre una omisión de planilla `SUBMITTED`. | No modifica el score NULL ni reabre la planilla; el registro es auditable e inmutable. |
| Reapertura | Una sola vez por planilla, solo ADMIN con 2FA, motivo obligatorio. | La planilla reabierta pasa a `REOPENED`, puede reconfirmarse. |
| Secreto | Un jurado solo ve sus scores. Admin ve estado sin puntajes. Veedor ve conteos. | No se exponen totales, rankings ni scores de otros jurados. |
| Rol de escrutinio | `SCRUTINEER` es un rol de aplicación separado, sin autoasignación pública. | Todas sus rutas requieren 2FA; no hereda permisos de ADMIN, JUDGE ni VEEDOR. |
| Actas | I3 no genera actas. | Queda para I5. |
| Rubros nominativos vs aleatorios | I3 no los diferencia. La distinción es relevante para I4 (penalizaciones). | Todos los rubros se puntúan igual en I3. |

## Pendientes de clarificación

1. `[RESUELTO EN I3]` Semántica exacta de una puntuación 0: se define como "no presentado / no evaluado".
2. `[RESUELTO EN I3]` Subsanación: solo omisiones NULL marcadas por `SCRUTINEER`; se registra en forma separada e inmutable con valor reglamentario 5 tras la confirmación.
3. `[DIFERIDO A I5]` Medio, formato y procedimiento de actas oficiales.
4. `[DIFERIDO A I4]` Corrección de planilla fuera de ventana: se resuelve con reapertura administrativa en I3; corrección por jurado queda fuera.

## Siguiente resolución prioritaria

Tras validar I3, el siguiente incremento (I4 — offline/sync y penalizaciones) requiere:
- Definición de rubros nominativos vs aleatorios para Goya 2027.
- Regla de mín. de integrantes por noche y rubro.
- Estrategia offline: PWA, localStorage y sincronización idempotente.
- Clarificación del>[DIFERIDO A I4]` Estrategia offline: PWA, localStorage, sync idempotente y resolución de conflictos.
