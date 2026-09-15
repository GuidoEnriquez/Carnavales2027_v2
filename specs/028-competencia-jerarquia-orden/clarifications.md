# Clarificaciones - Spec 028: Competencia: jerarquia de cabecera y orden automatico

## Decisiones confirmadas (product owner, 2026-09-15)

| Tema | Decision |
|---|---|
| Eliminacion = desactivacion | "Eliminar" un Tipo de participacion o Especialidad se refiere a la desactivacion existente (checkbox Activa = false). No existe borrado fisico (trigger bloquea DELETE). |
| Huecos tras desactivacion | Al desactivar un elemento, los display_order se preservan con sus huecos. No se renumeran. Un nuevo elemento recibe MAX(display_order)+1. |
| UX de reorden | Subir/Bajar (mismo patron que items/criterios). Sin input numerico manual. |
| Titulo cabecera | Usa `event.name` dinamico (no hardcodeado). |
| Titulo literal "Carnavales 2027" | El user confirma que "Carnavales 2027" era un ejemplo; el t性和 real es event.name. |
| PATCH displayOrder | El endpoint PATCH de categorias/especialidades deja de aceptar displayOrder. Solo se modifica via reorder. |
| Migracion | No se requiere nueva migracion. El auto-orden es service-level con advisory lock; el swap usa offset +1000000. |

## Decisiones tecnicas

- Se reutiliza el patron de `createNight` (`event-service.js:100-132`) para el auto-orden: advisory lock por evento + `COALESCE(MAX+1,1)`.
- El intercambio de orden usa el patron de Spec 027 nights: 3 UPDATEs con offset +1000000 para mantener unicidad sin constraints DEFERRABLE.
- La funcion `reorderCategory`/`reorderSpecialty` replica la validacion de `reorderConfiguration` (direction, uuid, adjacency, expected orders) pero adaptada a flat lists por evento (no por rubro).
- Los eventos de auditoria usan la accion `CATEGORY_REORDERED`/`SPECIALTY_REORDERED` con contexto `{eventId, direction}` y before/after `[{id, displayOrder}, ...]`.
- La cabecera no requiere cambios estructurales: el eyebrow ya se renderiza en mayusculas via CSS (`text-transform: uppercase`).

## Pendiente

- Verificacion manual responsive de la cabecera y los botones Subir/Bajar en viewports 390x844, 768x1024 y 1440x900.
