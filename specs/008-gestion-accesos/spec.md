# Spec 008 — Gestión de Accesos Auxiliares

## Estado

- **Fase SDD:** implementación y validación automática parcial completadas; T08 continúa en progreso.
- **Fuente:** requisito de producto incorporado al repositorio; no hay referencia Jira, Confluence ni reglamento identificada. **[NECESITA ACLARACIÓN]**.
- **Pendiente de evidencia:** login real con Better Auth, 2FA inicial, pruebas de ambas pantallas y comprobación móvil/tablet/desktop.
- **Identificadores:** los RF se refieren como `Spec-008/RF-xx` para evitar colisiones con la numeración local de otros incrementos.

## Objetivo
Implementar la infraestructura para que el rol `ADMIN` pueda gestionar invitaciones y otorgar acceso a los roles operativos secundarios descritos en el organigrama del evento: `VEEDOR`, `COMISARIO` y `SCRUTINEER`.

## Requisitos Fundamentales (RF)
- **RF-63:** El sistema debe contar en su diccionario con los roles de aplicación: `JUDGE`, `VEEDOR`, `COMISARIO`, `SCRUTINEER` y `ADMIN`.
- **RF-64:** Solo un usuario con rol `ADMIN` puede invitar a nuevos usuarios operativos.
- **RF-65:** Las invitaciones deben ser seguras, utilizando un sistema de token (link) que expire y que permita al invitado definir su propia contraseña al momento de registrarse.
- **RF-66:** El número de invitaciones generables por el Administrador para roles operativos es ilimitado por defecto.
- **RF-67:** La UI debe permitir listar los usuarios activos (excluyendo a los jurados, cuyo padrón se maneja por separado) y enviar nuevas invitaciones.

## Exclusiones
- No se incluye en este incremento la lógica de lo que hace cada rol (las penalizaciones o escrutinio), únicamente el sistema de alta y login.
- No se incluye la revocación (suspensión) de estos accesos, se implementará junto con el módulo de auditoría de usuarios.
- No se autoriza la invitación de nuevos `ADMIN`; RF-63 solo exige que el rol exista en el diccionario. El contrato API debe restringir las invitaciones a `VEEDOR`, `COMISARIO` y `SCRUTINEER` antes de cerrar este incremento.
