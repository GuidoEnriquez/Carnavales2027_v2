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
| Spec 018 | Refinamiento UX de la planilla del jurado: nombre de ítem visible, separación de "No se presentó", palabra-ancla, indicador de guardado online, sidebar de comparsas, navegación por ítems, focus return en diálogos. Implementación completada (T01-T06); comprobación manual responsive pendiente. | `specs/018-refinamiento-planilla-jurado/validation.md` |
| Spec 019 | Seguridad HTTP, Resiliencia de Persistencia, Idempotencia de Planilla y Cadena de Auditoría (Fase 1 del Plan Maestro): cabeceras Helmet, rate limiting por capas, timeouts y deadlock retry, idempotencia en scores/submit, cadena general SHA-256 JCS en `audit_event`, graceful shutdown y CI. Validada automáticamente (134 API, 68 DB, 138 cliente, build limpio). | `specs/019-seguridad-plataforma/validation.md` |
| Spec 020 | Fundación del Sistema de Diseño (Fase 2 del Plan Maestro): tokens semánticos únicos, capas Marca/Instrumento, componentes atómicos (`Dialog`, `Button`, `StatusPill`, `ProgressBar`, `Toast`), guardas consolidadas (`RequireAnyRole`), i18n de errores y PWA completa. Validada (168 tests cliente, build limpio). | `specs/020-sistema-diseno/validation.md` |
| Spec 021 | Planilla del Jurado v3 (Fase 3 del Plan Maestro): flujo móvil tarjeta a tarjeta, grilla radiogroup 1-10 con doble tap in situ, "No se presentó" segregado, guardado por fila con reintento aislado, barra inferior persistente con faltantes, endpoint optimizado `include=progress` y color de comparsa (`brand_color`). Validada automáticamente (135 API, 68 DB, 175 cliente, build limpio). | `specs/021-planilla-jurado-v3/validation.md` |
| Spec 022 | Tiempo Real Interno SSE (Fase 4 del Plan Maestro): canal SSE en `/api/v1/monitor/stream` con heartbeats y 2FA, bus interno con hooks, secreto estricto de voto (RF-190), fallback automático a polling (RF-193), alertas de anomalía operativa (RF-194) y modo "Pared de sala" para proyectores (RF-195). Validada automáticamente (136 API, 68 DB, 180 cliente, build limpio). | `specs/022-tiempo-real-sse/validation.md` |

## Incremento activo

- Fase 5 del Plan Maestro — Spec 023: Capa de Marca y Home por Rol.
- Spec 016 — Supervisión de votación por VEEDOR. La implementación y validación automatizada están completas; falta comprobación manual en los viewports operativos.
- Spec 017 — Configuración de competencia. T01-T03 con evidencia del alcance original; T04 en curso, con validación responsive y hallazgos pendientes. El pedido ampliado requiere completar su contrato SDD. La máquina de estados permanece bloqueada hasta aclarar apertura, vigencia de versiones y reglas temporales de jornadas.
- Spec 018 — Refinamiento UX de la planilla del jurado. Implementación completada (T01-T06); comprobación manual en los 3 viewports operativos pendiente. Build y 138 tests pasan.
- Módulo diferido: Publicación externa de resultados / Portal público.
- Spec 017 / T07: correcciones de formularios y endurecimiento de auditoria validados (113 tests API/DB, 133 cliente, build exitoso). T08-T11 y comprobacion manual siguen pendientes; no se declara cierre integral.
- Spec 017 / T08: migracion 067, integridad de criterios y reordenamiento auditado con UI validados automaticamente (121 API/DB, 138 cliente en ultima ejecucion, build exitoso). T09-T11, cadena fresca 001-067, analisis estatico y comprobacion manual siguen pendientes. Se registro intermitencia en prueba de Acta Oficial, no resuelta.

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
