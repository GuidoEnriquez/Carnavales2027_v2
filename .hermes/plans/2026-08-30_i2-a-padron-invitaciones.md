# Plan I2-A — Padrón e invitaciones de jurados

## Objetivo

Entregar el flujo vertical ADMIN crea perfil → emite invitación → jurado acepta → completa 2FA → accede a un panel informativo, sin asignaciones ni votación.

## Decisiones de diseño

- Better Auth conserva identidad, credenciales, sesiones y 2FA; sus tablas no se modifican manualmente.
- `app_role`, `user_role`, perfiles, invitaciones y auditoría permanecen en el dominio de aplicación.
- El endpoint público de signup de Better Auth se bloquea mediante hook; bootstrap, seeds y aceptación usan un servicio server-side encapsulado.
- La especialidad se difiere a cada asignación de I2-B.
- El secreto de invitación se entrega por correo y nunca se retorna en contratos de dominio.
- La suspensión se valida en cada request JUDGE además de revocar sesiones, para fallar cerrado ante carreras o fallos de revocación.

## Implementación

1. Agregar migraciones incrementales para `JUDGE`, `judge_profile` y `judge_invitation`, con índices de unicidad y estados.
2. Encapsular creación de identidad y revocación de sesiones de Better Auth sin exponer su esquema.
3. Implementar servicios transaccionales de padrón, emisión/reemisión/revocación, inspección y aceptación.
4. Implementar entrega por consola fuera de producción y SMTP obligatorio en producción.
5. Generalizar `/me`, agregar autorización JUDGE dinámica y montar rutas públicas/ADMIN.
6. Refactorizar bootstrap y seed para mantener su funcionamiento con signup público bloqueado.
7. Implementar navegación por roles, padrón ADMIN, aceptación y panel informativo JUDGE.
8. Verificar DB, concurrencia de consumo, contratos HTTP, 2FA, suspensión, auditoría sin secretos y regresión I1.

## Riesgos y mitigaciones

- **Fallo entre Better Auth y dominio:** claim temporal por invitación y servicio reconciliable por correo+perfil; una identidad huérfana se conserva para reintento en vez de borrarse durante una carrera.
- **Entrega posterior al commit:** persistir estado de entrega; el ADMIN puede reemitir sin recuperar el secreto anterior.
- **Registro elusivo:** rechazar `/api/auth/sign-up/email` y probarlo por HTTP.
- **Sesión suspendida en carrera:** middleware consulta perfil en DB en cada ruta JUDGE.
- **Enumeración pública:** inspección/aceptación devuelven `INVITATION_INVALID` para estados no consumibles.

## Validación

- Migraciones aplicadas dos veces y estado completo.
- Tests DB, API y cliente específicos, luego suites completas.
- Seeds y bootstrap fuera de producción sin depender de signup público.
- Build del cliente y auditorías npm.
- Revisión de diff, ausencia de secretos y ausencia de módulos I2-B/votación.
