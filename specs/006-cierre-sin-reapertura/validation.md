# Validacion - Spec 006: Cierre de votacion sin reapertura

## Estado

- **Implementacion y validacion automatizada completadas:** 2026-08-31.
- **Validacion manual:** completada el 2026-09-01 por el responsable de producto en Chrome de escritorio, con emulación responsive de 320 px y 768 px, además de escritorio.

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

## Evidencia manual reproducible

### Entorno

- API: `http://localhost:3000`.
- Cliente: `http://localhost:5173/#/login`.
- PostgreSQL local aislado: `localhost:5433`.
- Datos: ejecutar `node src/scripts/seed-spec-006.js` desde `api/` con al menos una identidad `JUDGE` registrada en la base de desarrollo. El seed abre la primera noche competitiva de Goya 2027 y genera 50 ítems pendientes para una planilla.
- Acceso: iniciar sesión con un `ADMIN` y completar 2FA. En desarrollo, el OTP se registra solo en la consola o log de la API.

### Casos

1. Abrir `#/admin/voting`, seleccionar Goya 2027 y su primera noche competitiva, y pulsar `Cerrar votación`.
2. Verificar que la ventana continúa abierta, que aparece el diálogo `Faltan votos por resolver` y que identifica jurado, comparsa, rubro e ítem para los 50 pendientes.
3. Con teclado, verificar foco inicial en `Volver al control`, recorrido con Tab, cierre con Escape y retorno de foco a `Cerrar votación`.
4. Recorrer la lista hasta el ítem 50 sin perder el botón de cierre ni requerir precisión de mouse.
5. Repetir los casos 1 a 4 en 320 px, 768 px y escritorio, incluyendo interacción táctil o emulación táctil.

### Registro ejecutado

| Campo | Evidencia |
|---|---|
| Fecha | 2026-09-01 |
| Ejecutante | Responsable de producto |
| Navegador | Chrome de escritorio |
| Dispositivo | Emulación responsive, incluida interacción táctil emulada; no se usaron dispositivos físicos |
| Viewports | 320 px, 768 px y escritorio |
| Resultado | Los casos 1 a 5 finalizaron correctamente, sin incidencias reportadas. |
