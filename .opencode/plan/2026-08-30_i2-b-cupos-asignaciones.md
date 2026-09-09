# Plan I2-B — Cupos, asignaciones y reemplazos

## Objetivo

Entregar la administración de cupos y asignaciones de jurados por evento, noche y especialidad, con reemplazos auditados y sin habilitar votación.

## Decisiones cerradas

- El cupo es por noche + especialidad y cuenta `PRIMARY` y `SUBSTITUTE` por igual.
- Un jurado solo puede tener una asignación activa por noche.
- Los cupos se configuran antes de `OPEN`; las asignaciones se crean antes de `OPEN` y se pueden revocar o reemplazar durante `OPEN`.
- Una noche `CLOSED` no admite cambios.
- El reemplazo revoca la asignación original y crea una nueva relacionada, con motivo obligatorio y efecto futuro.
- Impugnaciones, ventanas horarias, planillas, puntuación, votación y offline quedan fuera de alcance.

## Implementación

1. Crear migraciones para `judge_quota` y `judge_assignment` con FKs scoped por evento, estados, tipos y restricciones históricas; reforzar la guarda de cuota y el estado operativo de noche.
2. Implementar locks transaccionales por noche/especialidad para cupos, altas y reemplazos.
3. Crear servicios ADMIN para cupos, asignaciones, revocaciones y reemplazos.
4. Exponer consulta JUDGE de asignaciones activas y protegerla con 2FA, rol y estado.
5. Integrar rutas ADMIN y paneles responsive para administrar cupos y asignaciones.
6. Actualizar el panel JUDGE para mostrar sus asignaciones sin mostrar controles de votación.
7. Probar conflictos, carreras, transiciones de estado, auditoría e invariantes de privacidad.

## Riesgos y mitigaciones

- **Sobreasignación concurrente:** bloquear la fila de cupo dentro de la misma transacción y contar asignaciones activas después del lock.
- **Doble asignación del jurado:** índice parcial por jurado+noche y validación de servicio.
- **Historia perdida:** no borrar filas; revocar y enlazar reemplazos.
- **Evento abierto:** separar tablas operativas de la configuración congelada y limitar cupos/altas según estado.
- **Jurado suspendido:** validar estado en cada alta y en cada consulta propia.

## Validación

- Tests DB de constraints, historia y concurrencia.
- Tests API de ADMIN/JUDGE, errores estables y ausencia de votación.
- Tests cliente para flujos responsive y errores.
- Migración idempotente, suite completa, build, auditorías y revisión del diff.
