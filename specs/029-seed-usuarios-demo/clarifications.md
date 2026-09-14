# Clarificaciones — Spec 029

- Los usuarios son globales; no llevan especialidad fija en el perfil.
  El pedido amplía las cuentas del seed, no abre la competencia ni asigna votos.
- Un ADMIN del fixture no significa eliminar otros ADMIN existentes.
- ADMIN usa `SEED_ADMIN_EMAIL` y `SEED_ADMIN_NAME`; la contraseña común se
  obtiene del entorno. En una base vacía estas variables se preparan antes
  del comando, junto con Better Auth/PostgreSQL.
- Tres jurados usan `demo.jurado1/2/3@carnaval.local`; el escribano usa
  `demo.escrutinio@carnaval.local`. El fixture anterior de fantasía conserva
  su propia identidad y no se adopta por similitud de nombre.
- Las altas JUDGE/ESCRIBANO reutilizan servicios de invitación/aceptación;
  la entrega se captura en memoria y no se envía ni registra el secreto.
- El catálogo y sus ítems integrales son el fixture de testing confirmado
  previamente por producto; este incremento no los convierte en planilla oficial.
- ADMIN sin rol por bootstrap interrumpido solo se reconcilia demostrando la
  credencial configurada mediante `createOrVerifyCredentialUser`; no se
  restablece la contraseña de una cuenta sin reclamar. Un rol incompatible
  sigue siendo conflicto.
- Cada ejecución cierra las sesiones de las cuentas demo después de verificar
  o actualizar la credencial. Así un reintento completa también una revocación
  fallida después de haber persistido la nueva contraseña.
- No se encontró `plan.md` de Spec 002 ni planes I2 históricos en el árbol;
  se consultaron spec, clarificaciones, tareas y validación disponibles.
