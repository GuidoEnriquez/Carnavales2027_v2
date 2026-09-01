# Plan - Spec 008: Correccion del circuito de invitaciones

## Objetivo

Corregir los defectos que impedían aceptar una invitación operativa y completar progresivamente su validación.

## Implementacion

1. Montar las rutas publicas de invitacion antes de los routers que aplican autorizacion global.
2. Usar el contrato comun de auditoria, que persiste el estado posterior en `after_data`.
3. Cubrir por HTTP la creacion administrativa, inspeccion publica, aceptacion, concesion del rol, auditoria y rechazo de reutilizacion.
4. Antes de cerrar T08, validar login real, 2FA, roles permitidos, expiracion, concurrencia y las pantallas operativas en los viewports requeridos.

## Validacion

- Ejecutar la prueba especifica y la suite API completa.
- Ejecutar las suites de base de datos y cliente, y el build del cliente.
- Revisar `git diff --check` y el diff final para confirmar alcance y ausencia de secretos.
- No cerrar T08 hasta contar con la evidencia de login/2FA y UI indicada en la spec.
