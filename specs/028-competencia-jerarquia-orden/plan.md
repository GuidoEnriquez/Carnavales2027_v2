# Plan - Spec 028: Competencia: jerarquia de cabecera y orden automatico

## Enfoque

Cambio acotado al dominio de configuracion de competencia (Tipos de participacion y Especialidades). El auto-orden al crear se implementa a nivel de servicio con advisory lock; el reordenamiento posterior usa Subir/Bajar con swap transaccional por offset. La cabecera requiere solo verificacion y pulido cosmético. No se toca votacion, resultados, actas, rubros, comparsas ni jornadas.

## Decisiones de implementacion

1. **Backend service** (`category-service.js`, `specialty-service.js`):
   - `createCategory`/`createSpecialty`: ignoran `displayOrder`; dentro de la transaccion, `pg_advisory_xact_lock` por evento + `COALESCE(MAX(display_order)+1, 1)` en el INSERT.
   - Nuevas funciones `reorderCategory`/`reorderSpecialty`: validacion de direction/uuid/adjacency/expected orders, lock de evento `FOR UPDATE` (serialized con apertura), swap en 3 UPDATEs con offset +1000000, auditoria `*_REORDERED`.
   - `updateCategory`/`updateSpecialty`: dejan de aceptar/aplicar `displayOrder`.
2. **Backend routes** (`events.routes.js`):
   - Agregar `POST /categories/:categoryId/reorder` y `POST /specialties/:specialtyId/reorder` al loop de reorden existente.
   - Los errores `ORDER_CONFLICT`, `ORDER_BOUNDARY`, `EVENT_LOCKED`, `*_NOT_FOUND` y `TypeError` ya estan mapeados en `http-errors.js`.
3. **Frontend** (`AdminCompetenciaPage.jsx`):
   - `AdminCategoriesSection`/`AdminSpecialtiesSection`: quitar input "Orden" del formulario de creacion (body solo `{name}`).
   - Quitar input "Orden" del formulario de edicion; agregar botones Subir/Bajar con el patron de `AdminRubricsSection.reorder` (merge optimista, refetch ante ORDER_CONFLICT, disabled en bordes/escritura).
   - Seccion cabecera: sin cambios estructurales; verificar espaciado pestañas/divisor.
4. **Tests API** (`competencia-order-api.test.js` nuevo):
   - Auto-orden, huecos, concurrencia, reorder, validacion, auth, auditoria, EVENT_LOCKED.
   - Actualizar `categories-api.test.js` y `specialties-api.test.js` (quitar displayOrder de POST/PATCH).
5. **Tests cliente** (`AdminCompetenciaPage.test.jsx`):
   - Sin input de orden, body sin displayOrder, Subir/Bajar correctos, boundary states, OPEN oculta reorder.

## Orden de ejecucion

SDD (spec/plan/tasks) -> service -> routes -> tests API -> frontend -> tests cliente -> cabecera -> validacion integral.

## Validacion

Suites API y DB aisladas, tests de cliente y build Vite; comprobacion manual proporcional de la cabecera y los botones Subir/Bajar en 3 viewports.
