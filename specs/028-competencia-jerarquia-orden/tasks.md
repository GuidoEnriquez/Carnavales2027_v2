# Tasks - Spec 028: Competencia: jerarquia de cabecera y orden automatico

## Estado general

| ID | Estado | Dependencias |
|---|---|---|
| T01 | Completada | Ninguna |
| T02 | Completada | T01 |
| T03 | Completada | T02 |
| T04 | Completada | T03 |
| T05 | Completada | T04 |

## T01 - Formalizar el incremento

**RF:** Spec-028/RF-171 a RF-176, Spec-028/RNF-38 a RNF-41.
**Hecho cuando:** spec, clarificaciones, plan, tareas y validacion inicial existen; `docs/source-map.md` y `docs/sdd-status.md` identifican Spec 028.

## T02 - Backend: auto-orden y reorder

**RF:** Spec-028/RF-171 a RF-174; Spec-028/RNF-38, RNF-39, RNF-40.
**Alcance:** `category-service.js` y `specialty-service.js`: auto-orden en create (advisory lock + MAX+1), `reorderCategory`/`reorderSpecialty` (lock evento + swap offset), PATCH sin displayOrder. `events.routes.js`: rutas POST `/:id/reorder`. Auditoria `CATEGORY_REORDERED`/`SPECIALTY_REORDERED`.
**Hecho cuando:** tests API especificos pasan (create auto, reorder, conflict, boundary, auth, audit, locked).

## T03 - Tests API y actualizacion de existentes

**RF:** Spec-028/RF-171 a RF-174.
**Alcance:** nuevo `competencia-order-api.test.js` con casos completos; actualizar `categories-api.test.js` y `specialties-api.test.js` (quitar displayOrder de POST/PATCH, asertar auto-orden).
**Hecho cuando:** suite API completa pasa sin fallos.

## T04 - Frontend: formulario sin orden + Subir/Bajar

**RF:** Spec-028/RF-172, RF-175, RF-176; Spec-028/RNF-41.
**Alcance:** `AdminCompetenciaPage.jsx`: quitar input Orden de crear/editar, agregar Subir/Bajar en categorias y especialidades, verificar cabecera. Tests cliente actualizados.
**Hecho cuando:** tests cliente y build pasan.

## T05 - Validacion integral y cierre

**RF:** Todos.
**Alcance:** suites API/DB/cliente, build, lint, diff sin secretos, `validation.md` con evidencia, actualizacion de `docs/source-map.md`, `docs/sdd-status.md` y `AGENTS.md`.
**Hecho cuando:** `validation.md` contiene evidencia real y no quedan fallos ni tareas bloqueadas.
