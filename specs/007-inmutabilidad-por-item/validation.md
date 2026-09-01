# Validacion - Spec 007: Inmutabilidad por item

## Estado

- **Aprobacion formal:** 2026-09-01, por decision del responsable de producto.
- **Implementacion y validacion automatizada:** completadas el 2026-09-01.
- **Validacion manual:** completada el 2026-09-01 por el responsable de producto en Chrome de escritorio, con emulación responsive de 320 px y 768 px, además de escritorio.

## Cobertura de requisitos

| Requisito | Evidencia automatizada | Implementacion verificada |
|---|---|---|
| RF-77 | `client/src/tests/JudgeBallotPage.test.jsx` cubre el dialogo de confirmacion antes de guardar una decision. | `client/src/pages/JudgeBallotPage.jsx` abre el dialogo al seleccionar 1 a 10 o `No se presento`. |
| RF-78 | `api/src/tests/voting-api.test.js` verifica que reescribir un score confirmado devuelve HTTP 409 y `SCORE_IMMUTABLE`. | `api/src/modules/ballots/ballot-service.js` rechaza `SCORED` y `NOT_PRESENTED` antes de actualizar. |
| RF-79 | `client/src/tests/JudgeBallotPage.test.jsx` cubre el bloqueo del item tras confirmar. | `client/src/pages/JudgeBallotPage.jsx` deshabilita los controles cuando `evaluationState` deja de ser `PENDING`; no contiene accion para quitar una decision. |

## Evidencia ejecutada

| Area | Comando | Resultado |
|---|---|---|
| API | `npm test` en `api/` | 60 passed, 0 failed. |
| Persistencia | `npm run db:test` en `api/` | 27 passed, 0 failed. |
| Cliente | `npm test` en `client/` | 18 archivos, 52 passed, 0 failed. |
| Build | `npm run build` en `client/` | Exitoso. |
| Migraciones | `npm run db:migrate -- --status` en `api/` | 001 a 052 aplicadas; sin pendientes. |
| Revision | `git diff --check` | Sin errores. |

No hay scripts `lint` ni `typecheck` definidos en los `package.json` de API o cliente.

## Comprobacion manual reproducible

### Entorno

- API: `http://localhost:3000`.
- Cliente: `http://localhost:5173/#/login`.
- Datos: ejecutar `node src/scripts/seed-spec-006.js` desde `api/` con una identidad `JUDGE` registrada. El seed prepara una planilla abierta con 50 ítems pendientes.
- Acceso: iniciar sesión con el jurado preparado y completar 2FA. En desarrollo, el OTP se registra solo en la consola o log de la API.

Antes de cerrar T08 se debe registrar navegador y version, dispositivo o emulacion, ejecutante, fecha y resultado de los siguientes casos en 320 px, 768 px y escritorio:

1. Seleccionar una nota y confirmar: el dialogo identifica comparsa, rubro, item y valor.
2. Cancelar el dialogo: el item conserva `PENDING` y los controles siguen operativos.
3. Confirmar `No se presento`: el item queda bloqueado y no permite nueva eleccion.
4. Recorrer dialogo y controles con teclado: foco inicial, Tab, Enter, Escape y retorno de foco al disparador.
5. Repetir las acciones mediante tacto o emulacion tactil sin depender de `hover` ni precision de mouse.

### Registro ejecutado

| Campo | Evidencia |
|---|---|
| Fecha | 2026-09-01 |
| Ejecutante | Responsable de producto |
| Navegador | Chrome de escritorio |
| Dispositivo | Emulación responsive, incluida interacción táctil emulada; no se usaron dispositivos físicos |
| Viewports | 320 px, 768 px y escritorio |
| Resultado | Los casos 1 a 5 finalizaron correctamente, sin incidencias reportadas. |
