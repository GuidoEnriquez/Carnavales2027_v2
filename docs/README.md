# Documentación

## Fuentes y reglas de trabajo

- [Constitución](constitution.md): principios y reglas de ingeniería no negociables.
- [Mapa de fuentes](source-map.md): relación entre Jira SVC2, Confluence C2, Obsidian, reglamento y specs.
- [Estado SDD](sdd-status.md): incrementos terminados, alcance diferido y próxima puerta de especificación.

## Estado vigente

- Spec 004 mantiene la completitud obligatoria: `PENDING` bloquea confirmar y cerrar.
- Spec 005 implementa Offline-First; faltan comprobaciones manuales de PWA, sesión/2FA y viewports.
- Spec 006 elimina las nuevas reaperturas y muestra los votos pendientes en un modal al rechazar el cierre administrativo.

## Artefactos ejecutables

Cada incremento vive en `../specs/<nnn-nombre>/` y debe contener, cuando aplica:

```text
spec.md → clarifications.md → plan → tasks.md → validation.md
```

No usar un artefacto de un incremento anterior como autorización para ampliar alcance. Todo requisito nuevo comienza actualizando o creando la spec correspondiente.
