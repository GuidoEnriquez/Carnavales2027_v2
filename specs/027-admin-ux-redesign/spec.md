# Spec 027 — Rediseño UX del Panel Administrador (presentación, sin cambio de negocio)

## Estado

- **Fase SDD:** Especificación propuesta / pendiente de validación (2026-09-10).
- **Fuentes:** Inspección directa del cliente (`AppNavigation`, `PageShell`, `AdminEventsPage`, `EventConfigurationPage`, `AdminCompetenciaPage`, `AdminJudgesPage`, `AdminAssignmentsPage`, `AdminVotingPage`, `AdminPenaltiesPage`, `AdminResultsPage`, `OfficialRecordPage`, `EventReadinessPanel`); `client/AGENTS.md` (brief); brief de tarea "PLAN UX/UI PARA REDISEÑO DEL PANEL ADMINISTRADOR".
- **Relación:** No altera Specs 004/006/007/010/011/013/014/015/017/019-024. Solo presentación + navegación + jerarquía + interacción + UX writing del área ADMIN.

---

## Objetivo

Cambiar el modelo mental de "administrar entidades" a "preparar y operar un carnaval", sin modificar APIs, IDs, relaciones, estados, roles, permisos, reglas de bloqueo, asignaciones, suplencias, auditoría ni reglas del evento.

Principio: "Mostrar decisiones del negocio, no entidades técnicas."

---

## Alcance

### Incluye

1. Shell admin (sidebar persistente desktop / drawer tablet-mobile), evento activo visible, ruta actual evidente; evoluciona `AppNavigation` sin duplicar.
2. Dashboard admin (estado, progreso, contadores, próximo paso, problemas con deep-link).
3. Colecciones como lista/tabla + drawer de edición (`NightForm`, `TroupeForm`, `JudgeForm`); peligrosas en `ConfirmDialog` (`Acciones ▾`).
4. Progressive disclosure (ej. `Suplente de…` solo si elige Suplente).
5. `RubricTree` (Especialidad → Rubro → Ítems → Criterios) y `EvaluationMatrix` ("Planillas de evaluación") con CTA Resolver.
6. Cupos integrados a Noche × Especialidad en la vista (sin cambiar reglas de servidor).
7. `EventReadinessPanel` como checklist navegable con `[Ir al problema]`.
8. Reemplazo de `window.confirm()/alert()` por `Dialog`/`ConfirmDialog`.
9. Microcopy sin jerga BD (solo presentación; valores internos intactos).
10. Vista de solo lectura + banner en `OPEN`; orientación a resultados/escrutinio/actas en `CLOSED`.

### Excluye

- Backend, BD, migraciones, endpoints, DTOs, auth/autorización.
- Reglas de suplencia, cupos, cálculo de resultados, penalizaciones, inmutabilidad.
- Diseño del jurado; Offline-First (salvo estado visual inherente).
- Cambios de `ADMIN` que libera resultados o emite actas (prohibido; segregación vigente).

---

## Requisitos

- **RF-UX-01 — Sin cambio de negocio:** ningún task DEBE modificar contratos API, estados, roles, permisos ni reglas; solo presentación/navegación/jerarquía/interacción/copy.
- **RF-UX-02 — Navegación libre:** el "camino recomendado" (Evento → Jornadas → Comparsas → Evaluación → Jurados → Asignaciones → Validación → Apertura) guía pero NUNCA bloquea el acceso directo por sidebar.
- **RF-UX-03 — Colecciones:** alta simple en modal, edición en drawer, confirmación peligrosa en dialog, estados con `StatusPill`, errores de campo junto al campo, errores operativos en alerta contextual. Prohibido `alert()/confirm()` del navegador.
- **RF-UX-04 — Asignaciones:** modelo mental "Noche → Especialidad → Puestos → Jurados"; disclosure progresivo; excepcionales (activar/reemplazar/revocar) en menú + dialog con motivo obligatorio y aviso de auditoría.
- **RF-UX-05 — Rubros:** jerarquía visual Especialidad → Rubro → Ítems → Criterios; metadata futura (`resolutionMethod`, `required`, `allowNotPresented`) colapsada en "Opciones avanzadas (sin efecto operativo)".
- **RF-UX-06 — Matriz:** etiqueta UX "Planillas de evaluación"; relaciones faltantes como `⚠ N rubros sin asignación [Resolver]` con deep-link.
- **RF-UX-07 — Estados de evento:** `CONFIGURING` editable; `OPEN` lectura + banner explícito; `CLOSED` orienta a escrutinio/actas.
- **RF-UX-08 — Orden:** `displayOrder` se presenta como "Orden de visualización", autocompletado `max+1` (orden de creación); sin drag-and-drop.
- **RF-UX-09 — Color de comparsa:** `brandColor` visible en admin (swatch + vista previa) y en planilla del jurado; solo vista.
- **RF-UX-10 — Accesibilidad:** teclado, foco visible, labels explícitos, `aria-live/current`, `Dialog` accesible con retorno de foco, targets ≥44px, contraste AA, sin color como único indicador; viewports 390x844, 768x1024, 1440x900.
- **RF-UX-11 — Atomicidad con evidencia:** cada task cierra con test específico + suite cliente + build + `git diff --check` + registro en `validation.md`.

---

## Criterios de Aceptación

1. Una persona que conoce el Carnaval (no la BD) puede configurar el evento sin ver `displayOrder/specialtyId/standbyForAssignmentId/matrix/orphaned`.
2. Cero `window.confirm/alert` en el área admin.
3. `OPEN` muestra banner + lectura; `CLOSED` orienta a escrutinio/actas.
4. Todo problema de readiness tiene CTA que lleva al problema.
5. Suite cliente en verde + build Vite exitoso tras cada unidad.
