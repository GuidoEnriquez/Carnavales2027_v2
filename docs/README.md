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
- Spec 009 implementa el rediseño visual del jurado con validación automatizada y comprobación manual aprobada.
- Spec 010 implementa consolidación de resultados, rankings, desempate y guardias de liberación.
- Spec 011 implementa el sorteo ceremonial con countdown y cadena de auditoría, con comprobación manual en 3 viewports.
- Spec 012 consolida la operación de planilla 100% online con comprobación manual.
- Spec 013 implementa suplencias priorizadas, parejas fijas titular/suplente y activación con ADMIN+2FA.
- Todas las specs 001 a 013 están cerradas y validadas; no hay incrementos abiertos activos.

## Artefactos ejecutables

Cada incremento vive en `../specs/<nnn-nombre>/` y debe contener, cuando aplica:

```text
spec.md → clarifications.md → plan → tasks.md → validation.md
```

No usar un artefacto de un incremento anterior como autorización para ampliar alcance. Todo requisito nuevo comienza actualizando o creando la spec correspondiente.
