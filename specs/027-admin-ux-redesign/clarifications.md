# Clarificaciones — Spec 027

## C1 — Orden de jornadas/ítems (2026-09-10, decisión de producto)

- **Pregunta:** ¿"Orden de visualización" basta o se quiere drag-and-drop?
- **Decisión:** El orden es el orden de creación (Noche 1 → 1, Noche 2 → 2). Sin drag-and-drop.
- **Efecto:** alta autocompleta `max+1`; edición numérica simple en drawer. Semántica del backend intacta.

## C2 — Metadata futura de rubros/ítems (2026-09-10, decisión de producto: opción A)

- **Pregunta:** `resolutionMethod`, `required`, `allowNotPresented`, `expectedSubjectType` se muestran como campos normales pero son metadata futura (Spec 017: no ejecutan fórmulas ni cambian completitud).
- **Decisión:** Colapsarlos en "Opciones avanzadas (sin efecto operativo)", con ayuda explícita ("hoy todos los ítems exigen puntaje o No se presentó; PENDING bloquea cierre").
- **Efecto:** Solo presentación; valores y contratos API intactos.

## C3 — `brandColor` de comparsa (2026-09-10, decisión de producto)

- **Pregunta:** ¿Solo banda en planilla del jurado o también en admin?
- **Decisión:** Ambos. Admin conserva swatch + "Vista jurado"; jurado conserva banda. Solo vista, sin efecto en puntajes.

## C4 — Mapa UX writing (solo presentación)

| Interno | Presentación |
|---|---|
| `CONFIGURING` | En configuración |
| `OPEN` | Competencia abierta |
| `CLOSED` | Evento cerrado |
| `displayOrder` | Orden de visualización |
| `assignmentType` | Tipo de asignación |
| `standbyForAssignmentId` | Suplente de |
| `matrix` | Planillas de evaluación |
| `orphaned criterion` | Criterio pendiente de asignar |
| `RESOURCE_CONFLICT` | Ese nombre/orden ya está en uso (mensaje orientado al problema) |
| `EVENT_LOCKED` | 🔒 La competencia está abierta. La configuración de planillas ya no puede modificarse. |

Valores internos/API no cambian.
