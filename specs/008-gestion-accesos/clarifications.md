# Clarificaciones - Spec 008

- **Método de Alta:** Se homologa con el alta de Jurados. En lugar de generar contraseñas iniciales y enviarlas por correo en texto plano, se usa una tabla temporal de invitaciones. El usuario accede al link y define su propia clave al activar su cuenta.
- **Diferenciación de Padrón:** Jurados y usuarios auxiliares comparten la sección de alta, pero mantienen listados separados: los Jurados conservan restricciones de cupo, noche y especialidad, mientras que Veedores, Comisarios y Escrutadores tienen acceso global al evento.
- **Cupos Auxiliares:** No se imponen límites de base de datos a la cantidad de Veedores, Escrutadores o Comisarios que puede crear un Administrador.
- **Rol `ADMIN`:** La invitación de roles auxiliares no concede ni debe conceder `ADMIN`; habilitarla sería una vía pública de escalamiento de privilegios y requiere un incremento de seguridad separado si se necesitara.
- **Token e historial:** Por decisión de producto del 2026-09-01, las invitaciones operativas creadas antes del endurecimiento se revocan durante una migración autorizada. Su metadato se conserva, pero se elimina el token en texto plano; las nuevas invitaciones persisten solo su hash.
- **Punto de alta:** Por decisión de producto del 2026-09-01, el ADMIN incorpora jurados y usuarios auxiliares desde una sola sección de Personas/Jurados. El selector determina el circuito: `JUDGE` requiere nombre, correo y DNI; los roles auxiliares requieren correo y generan el link correspondiente.
- **Estado de evidencia:** La aceptación API, login real, 2FA, rechazo de roles no permitidos, expiración, concurrencia y pruebas automatizadas de cliente están cubiertos. Permanece pendiente la comprobación manual de las pantallas con teclado, tacto y viewports.
