# Spec 002 — Usuarios, jurados y asignaciones

## Estado

- **Fase SDD:** I2-A e I2-B implementados y validados.
- **Implementación:** I2-A e I2-B completadas. La votación fue abordada posteriormente por Specs 003, 004 y 006; Spec 005 conserva código exploratorio de Offline-First como funcionalidad futura. Este incremento no los habilita ni los modifica.
- **Fuentes:** `docs/source-map.md`, RF-03–RF-06 de Spec 001, Jira SVC2-9, SVC2-10, SVC2-25, SVC2-59–SVC2-61 y SVC2-67, más el README objetivo.

## Objetivo general

Permitir que administradores autorizados incorporen usuarios como jurados, administren un padrón, definan cupos y asignen o reemplacen jurados por evento, noche y especialidad, preservando 2FA, mínimo privilegio y trazabilidad.

## Incremento I2-A — Padrón e invitaciones

**Objetivo:** un ADMIN puede incorporar una persona al padrón, emitir una invitación segura y administrar su estado; el invitado puede crear sus credenciales y completar 2FA sin quedar habilitado para votar.

**Incluye:**

- Rol de aplicación `JUDGE`, separado del esquema interno de Better Auth.
- Sesión de aplicación consultable por cualquier usuario autenticado con 2FA, con autorización específica por ruta.
- Padrón global de jurados con nombre, correo, DNI y estado `INVITED | REGISTERED | SUSPENDED`.
- Alta exclusiva por ADMIN y sin registro público autónomo.
- Invitaciones de alta entropía, de uso único, almacenadas únicamente como hash SHA-256.
- Vigencia de 72 horas por defecto, configurable por entorno.
- Reemisión que revoca la invitación pendiente previa y revocación administrativa explícita.
- Aceptación que crea la identidad Better Auth, vincula el perfil, concede `JUDGE`, consume la invitación y obliga a completar 2FA en el primer login.
- Suspensión/reactivación auditadas; suspensión con revocación de sesiones y autorización fail-closed por estado de perfil.
- Panel ADMIN de padrón e invitaciones, flujo público de aceptación y panel informativo del jurado sin asignaciones.

**Excluye:** especialidad en el perfil; cupos; asignaciones; suplencias; reemplazos; impugnaciones; jornada activa; nominaciones operativas; planillas; puntuaciones; votación; offline/sync; penalizaciones; escrutinio; resultados y actas.

## Incremento I2-B — Cupos, asignaciones y reemplazos

**Objetivo:** un ADMIN puede configurar cupos por noche y especialidad, asignar jurados registrados y administrar revocaciones o reemplazos auditados, sin habilitar todavía la votación.

**Incluye:**

- Cupo positivo por noche de competencia y especialidad del mismo evento.
- Asignaciones de jurados `REGISTERED` y no suspendidos.
- Tipos de asignación `PRIMARY` y `SUBSTITUTE`, ambos contabilizados por el cupo.
- Como máximo una asignación activa por jurado y noche.
- Creación antes de abrir el evento; durante `OPEN` solo revocación o reemplazo; sin cambios después de cerrar la noche.
- Reemplazo con motivo obligatorio, vínculo histórico y efecto solo futuro.
- Listado ADMIN de cupos y asignaciones, y consulta JUDGE de sus asignaciones activas.

**Excluye:** impugnaciones, ventanas horarias, zona horaria, planillas, puntuación, habilitación de votación y sincronización offline.

## Requisitos funcionales I2-A

- **RF-22.** EL SISTEMA DEBE permitir que únicamente un ADMIN con 2FA cree un perfil de jurado con nombre, correo y DNI obligatorios.
- **RF-23.** EL SISTEMA DEBE mantener el padrón sin cupo global y sin eliminación física; un perfil DEBE transicionar `INVITED → REGISTERED` y `REGISTERED ⇄ SUSPENDED`.
- **RF-24.** EL SISTEMA NO DEBE guardar una especialidad en el perfil; la especialidad se definirá en cada asignación de I2-B usando el catálogo del evento.
- **RF-25.** EL SISTEMA DEBE impedir el registro público autónomo y crear credenciales únicamente al aceptar una invitación válida o mediante los procesos controlados de bootstrap/seed.
- **RF-26.** UNA invitación DEBE usar un secreto de alta entropía, almacenar solo su hash SHA-256, vencer a las 72 horas por defecto y poder configurarse sin modificar código.
- **RF-27.** EL SISTEMA DEBE permitir una sola invitación `PENDING` por perfil; reemitir DEBE revocar la anterior. Una invitación usada, revocada o vencida NO DEBE poder consumirse.
- **RF-28.** AL aceptar una invitación, EL SISTEMA DEBE crear o reconciliar de forma segura la identidad, vincularla al perfil, conceder `JUDGE`, marcar el perfil `REGISTERED`, consumir la invitación y auditar el resultado sin almacenar secretos.
- **RF-29.** TENER rol `JUDGE` o perfil `REGISTERED` NO DEBE habilitar votación. La habilitación futura dependerá de una asignación activa validada en servidor.
- **RF-30.** TODA ruta protegida de I2-A DEBE exigir sesión y 2FA; las rutas de padrón DEBEN exigir además `ADMIN` y las rutas propias del jurado DEBEN validar `JUDGE` y perfil no suspendido.
- **RF-31.** CUANDO un ADMIN suspenda un jurado, EL SISTEMA DEBE conservar perfil, rol e historia, bloquear inmediatamente sus capacidades y revocar todas sus sesiones activas. La reactivación NO DEBE crear asignaciones.
- **RF-32.** EL SISTEMA DEBE auditar alta, emisión, reemisión, revocación, aceptación, suspensión y reactivación, sin token, hash, contraseña, OTP ni URL de aceptación.
- **RF-33.** EL CLIENTE DEBE ofrecer navegación según roles, gestión separada del padrón, aceptación de invitación y un panel JUDGE que indique que aún no existen asignaciones ni votación.

