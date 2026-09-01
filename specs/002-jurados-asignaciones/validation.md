# Validación — Spec 002 · Incrementos I2-A e I2-B

## Estado

- **I2-A e I2-B validados:** 2026-08-30.
- **Resultado:** padrón, invitaciones, cupos, asignaciones y reemplazos completados sin habilitar votación.
- **Siguiente puerta histórica:** al cierre de I2, cualquier módulo de votación, planillas u operación offline requería una nueva spec y clarificación. Ese trabajo se documentó posteriormente en Specs 003 a 005.

## Evidencia ejecutada

| Área | Comando | Resultado |
|---|---|---|
| API | `npm test` en `api/` | 43 passed, 0 failed, 0 skipped |
| Persistencia | `npm run db:test` en `api/` | 14 passed, 0 failed |
| Cliente | `npm test` en `client/` | 40 passed, 0 failed |
| Build | `npm run build` en `client/` | exitoso, 43 módulos transformados |
| Dependencias API | `npm audit` | 0 vulnerabilities |
| Dependencias cliente | `npm audit` | 0 vulnerabilities |
| Migraciones | `npm run db:migrate` dos veces y `npm run db:migrate -- --status` | 001–030 aplicadas; ambas ejecuciones sin pendientes; estado completo |
| Seed ADMIN | `NODE_ENV=development npm run db:seed` dos veces | ADMIN de desarrollo reutilizado en ambas ejecuciones |
| Seed Goya | `NODE_ENV=development npm run db:seed:goya` dos veces | ambas ejecuciones exitosas |
| Guarda de seed | `npm run db:seed` sin entorno explícito | rechazo esperado `SEED_ADMIN_REQUIRES_DEVELOPMENT_OR_TEST` |
| Pool mínimo | integración I2-A con `DB_POOL_MAX=1` | aceptación, suspensión y reactivación sin deadlock |
| Cuota | `judges.test.js` y `judges-api.test.js` | cupo por noche+especialidad, reducción inválida y conteo de titular/suplente |
| Asignación | `judges.test.js` y `judges-api.test.js` | jurado registrado, una asignación por noche, conflictos y consulta propia |
| Concurrencia | altas HTTP simultáneas contra cupo 1 | una respuesta 201, una 409 y una sola asignación activa |
| Reemplazo | `judges.test.js` y `judges-api.test.js` | fila original revocada, nueva fila enlazada, motivo obligatorio e historia conservada |
| Auditoría | `audit.test.js` y pruebas I2-A/I2-B | transiciones auditadas sin secretos |

## Matriz de requisitos I2-B

| Requisito | Evidencia |
|---|---|
| RF-34 | `028_judge_quotas_assignments.sql`, `assignment-service.js`, `judges-api.test.js` |
| RF-35 | guardas DB de `judge_quota`, migración 030, servicio de cupos y prueba de reducción bajo asignaciones activas |
| RF-36 | FKs scoped por evento, guardas de noche/especialidad y validación de perfil `REGISTERED` |
| RF-37 | índice parcial `judge_assignment_active_judge_night_uq` y prueba de conflicto |
| RF-38 | conteo de asignaciones activas sin distinguir `PRIMARY`/`SUBSTITUTE` |
| RF-39 | migración 029, servicio y trigger de ciclo de evento/noche, con revocación y reemplazo durante `OPEN` |
| RF-40 | `replaceJudgeAssignment`, `replaced_assignment_id`, estados históricos y prueba API/DB |
| RF-41 | transacciones, `FOR UPDATE` sobre evento/cupo y carrera HTTP de cupo 1 |
| RF-42 | `/api/v1/judge/assignments`, `requireJudge`, `JudgeHomePage` y pruebas de cliente |
| RF-43 | ausencia verificada de rutas de votación, planillas, offline, escrutinio y actas |

## Reglas de concurrencia e historia

- El cupo se bloquea dentro de la transacción antes de contar e insertar.
- Las altas concurrentes no pueden superar el máximo configurado.
- Las asignaciones no se eliminan físicamente.
- Un reemplazo revoca la fila original y crea otra relacionada.
- Una asignación revocada es inmutable.
- Un jurado suspendido no puede recibir nuevas asignaciones ni consultar sus asignaciones protegidas.
- Los cupos son configuración y quedan bloqueados al abrir el evento; las asignaciones son operación controlada.

## Fuera de alcance

I2-B no implementa impugnaciones, ventanas horarias, zona horaria, jornada activa avanzada, planillas, puntuaciones, votación, offline/sync, penalizaciones, escrutinio, resultados ni actas.

## Revisión final

- `git diff --check`: sin errores.
- No se modificó el esquema interno de Better Auth.
- No se agregaron secretos, rutas de voto ni mecanismos de autoasignación ADMIN.
