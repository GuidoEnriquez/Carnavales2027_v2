# Validacion - Spec 008

## Resultado

La emisión, inspección y aceptación API de invitaciones operativas están validadas automáticamente. La migración 052 revoca los links preexistentes y elimina el token recuperable; las nuevas invitaciones persisten solo el hash, excluyen `ADMIN`, expiran, se consumen mediante reclamación concurrente y permiten el login real con OTP. Las altas se unifican en Personas y accesos. Resta la comprobación manual de teclado, tacto y viewports.

## Evidencia ejecutada

| Area | Comando | Resultado |
| :--- | :--- | :--- |
| API especifica | `node --import=dotenv/config --test --test-concurrency=1 src/tests/admin-users-api.test.js src/tests/operational-invitation-auth.test.js` en `api/` | 2 passed, 0 failed |
| API completa | `npm test` en `api/` | 60 passed, 0 failed |
| Persistencia | `npm run db:test` en `api/` | 27 passed, 0 failed |
| Cliente | `npm test` en `client/` | 52 passed, 0 failed |
| Build | `npm run build` en `client/` | exitoso, 48 módulos transformados |
| Migraciones | `npm run db:migrate` y `npm run db:migrate -- --status` en `api/` | sin migraciones pendientes; 001-052 aplicadas |

## Cobertura

- Un ADMIN con 2FA emite una invitación para `COMISARIO`; el token se devuelve una única vez, no queda en la tabla ni en la auditoría, y la columna plana no existe.
- Una invitación con `ADMIN` se rechaza; las invitaciones expiradas, usadas, revocadas o simultáneas responden `INVITATION_INVALID` sin crear una segunda identidad.
- La aceptación crea o asocia identidad, concede el rol y registra `USER_ROLE_GRANTED` sin secreto en `after_data`.
- Un `COMISARIO` creado por invitación inicia sesión con Better Auth, queda bloqueado antes de OTP y obtiene su rol luego de verificar 2FA.
- `AdminJudgesPage` emite auxiliares desde el selector de tipo y muestra su listado; la navegación los agrupa bajo Personas y marca la sección activa. `AcceptRoleInvitationPage` elimina el token de la URL y exige confirmación de contraseña.

## Pendiente para T08

- Comprobación manual de `AdminJudgesPage` y `AcceptRoleInvitationPage` con teclado, tacto y viewports de 320 px, 768 px y escritorio.

## Revision del arbol

- `git diff --check` finaliza sin errores.
- El diff del circuito de invitaciones no contiene secretos; el alerta previa de GitHub por el identificador de campo `password` es un falso positivo.
