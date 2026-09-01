# Clarificaciones - Spec 008

- **Método de Alta:** Se homologa con el alta de Jurados. En lugar de generar contraseñas iniciales y enviarlas por correo en texto plano, se usa una tabla temporal de invitaciones. El usuario accede al link y define su propia clave al activar su cuenta.
- **Diferenciación de Padrón:** Aunque Jurados y Usuarios Auxiliares son cuentas del sistema, operativamente se manejan en vistas separadas porque los Jurados tienen restricciones específicas (cupos por noche y especialidad), mientras que Veedores y Comisarios tienen acceso global al evento.
- **Cupos Auxiliares:** No se imponen límites de base de datos a la cantidad de Veedores, Escrutadores o Comisarios que puede crear un Administrador.
- **Rol `ADMIN`:** La invitación de roles auxiliares no concede ni debe conceder `ADMIN`; habilitarla sería una vía pública de escalamiento de privilegios y requiere un incremento de seguridad separado si se necesitara.
- **Estado de evidencia:** La aceptación API está cubierta automáticamente. Login real, 2FA, entrega del enlace y validación de las pantallas con teclado, tacto y viewports permanecen pendientes.
