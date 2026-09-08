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
- Spec 014 implementa gestión de penalizaciones (`troupe_penalty`), deducción en Mejor Comparsa y panel de Comisariato.
- Spec 015 implementa actas oficiales de escrutinio (`official_scrutiny_record`), hash JCS/SHA-256 (RFC 8785) e impresión notarial (@media print).
- Spec 016 implementa supervisión de votación por `VEEDOR` (validación automatizada completa; comprobación manual responsive pendiente).
- Spec 017 configura la competencia (T01-T03 con evidencia; T04 en curso).
- Specs 019 a 024 cierran las Fases 1 a 6 del Plan Maestro (seguridad, sistema de diseño, planilla v3, SSE, marca/home por rol, portal público).
- Spec 025 (votación secuencial por orden de pasada) es propuesta pendiente de aprobación con contradicción spec-vs-validación por resolver.
- El refactor de diseño del working tree quedó regularizado bajo Spec 026 (T01–T10 validadas; T11 pendiente por falta de navegador). Ver `sdd-status.md`.

## Artefactos ejecutables

Cada incremento vive en `../specs/<nnn-nombre>/` y debe contener, cuando aplica:

```text
spec.md → clarifications.md → plan → tasks.md → validation.md
```

No usar un artefacto de un incremento anterior como autorización para ampliar alcance. Todo requisito nuevo comienza actualizando o creando la spec correspondiente.
