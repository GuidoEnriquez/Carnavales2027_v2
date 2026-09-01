# Estado SDD — Carnavales2027_v2

> Estado actualizado: 2026-09-01. Esta nota distingue implementación, validación automatizada y validación manual; las specs y validaciones son la evidencia detallada.

## Incrementos completados

| Incremento | Alcance validado | Evidencia principal |
|---|---|---|
| I1 / I1-C | Configuración de eventos, jornadas, catálogos, readiness, apertura transaccional, 2FA/ADMIN y auditoría administrativa. | `specs/001-plataforma-votacion-carnavales/validation.md` |
| I2-A | Padrón de jurados, invitaciones, aceptación, 2FA y suspensión. | `specs/002-jurados-asignaciones/validation.md` |
| I2-B | Cupos, asignaciones, reemplazos y concurrencia. | `specs/002-jurados-asignaciones/validation.md` |
| I3 | Planillas, puntajes, secreto, confirmación e inmutabilidad; la reapertura histórica fue reemplazada por Spec 006. | `specs/003-votacion-planillas/validation.md` |
| Spec 004 | IMPLEMENTADA y VALIDADA: estados `PENDING`/`SCORED`/`NOT_PRESENTED`, completitud obligatoria y diálogo modal de pendientes para el jurado. Aceptada. | `specs/004-completitud-planillas/validation.md` |
| I4-A / Spec 005 | Código exploratorio de Offline-First preservado; conexión y sincronización se declaran funcionalidad futura, no aceptada para operación. | `specs/005-offline-first/validation.md` |
| Spec 006 | Implementada y validada automáticamente. La validación manual se declara completada, pero falta registrar entorno y pasos reproducibles. | `specs/006-cierre-sin-reapertura/validation.md` |
| Spec 007 | Implementación presente en el árbol de trabajo; su `spec.md` declara aprobación pendiente. **[NECESITA ACLARACIÓN]** antes de marcarla aceptada. | `specs/007-inmutabilidad-por-item/spec.md` |
| Spec 008 | Emisión, inspección y aceptación API de accesos auxiliares validadas automáticamente. Login real, 2FA y pruebas de cliente pendientes. | `specs/008-gestion-accesos/validation.md` |

## Diferido explícitamente

- Penalizaciones.
- Consolidación de resultados, rankings y desempate.
- Escrutinio operativo y actas.
- Conexión y sincronización Offline-First (Spec 005): funcionalidad futura; el código exploratorio no está aceptado para operación.

## Estado reglamentario actualizado

- La prevención de omisiones está **ACTIVA**: toda planilla debe resolver cada ítem como `SCORED` (1 a 10) o `NOT_PRESENTED` (0 mediante acción explícita) antes de confirmar o cerrar. `PENDING` bloquea la confirmación y el cierre.
- **"5 por equidad" nulo:** por decisión de producto del 2026-09-01, no aplica a planillas digitales. La completitud obligatoria evita la omisión humana que buscaba subsanar; no existe flujo, cálculo ni ajuste operativo asociado.

## Próxima puerta SDD

Permanecen pendientes un nuevo ciclo SDD para conexión y sincronización Offline-First, la evidencia reproducible de la comprobación manual declarada para Spec 006, la aprobación formal de Spec 007 y la validación de login/2FA y cliente de Spec 008. Ninguna de ellas habilita penalizaciones, escrutinio, resultados ni actas.

Antes de iniciar cualquier incremento posterior (como Escrutinio, Resultados o Penalizaciones), se debe redactar y aprobar su especificación e iniciar un nuevo ciclo:

```text
spec → clarificaciones → plan → tareas → implementación → validación
```

## Verificación de interfaz operativa

Toda spec que modifique una pantalla operativa debe declarar el criterio de uso móvil/tablet/desktop, interacción táctil y accesibilidad aplicable. La validación debe incluir pruebas automatizadas cuando sea viable y una comprobación proporcional en los viewports relevantes; no se acepta una dependencia de hover o precisión de mouse para acciones críticas.

## Verificación de referencia

Al 2026-09-01, las suites ejecutadas reportaron:

- DB: 27 passed.
- API: 59 passed.
- Cliente: 48 passed.
- Build de cliente: exitoso.
