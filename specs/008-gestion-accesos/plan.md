# Plan - Spec 008: Cierre seguro del circuito de invitaciones

## Objetivo

Cerrar el alta de accesos auxiliares sin abrir módulos diferidos: proteger los enlaces, impedir la invitación de `ADMIN`, validar el circuito real de login/2FA y consolidar todas las altas de personas en la sección de Jurados.

## Implementacion

1. Crear una migracion incremental que revoque las invitaciones operativas existentes, reemplace el token plano por `token_hash` y agregue estado, uso y reclamacion de aceptacion.
2. Restringir el servicio de invitaciones a `VEEDOR`, `COMISARIO` y `SCRUTINEER`; validar correo y devolver errores HTTP controlados.
3. Inspeccionar y aceptar por token hasheado, pendiente y no vencido. La aceptacion debe reclamar primero la invitacion en una transaccion, crear o asociar la identidad y finalizar el uso y rol en una segunda transaccion.
4. No incluir tokens ni contraseñas en auditoria. La inspeccion publica debe recibir el token en el cuerpo de un `POST`, y el cliente debe quitarlo de la URL inmediatamente.
5. Integrar la emision de roles auxiliares en `AdminJudgesPage`: un selector de tipo de alta elige Jurado, Veedor, Comisario o Escrutador. Jurado conserva nombre, correo y DNI; los auxiliares solo solicitan correo. La misma pantalla lista los auxiliares activos fuera del padrón de jurados.
6. Retirar la ruta y navegacion redundantes de Accesos, sin retirar los endpoints que respaldan el listado y la emision desde la seccion unificada.
7. Antes de cerrar T08, validar login real, 2FA, roles permitidos, expiracion, concurrencia, migracion, ambas pantallas y los viewports requeridos.

## Validacion

- Ejecutar la prueba especifica, la integracion real Better Auth y la suite API completa.
- Ejecutar las suites de base de datos y cliente, y el build del cliente.
- Comprobar por consulta que ninguna fila de `role_invitation` tiene un token recuperable y que las invitaciones previas quedaron revocadas.
- Revisar `git diff --check` y el diff final para confirmar alcance y ausencia de secretos.
- No cerrar T08 hasta contar con la evidencia de login/2FA y UI indicada en la spec.
