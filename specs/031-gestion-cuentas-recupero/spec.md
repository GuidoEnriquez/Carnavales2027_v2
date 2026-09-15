# Spec 031 — Gestión de cuentas y recupero de contraseña

Trabajo ya implementado en `master` (commits `1e68b58`, `d41ad39`,
`55c9186`, `96f92ac`). Esta spec lo documenta sin modificar código:
recupero de contraseña por enlace, plantilla HTML del OTP y cambios de
contraseña con revocación de sesiones.

- **RF-REC-01:** `sendResetPassword` en `api/src/auth/auth.js` envía el
  enlace `${FRONTEND_URL}/#/reset-password?token=<token>` por SMTP
  (nodemailer, asunto "Restablecé tu contraseña - Carnavales 2027",
  versión texto + HTML). Con `EMAIL_PROVIDER !== "smtp"` registra el
  token en consola y no envía correo (desarrollo/test).
- **RF-REC-02:** `ForgotPasswordPage` solicita el enlace vía
  `POST /api/auth/request-password-reset` con `{ email, redirectTo }`
  absoluto (`${window.location.origin}/#/reset-password`); muestra
  "Revisá tu correo" sin revelar si la cuenta existe.
- **RF-REC-03:** `ResetPasswordPage` recibe `token` por query, exige
  coincidencia de ambas contraseñas en cliente y confirma vía
  `POST /api/auth/reset-password` con `{ newPassword, token }`; sin
  token muestra "El enlace no es válido.".
- **RF-REC-04:** `AccountPage` ("Mi cuenta") cambia la contraseña del
  usuario autenticado vía `POST /api/auth/change-password` con
  `{ currentPassword, newPassword }`, con confirmación en cliente.
- **RF-REC-05:** el admin envía el enlace desde `AdminJudgesPage`
  (botón "Enviar enlace" con confirmación "Enviar enlace de
  restablecimiento", solo para jurados `REGISTERED`), llamando a
  `request-password-reset` con el email del jurado.
- **RF-REC-06:** `revokeSessionsOnPasswordReset: true` en Better Auth:
  al restablecer, todas las sesiones del usuario quedan revocadas.
  Suspender/reactivar jurado o perfil operativo también revoca sesiones
  (`revokeUserSessions` en `account-service.js`, usado por
  `judge-service.js` y `operational-profile-service.js`).
- **RF-REC-07:** el OTP de 2FA se entrega con plantilla HTML
  (`otpEmail` en `api/src/email-templates.js`, usado por
  `createOtpDelivery` en `api/src/auth/two-factor.js`): código en
  bloque destacado, expiración declarada de 5 minutos; en
  desarrollo/test con proveedor `console` se registra en log.
- **RF-REC-08:** `PasswordField` (`client/src/components/PasswordField.jsx`)
  unifica los campos de contraseña (reset y cuenta) con mostrar/ocultar
  por botón con `aria-label`, sin exponer el valor en el DOM como texto.
- **RF-REC-09:** el registro público está bloqueado
  (`databaseHooks.user.create.before` rechaza `/sign-up/email`):
  las cuentas solo nacen por invitación administrativa o seed; el
  recupero no crea cuentas.
- **RF-REC-10:** las contraseñas de prueba en tests se generan en
  runtime (`96f92ac`); sin literales de credenciales en código ni docs.

Validación: 5 tests en `client/src/tests/PasswordPages.test.jsx`,
suites afectadas y verificación manual contra API real
(request 200, reset 200, login 200). Detalle en `validation.md`.
