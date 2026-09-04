# Estado SDD — Carnavales2027_v2

> Estado actualizado: 2026-09-04. Esta nota distingue implementación, validación automatizada y validación manual; las specs y validaciones son la evidencia detallada.

## Incrementos completados

| Incremento | Alcance validado | Evidencia principal |
|---|---|---|
| I1 / I1-C | Configuración de eventos, jornadas, catálogos, readiness, apertura transaccional, 2FA/ADMIN y auditoría administrativa. | `specs/001-plataforma-votacion-carnavales/validation.md` |
| I2-A | Padrón de jurados, invitaciones, aceptación, 2FA y suspensión. | `specs/002-jurados-asignaciones/validation.md` |
| I2-B | Cupos, asignaciones, reemplazos y concurrencia. | `specs/002-jurados-asignaciones/validation.md` |
| I3 | Planillas, puntajes, secreto, confirmación e inmutabilidad; la reapertura histórica fue reemplazada por Spec 006. | `specs/003-votacion-planillas/validation.md` |
| Spec 004 | IMPLEMENTADA y VALIDADA: estados `PENDING`/`SCORED`/`NOT_PRESENTED`, completitud obligatoria y diálogo modal de pendientes para el jurado. Aceptada. | `specs/004-completitud-planillas/validation.md` |
| I4-A / Spec 005 | Código exploratorio de Offline-First preservado; conexión y sincronización se declaran funcionalidad futura, no aceptada para operación. | `specs/005-offline-first/validation.md` |
| Spec 006 | Implementada y validada automáticamente y de forma manual en Chrome de escritorio con emulación responsive 320px, 768px y escritorio. | `specs/006-cierre-sin-reapertura/validation.md` |
| Spec 007 | Aprobada, implementada y validada automáticamente y de forma manual en Chrome de escritorio con emulación responsive 320px, 768px y escritorio. | `specs/007-inmutabilidad-por-item/validation.md` |
| Spec 008 | Emisión, inspección y aceptación de accesos auxiliares validadas: token hasheado, exclusión de `ADMIN`, login/2FA, altas unificadas con Jurados y UI manualmente comprobada en Chrome responsive. | `specs/008-gestion-accesos/validation.md` |
| Spec 009 | Implementación, validación automática y **comprobación manual** completadas el 2026-09-01 (390x844, 768x1024, 1440x900, teclado y emulación táctil). Aceptada y cerrada. | `specs/009-experiencia-operativa-jurado/validation.md` |
| Spec 010 | Consolidación de puntajes, rankings, desempate (criterios 1–2), trazabilidad y guardia de integridad de liberación (RF-94a). Cerrada el 2026-09-02. | `specs/010-resultados/validation.md` |
| Spec 011 | Sorteo ceremonial: servicio backend, endpoint HTTP, hook countdown, modal accesible, estilos CSS, recuperación inmutable y validación manual (12 criterios × 3 viewports). Cerrada el 2026-09-02. | `specs/011-sorteo-ceremonial/validation.md` |
| Spec 012 | Planilla online únicamente: simplificación a operación 100% online, eliminación de persistencia local y controles de sync, validación manual responsive (12 criterios × 3 viewports). Cerrada el 2026-09-02. | `specs/012-planilla-online-unicamente/validation.md` |
| Spec 013 | Suplencias priorizadas: pares fijos titular/suplente, activación ADMIN+2FA, transición `REPLACED`, cierre y liberación. Validada automáticamente y manualmente (Asignaciones). Cerrada el 2026-09-02. | `specs/013-suplencias-priorizadas/validation.md` |
| Spec 014 | Gestión de penalizaciones: tabla `troupe_penalty`, deducción en Mejor Comparsa con piso cero, preservación de rubros artísticos, panel accesible de Comisariato y revocación auditada. Cerrada el 2026-09-03. | `specs/014-penalizaciones/validation.md` |
| Spec 015 | Actas Oficiales y Certificación de Escrutinio: tabla inmutable `official_scrutiny_record`, hash JCS/SHA-256 (RFC 8785), segregación 2FA (ADMIN sólo lectura, emisión exclusiva SCRUTINEER/ESCRIBANO), vista notarial imprimible (@media print). Cerrada el 2026-09-03. | `specs/015-actas-escrutinio/validation.md` |
| Perfiles Operativos | Alta unificada de roles auxiliares (VEEDOR, COMISARIO, SCRUTINEER, ESCRIBANO), invitación por consola/SMTP, aceptación solo password, ciclo de vida INVITED→REGISTERED→SUSPENDED, trigger auto-registro. Migraciones 064-065. Implementado y validado (99 tests) el 2026-09-03. | `PLAN-operational-profiles.md` |
| Spec 016 | Supervisión de votación por VEEDOR: endpoint agregado, guard de rol, vista con polling, navegación y redirect post-login. Validación automatizada completada; comprobación manual responsive pendiente. | `specs/016-supervision-veedor/validation.md` |

## Incremento activo

- Spec 016 — Supervisión de votación por VEEDOR. La implementación y validación automatizada están completas; falta comprobación manual en los viewports operativos.
- Módulo diferido: Publicación externa de resultados / Portal público.

## Diferido explícitamente

- Publicación externa de resultados.
- Conexión y sincronización Offline-First (Spec 005): funcionalidad futura; Spec 012 retiró su uso del cliente actual.

## Estado reglamentario actualizado

- La prevención de omisiones está **ACTIVA**: toda planilla debe resolver cada ítem como `SCORED` (1 a 10) o `NOT_PRESENTED` (0 mediante acción explícita) antes de confirmar o cerrar. `PENDING` bloquea la confirmación y el cierre.
- **"5 por equidad" nulo:** por decisión de producto del 2026-09-01, no aplica a planillas digitales. La completitud obligatoria evita la omisión humana que buscaba subsanar; no existe flujo, cálculo ni ajuste operativo asociado.

## Flujo SDD vigente

Para el incremento en curso:

```text
spec → clarificaciones → plan → tareas → implementación → validación
```

## Verificación de interfaz operativa

Toda spec que modifique una pantalla operativa debe declarar el criterio de uso móvil/tablet/desktop, interacción táctil y accesibilidad aplicable. La validación debe incluir pruebas automatizadas cuando sea viable y una comprobación proporcional en los viewports relevantes; no se acepta una dependencia de hover o precisión de mouse para acciones críticas.

## Verificación de referencia

Al 2026-09-04, las evidencias automatizadas son API 108, DB 62, cliente 108 y build exitoso. Specs 014 y 015, y Perfiles Operativos están completados; Spec 016 mantiene pendiente la comprobación manual responsive.
