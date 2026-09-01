# Tareas - Spec 008

| ID | Descripción | Estado |
| :--- | :--- | :--- |
| T01 | Aprobar Spec 008 y Clarificaciones | Completada |
| T02 | (DB) Migración 050: Crear el rol `COMISARIO` | Completada |
| T03 | (DB) Migración 051: Crear tabla `role_invitation` | Completada |
| T04 | (API) Endpoints de usuarios `GET /users` y `POST /users/invitations` | Completada |
| T05 | (API) Endpoints públicos `POST /invitations/role/inspect` y `POST /invitations/role/accept` | Completada |
| T06 | (Cliente) Sección unificada `AdminJudgesPage.jsx` para altas y listado auxiliar | Completada |
| T07 | (Cliente) Página pública de aceptación de rol auxiliar | Completada |
| T08a | (DB) Revocar links existentes y migrar `role_invitation` a token hasheado con ciclo de vida | Completada: migración 052 aplicada y comprobada |
| T08b | (API) Restringir roles, validar expiración y resolver aceptación concurrente | Completada: pruebas HTTP y Better Auth |
| T08c | (Cliente) Unificar altas en Personas/Jurados y retirar Accesos como pantalla independiente | Completada: pruebas de componente y build |
| T08d | (Pruebas) Validar circuito completo desde creación hasta login, 2FA y cliente | En progreso: evidencia automatizada completa; resta comprobación manual de teclado, tacto y 320 px/768 px/escritorio |
