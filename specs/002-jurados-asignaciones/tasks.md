# Tasks — Spec 002 · I2-A/I2-B Jurados y asignaciones

## Reglas

- Ejecutar una tarea por vez y verificarla antes de avanzar.
- No modificar el esquema interno de Better Auth.
- No implementar impugnaciones, planillas, puntuaciones, votación ni offline/sync.
- Toda operación sensible debe exigir autorización server-side y auditoría sin secretos.

## Estado

| Tarea | Estado | Evidencia |
|---|---|---|
| T01–T05 | Completadas | Implementación DB, API, Better Auth y cliente cubierta por suites automatizadas |
| T06 | Completada | `validation.md`, migraciones 001–027, suites, seeds, build, auditorías y revisión final |
| T07–T10 | Completadas | `validation.md`, migraciones 028–030, suites DB/API/cliente, build, seeds, auditorías y revisión final |

## T01 — Persistencia I2-A

- Agregar rol `JUDGE`, perfiles e invitaciones mediante migraciones incrementales.
- Validar estados, DNI/correo únicos, perfil sin especialidad y una invitación pendiente.
- Actualizar test del runner y agregar pruebas DB.

## T02 — Identidad invitation-only

- Bloquear signup público de Better Auth.
- Encapsular creación y reconciliación conservadora de credenciales, y revocación de sesiones.
- Adaptar bootstrap y seed controlados.

## T03 — Servicios de padrón e invitaciones

- Implementar listado, alta, emisión, reemisión, revocación, inspección y aceptación.
- Entregar email con TTL configurable y persistir estado de entrega.
- Auditar todas las transiciones sin secretos.

## T04 — Autorización y API

- Generalizar `/me` para sesión 2FA.
- Crear autorización `JUDGE` con perfil no suspendido.
- Exponer rutas públicas y ADMIN con errores estables.
- Suspender/reactivar y revocar sesiones.

## T05 — Cliente I2-A

- Implementar sesión y navegación por roles.
- Crear padrón ADMIN, aceptación pública y panel informativo JUDGE.
- Mantener guardas de UI como UX, no como control de seguridad.

## T06 — Validación

- Ejecutar tests específicos y suites completas API/DB/cliente.
- Ejecutar migraciones dos veces, seeds, build y auditorías.
- Documentar matriz RF-22–RF-33 y confirmar ausencia de I2-B/votación.

## T07 — Persistencia I2-B

- Agregar migración incremental para cupos y asignaciones.
- Modelar tipos `PRIMARY`/`SUBSTITUTE`, revocación, vínculo de reemplazo y motivos.
- Aplicar FKs scoped por evento y restricciones de integridad histórica.
- Serializar modificaciones por noche y especialidad para impedir sobreasignación.

**Hecho cuando:** tests DB demuestran cupo, unicidad por jurado/noche, estados, reemplazos y concurrencia.

## T08 — Servicios y API I2-B

- Implementar CRUD de cupos, altas, revocaciones, reemplazos y listados.
- Aplicar reglas de evento/noche/especialidad, estado del jurado y ciclo `CONFIGURING`/`OPEN`/`CLOSED`.
- Exigir ADMIN+2FA para administración y JUDGE+2FA para consulta propia.
- Auditar cambios sin secretos.

**Hecho cuando:** las pruebas API cubren autorización, contratos, conflictos y ausencia de votación.

## T09 — Cliente I2-B

- Incorporar gestión de cupos y asignaciones al área ADMIN.
- Mostrar asignaciones activas al jurado con estado informativo, sin carga de votos.
- Mantener guardas de UI como UX, no como control de seguridad.

**Hecho cuando:** pruebas de cliente cubren creación, reemplazo, revocación, errores y diseño móvil.

## T10 — Validación I2-B

- Ejecutar suites DB/API/cliente, migraciones dos veces, build, seeds y auditorías.
- Ejecutar pruebas con pool pequeño y carreras de cupo.
- Documentar matriz RF-34–RF-43 y confirmar ausencia de votación.
