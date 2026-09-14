# Plan — Spec 029

1. Regularizar el seed de usuarios existente: preflight de entorno/credenciales,
   ADMIN determinista, servicios de alta existentes y reconciliación por perfil.
2. Serializar ejecuciones con advisory lock en conexión dedicada (sin ocupar
   el pool que usan los servicios, incluyendo pool máximo 1). Preflight de
   identidades antes de cambiar credenciales o roles.
3. Componer Goya + catálogo + usuarios desde CLI exportable para prueba;
   mantener alias npm y documentar arranque desde cero en PowerShell.
4. Tests aislados: BD nueva en el servidor de TEST_DATABASE_URL (permiso
   CREATEDB) con tablas de Better Auth y migraciones reales. La migración 031
   busca nombres de constraints en toda la BD e impide usar un esquema
   adyacente como instalación vacía fiel. Se conserva la BD de evidencia,
   sin DROP ni borrado de fixtures. Ejecución doble/concurrente, login+OTP,
   rotación, suspensión, conflicto, recuperación de invitación y secretos.
5. Suite API/DB, build cliente, sintaxis Node y diff. Sin migración nueva,
   UI ni cambios a servicios operativos. Registrar solo evidencia ejecutada.
