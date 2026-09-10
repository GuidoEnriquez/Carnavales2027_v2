# Estado SDD — Carnavales2027_v2

> Estado actualizado: 2026-09-10. Esta nota distingue implementación, validación automatizada y validación manual; las specs y validaciones son la evidencia detallada.

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
| Spec 019 | Seguridad HTTP, Resiliencia de Persistencia, Idempotencia de Planilla y Cadena de Auditoría (Fase 1 del Plan Maestro): cabeceras Helmet, rate limiting por capas, timeouts y deadlock retry, idempotencia en scores/submit, cadena general SHA-256 JCS en `audit_event`, graceful shutdown y CI. Validada automáticamente (134 API, 68 DB, 138 cliente, build limpio). | `specs/019-seguridad-plataforma/validation.md` |
| Spec 020 | Fundación del Sistema de Diseño (Fase 2 del Plan Maestro): tokens semánticos únicos, capas Marca/Instrumento, componentes atómicos (`Dialog`, `Button`, `StatusPill`, `ProgressBar`, `Toast`), guardas consolidadas (`RequireAnyRole`), i18n de errores y PWA completa. Validada (168 tests cliente, build limpio). | `specs/020-sistema-diseno/validation.md` |
| Spec 021 | Planilla del Jurado v3 (Fase 3 del Plan Maestro): absorbe y reemplaza la propuesta preliminar de Spec 018. Flujo móvil tarjeta a tarjeta, grilla radiogroup 1-10 con doble tap in situ, "No se presentó" segregado, guardado por fila con reintento aislado, barra inferior persistente con faltantes, endpoint optimizado `include=progress` y color de comparsa (`brand_color`). Validada automáticamente (135 API, 68 DB, 175 cliente, build limpio). | `specs/021-planilla-jurado-v3/validation.md` |
| Spec 022 | Tiempo Real Interno SSE (Fase 4 del Plan Maestro): canal SSE en `/api/v1/monitor/stream` con heartbeats y 2FA, bus interno con hooks, secreto estricto de voto (RF-190), fallback automático a polling (RF-193), alertas de anomalía operativa (RF-194) y modo "Pared de sala" para proyectores (RF-195). Validada automáticamente (136 API, 68 DB, 180 cliente, build limpio). | `specs/022-tiempo-real-sse/validation.md` |
| Spec 023 | Capa de Marca y Home por Rol (Fase 5 del Plan Maestro): capa dual Marca/Instrumento (`data-layer`), identidad festiva carnaval en Login/Home/Resultados/Acta, redirección inteligente post-login (`goToRoleHome`), stepper y panel de condiciones de liberación en escrutinio (RF-94a) y `prefers-reduced-motion`. Validada automáticamente (136 API, 68 DB, 195 cliente, build limpio). | `specs/023-marca-home-roles/validation.md` |
| Spec 024 | Portal Público de Resultados (Fase 6 del Plan Maestro): solo lectura post-liberación, snapshot inmutable `results_snapshot` (migración 070, triggers NO UPDATE/DELETE), materialización automática determinística JCS/SHA-256 en liberación/acta/sorteo, verificación de hash de acta oficial, endpoints públicos `/api/v1/public/events` y `/:eventId/results` con ETag/HTTP 304, canal SSE público en `/api/v1/public/stream` con fallback a polling (30s), secreto estricto de voto (RF-214) y vista `PublicResultsPage.jsx` bajo Capa de Marca. Validada automáticamente (141 API, 72 DB, 200 cliente, build limpio). | `specs/024-portal-publico/validation.md` |
| Spec 025 | Votación secuencial por orden de pasada: bloqueo por `presentation_order`, guardia anti-URL directa, banner de continuidad, defensa backend `TROUPE_PRECEDENCE_REQUIRED` (409) y control de pista en vivo. **[NECESITA ACLARACIÓN]:** `spec.md` la declara "propuesta / pendiente de aprobación" mientras `tasks.md` marca las 4 fases `[x]` y `validation.md` la declara "100% Cerrada". Hasta resolver la contradicción, se registra como propuesta con evidencia no aprobada. | `specs/025-votacion-secuencial-pasadas/validation.md` |
| Spec 026 | Optimización de diseño sin framework (deuda técnica): inventario, CSS muerto, fuente única `.ballot-status-*`, badges monitor/workflow a tokens, resultados/portal a tokens, `utilities.css`, `PageShell` + `DialogFooter` con adopción 100%, test `EventCard`, veredicto fundado de no-aplica para `useApiResource`. T01–T10 validadas (T11 pendiente: reconciliación de `judge.css` huérfana, requiere navegador). | `specs/026-optimizacion-diseno/validation.md` |
| Spec 027 | Rediseño UX del Panel Administrador: fundaciones compartidas, dashboard, configuración, competencia, operación/cierre, evento activo global, separación Eventos/Competencia y catálogo visual de eventos. G0–G4 validadas automáticamente; comprobación manual responsive/teclado/táctil pendiente. | `specs/027-admin-ux-redesign/validation.md` |

## Estado del working tree (2026-09-10)

- Refactor de diseño previo a Spec 026 (tokens, hojas CSS, `App.jsx`, `AppNavigation.jsx`, `StatusPill.jsx`, páginas y tests): regularizado bajo Spec 026 T01–T10 salvo T11 pendiente (reconciliación de `judge.css`, no importada en producción).
- Componente `client/src/components/EventCard.jsx` (untracked) adoptado con tests en Spec 026/T07.
- Borrados staged: 8 planes históricos en `.hermes/plans/` (I1, I2-A/B, I3, cierre, offline-first, completitud) — fuera del alcance de Spec 026, requieren autorización aparte.
- Cambios de Spec 017 T09a/T09b, Spec 027 G0–G4 y ajustes concurrentes de cliente/API documentados en sus respectivas validaciones; no se consideran un incremento nuevo fuera de esas specs.
- Estado verificado: suite cliente 45 archivos / 282 tests en verde, suite API 142 tests en verde, build Vite 83 módulos exitoso, `git diff --check` sin errores de whitespace y sin secretos detectados.

## Incremento activo

- Fase 6 del Plan Maestro completada (Specs 019–024 cerradas según `source-map.md` y log de commits).
- Spec 026 — Optimización de diseño: T01–T10 validadas; T11 pendiente (requiere navegador).
- Spec 027 — Rediseño UX admin: G0–G4 validadas automáticamente; comprobación manual responsive, teclado y táctil pendiente.
- Spec 016 — Supervisión de votación por VEEDOR. La implementación y validación automatizada están completas; falta comprobación manual en los viewports operativos.
- Spec 017 — Configuración de competencia. T01-T03 con evidencia del alcance original; T04 en curso, con validación responsive y hallazgos pendientes.
- Spec 025 — Propuesta pendiente de aprobación (ver contradicción arriba); no es incremento activo hasta su aprobación.

## Diferido explícitamente

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

Al 2026-09-10, la evidencia automatizada del estado actual es: cliente 45 archivos / 282 tests en verde, API 142 tests en verde y build Vite exitoso (83 módulos). `git diff --check` no detecta errores de whitespace. Permanecen pendientes las comprobaciones manuales responsive/teclado/táctil de las pantallas admin, además de Spec 026 T11 y Spec 016 responsive.
