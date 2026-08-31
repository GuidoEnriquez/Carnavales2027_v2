# Estado SDD — Carnavales2027_v2

> Estado actualizado: 2026-08-31. Esta nota resume el estado de los incrementos; las specs y validaciones son la evidencia detallada.

## Incrementos completados

| Incremento | Alcance validado | Evidencia principal |
|---|---|---|
| I1 / I1-C | Configuración de eventos, jornadas, catálogos, readiness, apertura transaccional, 2FA/ADMIN y auditoría administrativa. | `specs/001-plataforma-votacion-carnavales/validation.md` |
| I2-A | Padrón de jurados, invitaciones, aceptación, 2FA y suspensión. | `specs/002-jurados-asignaciones/validation.md` |
| I2-B | Cupos, asignaciones, reemplazos y concurrencia. | `specs/002-jurados-asignaciones/validation.md` |
| I3 | Planillas, puntajes, secreto, confirmación e inmutabilidad; la reapertura histórica fue reemplazada por Spec 006. | `specs/003-votacion-planillas/validation.md` |
| Spec 004 | IMPLEMENTADA y VALIDADA: estados `PENDING`/`SCORED`/`NOT_PRESENTED`, completitud obligatoria y diálogo modal de pendientes para el jurado. Aceptada. | `specs/004-completitud-planillas/validation.md` |
| I4-A / Spec 005 | Offline-First para las decisiones ya válidas de planillas. Implementado y validado automáticamente; resta validación manual de PWA, sesión/2FA y viewports. | `specs/005-offline-first/validation.md` |
| Spec 006 | Implementada y validada automáticamente: sin nuevas reaperturas; el cierre con pendientes muestra un diálogo modal administrativo. Resta comprobación manual con teclado, lista extensa y viewports. | `specs/006-cierre-sin-reapertura/validation.md` |

## Diferido explícitamente

- Penalizaciones.
- Consolidación de resultados, rankings y desempate.
- Escrutinio operativo y actas.
- Procedimiento reglamentario de subsanación por omisión para nuevas planillas.

## Estado reglamentario pendiente

- La prevención de omisiones está **ACTIVA**: toda planilla debe resolver cada ítem como `SCORED` (1 a 10) o `NOT_PRESENTED` (0 mediante acción explícita) antes de confirmar o cerrar. `PENDING` bloquea la confirmación y el cierre.
- El `5 por equidad` está **NO IMPLEMENTADO**: no existen flujo, endpoint, migración, cálculo ni ajuste operativo para nuevas planillas digitales.
- La eliminación reglamentaria del `5 por equidad` para nuevas planillas digitales está **PENDIENTE DE RESOLUCIÓN COC**. El reglamento vigente todavía lo contempla como subsanación de una omisión; no se declara eliminado ni inaplicable hasta recibir la resolución formal.
- La resolución COC es la fuente canónica pendiente para cualquier flujo futuro de subsanación o escrutinio. Cuando exista, se debe registrar como mínimo su identificador o número, fecha, autoridad aprobatoria, texto o regla aprobada y referencia al acta o documento de respaldo.

## Próxima puerta SDD

Las validaciones manuales pendientes son comprobar I4-A Offline-First con PWA instalada sin red, sesión/2FA, teclado/tacto y viewports operativos conforme a `specs/005-offline-first/validation.md`, y el modal administrativo de Spec 006 con teclado, lista extensa, 320 px, 768 px y escritorio conforme a `specs/006-cierre-sin-reapertura/validation.md`. Ninguna de ellas modifica la semántica `PENDING`/`SCORED`/`NOT_PRESENTED`, crea subsanaciones ni incorpora penalizaciones, escrutinio, resultados o actas.

La resolución COC continúa siendo condición previa para una Spec de subsanación o escrutinio que operacionalice, adapte o descarte el `5 por equidad`. La ausencia de esa resolución no autoriza cambiar la regla ni bloquea el core técnico limitado de I4-A.

Antes de iniciar cualquier incremento posterior, se debe revisar y aprobar su ciclo:

```text
spec → clarificaciones → plan → tareas → implementación → validación
```

## Verificación de interfaz operativa

Toda spec que modifique una pantalla operativa debe declarar el criterio de uso móvil/tablet/desktop, interacción táctil y accesibilidad aplicable. La validación debe incluir pruebas automatizadas cuando sea viable y una comprobación proporcional en los viewports relevantes; no se acepta una dependencia de hover o precisión de mouse para acciones críticas.

## Verificación de referencia

Al 2026-08-31, las suites actuales reportaron:

- DB: 27 passed.
- API: 58 passed.
- Cliente: 48 passed.
- Build de cliente: exitoso.
