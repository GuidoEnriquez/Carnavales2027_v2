# Documentación

## Fuentes y reglas de trabajo

- [Constitución](constitution.md): principios y reglas de ingeniería no negociables.
- [Mapa de fuentes](source-map.md): relación entre Jira SVC2, Confluence C2, Obsidian, reglamento y specs.
- [Estado SDD](sdd-status.md): incrementos terminados, alcance diferido y próxima puerta de especificación.

## Estado vigente

- Spec 004 mantiene la completitud obligatoria: `PENDING` bloquea confirmar y cerrar.
- Spec 005 conserva una implementación exploratoria de Offline-First, pero conexión y sincronización son una funcionalidad futura no aceptada para operación.
- Spec 006 elimina las nuevas reaperturas y muestra los votos pendientes en un modal al rechazar el cierre administrativo; cuenta con evidencia manual reproducible.
- Spec 007 está aprobada, implementada y validada con evidencia automatizada y manual.
- Spec 008 valida invitaciones seguras de accesos auxiliares, login real, 2FA y UI con evidencia automatizada y manual.
- Spec 009 implementa el rediseño visual del jurado y registra pruebas de cliente y build. La validación manual de responsive, teclado y emulación táctil en 390x844, 768x1024 y 1440x900 sigue pendiente.

## Artefactos ejecutables

Cada incremento vive en `../specs/<nnn-nombre>/` y debe contener, cuando aplica:

```text
spec.md → clarifications.md → plan → tasks.md → validation.md
```

No usar un artefacto de un incremento anterior como autorización para ampliar alcance. Todo requisito nuevo comienza actualizando o creando la spec correspondiente.
