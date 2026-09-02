# Tasks - Spec 013

| Tarea | Estado | Evidencia |
| --- | --- | --- |
| T01 Persistencia y migracion | Completada | Migraciones 059-061 y pruebas DB/API |
| T02 Servicios, autorizacion y API | Completada | Servicio transaccional, ruta ADMIN+2FA y 80 pruebas API |
| T03 Cliente ADMIN y jurado | Completada | Pareja fija, activacion con motivo y prueba de componente |
| T04 Pruebas automatizadas | Completada | API 80, DB 38 y cliente 68 passed |
| T05 Validacion y evidencia | Completada | Validacion automatica y aprobacion manual de Asignaciones en movil, tablet, desktop, teclado y tactil |

## T01 - Persistencia y migracion

- Vincular reserva y titular, modelar `REPLACED` y conservar datos previos sin borrado.
- Validar parejas, transiciones e inmutabilidad en PostgreSQL.

## T02 - Servicios, autorizacion y API

- Crear la activacion ADMIN+2FA con motivo y transaccion completa.
- Restringir planillas iniciales y acceso del suplente en espera.

## T03 - Cliente

- Configurar pareja fija y mostrar reserva, estado y activacion protegida contra error.

## T04 - Pruebas

- Probar reglas de servidor, concurrencia, cierre, secreto e interfaz.

## T05 - Validacion

- Ejecutar las suites aplicables, migraciones, build y revision de alcance.
