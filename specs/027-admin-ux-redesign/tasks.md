# Tareas — Spec 027: Rediseño UX del Panel Administrador

## Fase A — Fundaciones (A1/A2/A3 cerradas el 2026-09-10)

- [x] **A1** — Componentes compartidos aditivos: `ConfirmDialog`, `EntityDrawer`, `PageHeader`, `EventStatusBanner`, helper `admin-ux-labels` + CSS aditivo + tests.
- [x] **A2** — Migrar `EventReadinessPanel`: `window.confirm` → `ConfirmDialog` con consecuencias explícitas.
- [x] **A3** — `EventCard` semántica botón (sin cambiar contrato visual).
  - Archivos probables: `client/src/components/ConfirmDialog.jsx`, `EntityDrawer.jsx`, `PageHeader.jsx`, `EventStatusBanner.jsx`, `admin-ux-labels.js`, `styles/admin.css` (append), tests dedicados.
  - Actual: no existen; cada página improvisa dialogs/forms/headers.
  - Esperado: mismos `Dialog`/`Button`/`StatusPill` reutilizados; cero cambios de rutas/API.
  - Reglas intocables: RF-UX-01/03/10/11. Dependencias: ninguna.
  - Tests: render, foco/Escape/backdrop, `aria-describedby` de consecuencias, botones peligro deshabilitados en `busy`.
  - Aceptación: suite + build verde; componentes usables por fases siguientes.

## Fase B — Dashboard (B1/B2 cerradas el 2026-09-10)

- [x] **B1** — `AdminHomePage` de solo lectura (estado, contadores, próximo paso, problemas con deep-link).
- [x] **B2** — `ConfigurationProgress` + ruta `#/admin/home` + entrada "Panel" en nav + redirect de tarjeta Administración.

## Fase C — Config básica (C1/C2/C3 cerradas el 2026-09-10)

- [x] **C1** — Jornadas: tabla + `NightForm` en drawer; "Orden de visualización" `max+1`; lectura + banner en OPEN.
- [x] **C2** — Comparsas: tabla + `TroupeForm` en drawer (filtros, swatch y preview conservados); guard de doble envío.
- [x] **C3** — Tipos/especialidades: tabla + `CatalogForm` en drawer + microcopy; conflicto humano.

## Fase D — Competencia (D1/D2/D3/D4 cerradas el 2026-09-10)

- [x] **D1** — `RubricTree` de lectura Especialidad → Rubro → Ítems → Criterios.
- [x] **D2** — Metadata futura colapsada en "Opciones avanzadas (sin efecto operativo)".
- [x] **D3** — Huérfanos con microcopy "pendiente de asignar".
- [x] **D4** — Matriz como "Planillas de evaluación" + aviso de faltantes + Resolver.

## Fase E — Personas y asignaciones (E1/E2/E3/E4 cerradas el 2026-09-10)

- [x] **E1** — Personas: buscar/filtrar + `ConfirmDialog` (cero `window.confirm` en admin).
- [x] **E2** — Board Noche→Especialidad con tabs, cupo inline y falta de cobertura.
- [x] **E3** — `JudgeAssignmentDialog` con disclosure Titular/Suplente.
- [x] **E4** — Menú `[Acciones ▾]` + dialogs de activar/reemplazar/revocar con motivo.

## Fase F — Operación/cierre (F1/F2/F3 cerradas el 2026-09-10)

- [x] **F1** — Votación: dialog manual → `Dialog` compartido + banner + `StatusPill` humano.
- [x] **F2** — Readiness navegable: cada faltante con `[Ir al problema]`.
- [x] **F3** — Penalizaciones a `PageHeader` + banner; escrutinio/acta sin cambios (segregación intacta).

## Fase G — Polish + a11y (cerrada el 2026-09-10)

- [x] **G0** — Refinar dashboard `AdminHomePage` (contribución externa concurrente: layout, tarjeta de próximo paso, resumen con contadores, accesos directos por estado; solo lectura). Verificada en suite + estilos responsive agregados.
- [x] **G1** — Contratos de interacción/a11y con tests (`AdminUxInteraction.test.jsx`: Escape, `aria-modal`, foco, progressbar, orden del árbol, disclosure) + auditoría responsive (tablas con scroll, drawers 94vw, targets y foco por tokens).
- [x] **G2** — Refinamiento visual del Admin Home: header compacto, filas completas navegables en el camino de configuración, estados unificados con texto, progreso absoluto, próximo paso accionable, problemas antes de acciones rápidas, métricas clickeables y sidebar agrupado sin cambiar rutas ni permisos.
- [x] **G3** — Separar Eventos (catálogo/selección) de Competencia (configuración del evento activo), incorporar `AdminEventProvider` con persistencia simple del evento activo, selector global ADMIN y recarga contextual sin duplicar selectores en las pantallas operativas.
- [x] **G4** — Rediseñar visualmente Administración de eventos: card destacada del evento activo, catálogo secundario por estado, métricas compactas, próximo paso contextual, acciones por estado, creación mediante diálogo y usuarios relegados a un bloque secundario.
