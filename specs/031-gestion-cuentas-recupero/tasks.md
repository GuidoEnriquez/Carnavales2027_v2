# Tareas — Spec 031

Trabajo ya implementado en `master`; las tareas describen lo realizado,
verificado contra la evidencia de `validation.md`. Sin cambios de código.

- [x] T01: recupero por enlace — `sendResetPassword` SMTP en
  `api/src/auth/auth.js` (RF-REC-01), `ForgotPasswordPage`
  (RF-REC-02), `ResetPasswordPage` con validación de coincidencia
  (RF-REC-03) y botón admin "Enviar enlace" en `AdminJudgesPage`
  (RF-REC-05). Commits `1e68b58`, `d41ad39`.
- [x] T02: cuenta y sesiones — `AccountPage` con cambio de contraseña
  (RF-REC-04), `revokeSessionsOnPasswordReset: true` y revocación en
  suspender/reactivar vía `revokeUserSessions` (RF-REC-06).
- [x] T03: OTP y componente — plantilla HTML del OTP (`otpEmail`,
  RF-REC-07) y `PasswordField` con mostrar/ocultar (RF-REC-08,
  commit `55c9186`); contraseñas de test generadas en runtime
  (RF-REC-10, commit `96f92ac`).
- [x] T04: validación — 5/5 tests en `PasswordPages.test.jsx`, suites
  afectadas y verificación manual contra API real (request 200,
  reset 200, login 200); contraseña seed restaurada y servidor
  temporal detenido. Evidencia en `validation.md`.
