# Validacion - Spec 008

## Resultado

La emisión, inspección y aceptación API de invitaciones operativas están validadas. La aceptación registra la concesión del rol en auditoría sin errores de persistencia y una invitación consumida no puede reutilizarse. Esta evidencia no cubre aún login real, 2FA ni las pantallas del cliente.

## Evidencia ejecutada

| Area | Comando | Resultado |
| :--- | :--- | :--- |
| API especifica | `node --import=dotenv/config --test --test-concurrency=1 src/tests/admin-users-api.test.js src/tests/users-api.test.js` en `api/` | 2 passed, 0 failed |
| API completa | `npm test` en `api/` | 59 passed, 0 failed |
| Persistencia | `npm run db:test` en `api/` | 27 passed, 0 failed |
| Cliente | `npm test` en `client/` | 48 passed, 0 failed |
| Build | `npm run build` en `client/` | exitoso, 49 modulos transformados |
| Migraciones | `npm run db:migrate` y `npm run db:migrate -- --status` en `api/` | sin migraciones pendientes; 001-051 aplicadas |

## Cobertura

- Un ADMIN con 2FA emite una invitacion para `COMISARIO`.
- El enlace puede inspeccionarse y aceptarse sin sesion.
- La aceptacion crea la identidad, concede el rol y registra `USER_ROLE_GRANTED` con `after_data`.
- Una invitacion ya consumida responde `INVITATION_INVALID`.
- Las rutas no relacionadas conservan sus propias guardas de sesion, 2FA y rol.

## Pendiente para T08

- Login real mediante Better Auth y verificación de 2FA posterior al alta.
- Rechazo de roles fuera de `VEEDOR`, `COMISARIO` y `SCRUTINEER`, expiración y concurrencia de aceptación.
- Pruebas de `AdminUsersPage` y `AcceptRoleInvitationPage`, más comprobación manual de teclado, tacto y 320 px, 768 px y escritorio.

## Revision del arbol

- `git diff --check` conserva dos errores de espacios finales preexistentes en `client/src/tests/JudgeBallotPage.test.jsx`; ese archivo no fue modificado por este incremento.
- El diff de los archivos de Spec 008 y del circuito de invitaciones no contiene secretos.
