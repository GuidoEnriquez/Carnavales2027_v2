# Validación — Spec 031

Documenta trabajo ya implementado en `master`. Toda la evidencia
siguiente es real, obtenida el 2026-09-15 sin modificar código.

## Tests automatizados

| Comando/verificación | Resultado |
|---|---|
| `npm test -- --run src/tests/PasswordPages.test.jsx` en `client` | **5 passed, 0 failed** (129 ms, vitest 3.2.7) |

Los 5 tests en `client/src/tests/PasswordPages.test.jsx` cubren
RF-REC-02/03/04: Reset rechaza sin token, Reset guarda con token
válido (`POST /api/auth/reset-password`), Reset exige coincidencia
(sin llamada API), Forgot envía el enlace
(`POST /api/auth/request-password-reset` con `email` y `redirectTo`
absoluto) y Account cambia la contraseña
(`POST /api/auth/change-password`).

Suites afectadas: la API no tiene tests automatizados para estos
endpoints (búsqueda en `api/src` sin coincidencias para
`request-password-reset`/`reset-password`/`change-password` en
`*.test.js`); el flujo servidor se validó manualmente (abajo). El
cliente conserva sus suites existentes; el archivo focal corre
aislado en verde.

## Verificación manual contra API real

Servidor principal `http://localhost:3000` en pie (`/health` 200, BD
dev con usuarios seed). Como el `.env` de desarrollo deja
`EMAIL_PROVIDER=smtp` (última ocurrencia), se levantó una instancia
temporal en puerto 3001 con `EMAIL_PROVIDER=console` (token visible
en log, sin enviar correo real) contra la misma BD dev, cuenta
`jury-baile-01@example.test`:

| Paso | Resultado |
|---|---|
| `POST /api/auth/request-password-reset` `{ email, redirectTo: "http://localhost:5173/#/reset-password" }` | **200**; token en log del servidor |
| `POST /api/auth/reset-password` `{ newPassword, token }` | **200** `{"status":true}` |
| `POST /api/auth/sign-in/email` con la contraseña nueva | **200** con `token` de sesión y `user` (`twoFactorEnabled: false`) |
| Restauración: `setCredentialPassword` con contraseña del seed (`getSeedPassword`, `NODE_ENV=development`) | login con temporal → **401** (restauración confirmada) |
| Limpieza | instancia temporal detenida (puerto 3001 cerrado); principal `:3000` intacto (`/health` 200) |

La BD dev quedó sin cambios netos: la única cuenta tocada recuperó su
contraseña seed y la contraseña temporal usada no se publica en esta
spec. Ningún correo real salió (proveedor `console` en la instancia
de prueba; el `request-password-reset` previo contra `:3000`/smtp
también devolvió 200 pero su token no era recuperable, por eso se usó
la instancia temporal).

## Cobertura RF

- RF-REC-01/02/03/05: endpoints y páginas verificados en tests (focal
  5/5) y flujo manual 200/200/200.
- RF-REC-04: test "AccountPage cambia la contraseña" en verde.
- RF-REC-06: `revokeSessionsOnPasswordReset: true`
  (`api/src/auth/auth.js:30`) y `revokeUserSessions`
  (`api/src/auth/account-service.js:93`) referenciados por
  `judge-service.js` y `operational-profile-service.js`; el login
  post-reset emitió sesión nueva, coherente con la revocación.
- RF-REC-07: `otpEmail` (`api/src/email-templates.js:46`, expiración
  5 minutos) cableado en `createOtpDelivery`
  (`api/src/auth/two-factor.js:53`); verificado por inspección, sin
  envío real en esta sesión.
- RF-REC-08/09/10: inspección de `PasswordField.jsx`, hook
  `databaseHooks.user.create.before` y ausencia de literales de
  credenciales en tests y docs.
