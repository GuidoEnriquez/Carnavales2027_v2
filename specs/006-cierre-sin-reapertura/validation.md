# Validacion - Spec 006: Cierre de votacion sin reapertura

## Estado

- **Implementacion y validacion automatizada completadas:** 2026-08-31.
- **Validacion manual completada:** 2026-09-01 (comprobación de modal con teclado, resoluciones responsive y lista extensa de 50 ítems).

## Evidencia requerida

| Area | Verificacion |
|---|---|
| Persistencia | La migracion rechaza `SUBMITTED -> REOPENED` y permite finalizar una planilla historica `REOPENED`. |
| API | La ruta de reapertura devuelve 404; el cierre con pendientes devuelve `VOTING_CLOSE_INCOMPLETE_BALLOTS` y su detalle. |
| Cliente | El control de reapertura no aparece; el cierre rechazado abre el modal accesible con todos los pendientes. |
| Accesibilidad | Foco inicial, cierre explicito y con `Escape`, retorno al disparador, lista extensa y 320 px, 768 px y escritorio (Validado manualmente). |
| General | DB tests, API tests, cliente, build, lint, typecheck, estado de migraciones y `git diff --check`. |

## Evidencia ejecutada

| Area | Comando | Resultado |
|---|---|---|
| Persistencia | `npm run db:test` en `api/` | 27 passed, 0 failed. Incluye rechazo de reapertura y finalizacion de una reapertura historica. |
| API | `npm test` en `api/` | 58 passed, 0 failed. Incluye ruta de reapertura retirada (404) y cierre con pendientes. |
| Cliente | `npm test` en `client/` | 48 passed, 0 failed. Incluye modal administrativo, detalle, ausencia de reapertura y cierre por `Escape`. |
| Build | `npm run build` en `client/` | Exitoso, 47 modulos transformados. |
| Migracion | `npm run db:migrate -- --status` en `api/` | 001-049 aplicadas, incluida `049_disable_ballot_reopen.sql`. |
| Revision | `git diff --check` | Sin errores. |

No hay scripts `lint` ni `typecheck` definidos en los `package.json` de API o cliente.

## Trazabilidad manual pendiente

La validación manual se registró como completada el 2026-09-01, pero no documenta navegador, dispositivo, ejecutante ni pasos reproducibles. Esa información queda **[NECESITA ACLARACIÓN]** antes de usarla como evidencia manual cerrada.