## Requisitos funcionales I2-B

- **RF-34.** EL SISTEMA DEBE permitir que únicamente un ADMIN con 2FA configure un cupo entero positivo por combinación de noche de competencia y especialidad del mismo evento.
- **RF-35.** EL SISTEMA DEBE rechazar un cupo menor que la cantidad de asignaciones activas de su noche y especialidad, y DEBE impedir modificar o eliminar cupos cuando el evento esté `OPEN`.
- **RF-36.** EL SISTEMA DEBE permitir asignar únicamente jurados `REGISTERED` y no suspendidos a una noche de competencia y especialidad activa del mismo evento.
- **RF-37.** EL SISTEMA NO DEBE permitir más de una asignación activa del mismo jurado dentro de una noche, aunque cambie la especialidad.
- **RF-38.** EL SISTEMA DEBE contar por igual las asignaciones `PRIMARY` y `SUBSTITUTE` contra el cupo configurado.
- **RF-39.** ANTES de abrir el evento se DEBEN permitir altas y revocaciones; con el evento `OPEN` solo se DEBEN permitir revocaciones y reemplazos; una noche `CLOSED` NO DEBE admitir cambios.
- **RF-40.** Un reemplazo DEBE revocar la asignación original, crear una asignación nueva vinculada, exigir un motivo no vacío y conservar ambas filas históricas.
- **RF-41.** Alta, revocación y reemplazo DEBEN ejecutarse transaccionalmente, serializarse contra cambios concurrentes del cupo y generar auditoría sin secretos.
- **RF-42.** EL JURADO DEBE poder consultar únicamente sus asignaciones activas, con evento, noche, especialidad y tipo, sin que ello habilite rutas de votación.
- **RF-43.** I2-B NO DEBE implementar impugnaciones, ventanas horarias, planillas, puntuaciones, votación, offline/sync, penalizaciones, escrutinio, resultados ni actas.

## Contratos HTTP I2-A

- `GET /api/v1/me`: sesión + 2FA; devuelve identidad, roles y perfil JUDGE propio si existe.
- `GET /api/v1/judges`: lista de padrón para ADMIN.
- `POST /api/v1/judges`: crea perfil y emite invitación para ADMIN.
- `POST /api/v1/judges/:judgeId/invitations`: reemite invitación para ADMIN.
- `DELETE /api/v1/judges/:judgeId/invitations/:invitationId`: revoca invitación pendiente para ADMIN.
- `POST /api/v1/judges/:judgeId/suspend`: suspende y revoca sesiones para ADMIN.
- `POST /api/v1/judges/:judgeId/reactivate`: reactiva para ADMIN.
- `POST /api/v1/judge-invitations/inspect`: inspecciona un secreto sin incluirlo en URL de API.
- `POST /api/v1/judge-invitations/accept`: consume el secreto y crea la cuenta invitation-only.

Contratos adicionales I2-B:

- `GET /api/v1/events/:eventId/judge-assignments`: lista cupos y asignaciones del evento para ADMIN.
- `PUT /api/v1/events/:eventId/nights/:nightId/specialties/:specialtyId/judge-quota`: crea o actualiza el cupo antes de `OPEN`.
- `POST /api/v1/events/:eventId/judge-assignments`: crea una asignación antes de `OPEN`.
- `POST /api/v1/judge-assignments/:assignmentId/revoke`: revoca una asignación con motivo.
- `POST /api/v1/judge-assignments/:assignmentId/replace`: reemplaza una asignación con jurado y motivo.
- `GET /api/v1/judge/assignments`: lista las asignaciones activas del jurado autenticado.

Las respuestas administrativas nunca incluyen el secreto ni su hash. La inspección pública expone únicamente correo enmascarado y vencimiento. Los rechazos públicos usan un código genérico para no revelar el estado interno de una invitación.

## Alcance confirmado de base

- La identidad y sesión continúan bajo Better Auth; los roles y relaciones de dominio permanecen separados.
- Todos los accesos protegidos requieren 2FA verificado.
- Tener correo válido o cuenta registrada no habilita a votar.
- La habilitación futura exige una asignación activa del lado del servidor para evento, noche y especialidad.
- Asignaciones y reemplazos dejan auditoría y no eliminan historia.
- Los cupos de jurados son configurables y no se fijan globalmente en tres.
- Baile, Vestuario y Batería siguen siendo datos sugeridos, no roles globales.

## Fuera de alcance de I2

- Planillas, puntuaciones, confirmación e inmutabilidad de votos.
- PWA, almacenamiento local y sincronización offline.
- Penalizaciones, escrutinio, resultados y actas.

## Criterios de aceptación I2-B

- La concurrencia de altas nunca supera el cupo.
- Un jurado no puede quedar asignado dos veces en la misma noche.
- Un reemplazo conserva la fila original y enlaza la nueva.
- Las acciones administrativas exigen 2FA, ADMIN, motivo cuando corresponda y auditoría.
- Un jurado suspendido no puede ser asignado ni consultar asignaciones protegidas.
- No existen rutas de puntuación o votación como resultado de I2-B.
