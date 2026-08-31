# Estado SDD — Carnavales2027_v2

> Estado actualizado: 2026-08-31. Esta nota resume el estado de los incrementos; las specs y validaciones son la evidencia detallada.

## Incrementos completados

| Incremento | Alcance validado | Evidencia principal |
|---|---|---|
| I1 / I1-C | Configuración de eventos, jornadas, catálogos, readiness, apertura transaccional, 2FA/ADMIN y auditoría administrativa. | `specs/001-plataforma-votacion-carnavales/validation.md` |
| I2-A | Padrón de jurados, invitaciones, aceptación, 2FA y suspensión. | `specs/002-jurados-asignaciones/validation.md` |
| I2-B | Cupos, asignaciones, reemplazos y concurrencia. | `specs/002-jurados-asignaciones/validation.md` |
| I3 | Planillas, puntajes, secreto, confirmación, reapertura controlada y VEEDOR sin puntajes. | `specs/003-votacion-planillas/validation.md` |
| Spec 004 | Estados `PENDING`/`SCORED`/`NOT_PRESENTED`, completitud obligatoria y diálogo modal de pendientes para el jurado. Aceptado. | `specs/004-completitud-planillas/validation.md` |

## Diferido explícitamente

- Offline-first y sincronización idempotente.
- Penalizaciones.
- Consolidación de resultados, rankings y desempate.
- Escrutinio operativo y actas.
- Procedimiento reglamentario de subsanación por omisión para nuevas planillas.

## Próxima puerta SDD

La regla de prevención de omisiones queda confirmada: toda planilla debe resolver cada ítem como `SCORED` (1 a 10) o `NOT_PRESENTED` (0 mediante acción explícita) antes de confirmar o cerrar. Este comportamiento ya está cubierto por Spec 004.

El `5 por equidad` queda diferido sin código como contingencia reglamentaria excepcional fuera del flujo del jurado. No autoriza rutas, datos, UI ni cálculos de escrutinio hasta contar con una regla canónica que defina su condición de aplicación, autoridad, evidencia, aprobación e impacto en la consolidación. No iniciar un nuevo módulo directamente; la próxima spec debe resolver esas definiciones antes de implementar.

Una vez definida la contingencia o descartada reglamentariamente, se crea el siguiente incremento con:

```text
spec → clarificaciones → plan → tareas → implementación → validación
```

## Verificación de interfaz operativa

Toda spec que modifique una pantalla operativa debe declarar el criterio de uso móvil/tablet/desktop, interacción táctil y accesibilidad aplicable. La validación debe incluir pruebas automatizadas cuando sea viable y una comprobación proporcional en los viewports relevantes; no se acepta una dependencia de hover o precisión de mouse para acciones críticas.

## Verificación de referencia

Al 2026-08-31, las suites actuales reportaron:

- DB: 26 passed.
- API: 57 passed.
- Cliente: 46 passed.
- Build de cliente: exitoso.
