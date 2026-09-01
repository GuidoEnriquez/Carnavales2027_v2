# Documentación

## Fuentes y reglas de trabajo

- [Constitución](constitution.md): principios y reglas de ingeniería no negociables.
- [Mapa de fuentes](source-map.md): relación entre Jira SVC2, Confluence C2, Obsidian, reglamento y specs.
- [Estado SDD](sdd-status.md): incrementos terminados, alcance diferido y próxima puerta de especificación.

## Estado vigente

- Spec 004 mantiene la completitud obligatoria: `PENDING` bloquea confirmar y cerrar.
- Spec 005 conserva una implementación exploratoria de Offline-First, pero conexión y sincronización son una funcionalidad futura no aceptada para operación.
- Spec 006 elimina las nuevas reaperturas y muestra los votos pendientes en un modal al rechazar el cierre administrativo; la evidencia manual requiere completar su entorno reproducible.
- Spec 007 tiene implementación en el árbol de trabajo, pero su aprobación SDD está marcada como pendiente.
- Spec 008 valida automáticamente la aceptación de accesos auxiliares; faltan login real, 2FA y pruebas de sus pantallas.

## Artefactos ejecutables

Cada incremento vive en `../specs/<nnn-nombre>/` y debe contener, cuando aplica:

```text
spec.md → clarifications.md → plan → tasks.md → validation.md
```

No usar un artefacto de un incremento anterior como autorización para ampliar alcance. Todo requisito nuevo comienza actualizando o creando la spec correspondiente.
