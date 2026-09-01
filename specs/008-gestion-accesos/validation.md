# Validacion - Spec 008

## Resultado

La emisión, inspección y aceptación API de invitaciones operativas están validadas automáticamente. La migración 052 revoca los links preexistentes y elimina el token recuperable; las nuevas invitaciones persisten solo el hash, excluyen `ADMIN`, expiran, se consumen mediante reclamación concurrente y permiten el login real con OTP. Las altas se unifican en Personas y accesos. La comprobación manual de teclado, emulación táctil y viewports está completada.

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
- Un `COMISARIO` creado por invitación recibe su rol al aceptar la invitación, inicia sesión con Better Auth y permanece bloqueado de las rutas protegidas hasta verificar 2FA.
- `AdminJudgesPage` emite auxiliares desde el selector de tipo y muestra su listado; la navegación los agrupa bajo Personas y marca la sección activa. `AcceptRoleInvitationPage` elimina el token de la URL y exige confirmación de contraseña.

## Evidencia manual reproducible para T08d

### Entorno

- API: `http://localhost:3000`.
- Cliente: `http://localhost:5173/#/login`.
- Acceso: iniciar sesión con un `ADMIN` y completar 2FA. En desarrollo, el OTP se registra solo en la consola o log de la API.
- Usar un correo de prueba exclusivo para cada ejecución y eliminar los datos locales al finalizar si no se requieren como evidencia.

### Casos

1. Abrir `#/admin/judges`, recorrer el selector `Tipo de alta` con teclado y seleccionar un rol auxiliar permitido, por ejemplo `COMISARIO`.
2. Completar el correo, generar el enlace y comprobar que el estado informa su creación. El token debe tratarse como secreto: no incluirlo en capturas, logs ni documentación.
3. Abrir el enlace en una sesión privada. Comprobar que, tras la inspección, la URL queda en `#/invitations/role/accept` sin el token y que se muestran correo enmascarado, rol y vencimiento.
4. Recorrer el formulario con teclado, verificar etiquetas y foco visible, comprobar el error de contraseñas distintas y aceptar una contraseña válida.
5. Confirmar el estado `Cuenta creada`, iniciar sesión con esa identidad y completar 2FA; verificar que el rol concedido al aceptar la invitación solo habilita rutas protegidas después del OTP.
6. Repetir los casos 1 a 5 con tacto o emulación táctil en 320 px, 768 px y escritorio, sin depender de `hover` ni precisión de mouse.

### Registro ejecutado

| Campo | Evidencia |
|---|---|
| Fecha | 2026-09-01 |
| Ejecutante | Responsable de producto |
| Navegador | Chrome de escritorio |
| Dispositivo | Emulación responsive, incluida interacción táctil emulada; no se usaron dispositivos físicos |
| Viewports | 320 px, 768 px y escritorio |
| Resultado | Los casos 1 a 6 finalizaron correctamente, sin incidencias reportadas. |

## Revision del arbol

- `git diff --check` finaliza sin errores.
- El diff del circuito de invitaciones no contiene secretos; el alerta previa de GitHub por el identificador de campo `password` es un falso positivo.
