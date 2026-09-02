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
| Spec 006 | Implementada y validada automáticamente y de forma manual en Chrome de escritorio con emulación responsive 320px, 768px y escritorio. | `specs/006-cierre-sin-reapertura/validation.md` |
| Spec 007 | Aprobada, implementada y validada automáticamente y de forma manual en Chrome de escritorio con emulación responsive 320px, 768px y escritorio. | `specs/007-inmutabilidad-por-item/validation.md` |
| Spec 008 | Emisión, inspección y aceptación de accesos auxiliares validadas: token hasheado, exclusión de `ADMIN`, login/2FA, altas unificadas con Jurados y UI manualmente comprobada en Chrome responsive. | `specs/008-gestion-accesos/validation.md` |
| Spec 009 | Implementación, validación automática y **comprobación manual** completadas el 2026-09-01 (390x844, 768x1024, 1440x900, teclado y emulación táctil). Aceptada y cerrada. | `specs/009-experiencia-operativa-jurado/validation.md` |
| Spec 010 | Implementación, validación automática y criterio 1 de desempate confirmados el 2026-09-01 (fuente oficial Confluence C2). Criterio 3 (sorteo) diferido a Spec 011. **Aceptada y cerrada.** | `specs/010-resultados/validation.md` |

## Incremento vigente

| Incremento | Estado | Evidencia principal |
|---|---|---|
| Spec 011 | T01–T05 implementados y validados automáticamente; vista `#/admin/results` integrada. Pendientes T06–T07: validación manual y cierre final. | `specs/011-sorteo-ceremonial/` |

## Diferido explícitamente

- Penalizaciones.
- Consolidación de resultados, rankings y desempate.
- Escrutinio operativo y actas.
- Conexión y sincronización Offline-First (Spec 005): funcionalidad futura; el código exploratorio no está aceptado para operación.

## Estado reglamentario actualizado

- La prevención de omisiones está **ACTIVA**: toda planilla debe resolver cada ítem como `SCORED` (1 a 10) o `NOT_PRESENTED` (0 mediante acción explícita) antes de confirmar o cerrar. `PENDING` bloquea la confirmación y el cierre.
- **"5 por equidad" nulo:** por decisión de producto del 2026-09-01, no aplica a planillas digitales. La completitud obligatoria evita la omisión humana que buscaba subsanar; no existe flujo, cálculo ni ajuste operativo asociado.

## Próxima puerta SDD

El incremento vigente es Spec 011 — Sorteo ceremonial con conteo regresivo (criterio 3 del desempate de Mejor Comparsa). Offline-First, penalizaciones, escrutinio y actas continúan requiriendo sus propias specs aprobadas.

Antes de iniciar cualquier incremento posterior (como Escrutinio, Resultados o Penalizaciones), se debe redactar y aprobar su especificación e iniciar un nuevo ciclo:

```text
spec → clarificaciones → plan → tareas → implementación → validación
```

## Verificación de interfaz operativa

Toda spec que modifique una pantalla operativa debe declarar el criterio de uso móvil/tablet/desktop, interacción táctil y accesibilidad aplicable. La validación debe incluir pruebas automatizadas cuando sea viable y una comprobación proporcional en los viewports relevantes; no se acepta una dependencia de hover o precisión de mouse para acciones críticas.

## Verificación de referencia

Al 2026-09-01, Specs 009 y 010 quedaron cerradas con validación manual aceptada.

Las últimas evidencias automatizadas aceptadas permanecen en Spec 009 (cliente 53 passed y build OK) y Spec 010 (DB 37, API 71, cliente 53, build OK).
