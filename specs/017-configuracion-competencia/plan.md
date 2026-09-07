# Plan - Spec 017: Configuracion de competencia

## Estrategia

Implementar en unidades verticales pequenas, preservando primero los contratos cerrados. La migracion de datos precede a la API y la API precede a la interfaz. La maquina de estados operativa queda separada hasta resolver la aclaracion de apertura.

## Persistencia

- Renombrar `rubric.rubric_kind` a `rubric_type` para conservar datos sin mantener dos fuentes de verdad.
- Reemplazar la restriccion de valores por los cinco tipos aprobados.
- Agregar `resolution_method` y `evaluation_objective` como metadata.
- Agregar a `evaluation_item` orden, `required` y `allow_not_presented`; backfillear orden por rubro antes de exigir positividad y unicidad.
- Agregar `scoring_item_id` nullable para migracion historica y una FK compuesta que garantice mismo item, rubro y evento.
- Reasignar criterios historicos solo para rubros con exactamente un item activo.
- No crear `participation_type`; conservar `event_category` como entidad tecnica.
- Agregar columnas de estado solo en la tarea de estados y sin cambiar apertura hasta resolver la aclaracion.

## API

- Mantener servicios por dominio existentes.
- Derivar codigos ausentes en el servidor.
- Asignar el siguiente orden de item cuando consumidores existentes lo omitan.
- Exigir `scoringItemId` para criterios nuevos y permitir reasignarlo por PATCH para resolver historia.
- Exponer criterios pendientes por evento sin alterar readiness operativo de apertura hasta resolver la aclaracion; la publicacion futura si debera bloquearlos.
- Conservar deteccion de secretos por subcadena y permitir exclusivamente la propiedad exacta `allowNotPresented` con valor booleano. Rechazar nombres concatenados, sufijos numericos y estructuras anidadas sensibles antes de escribir SQL.

## Compatibilidad

- Actualizar resultados, penalizaciones, actas, scripts y pruebas SQL de `rubric_kind` a `rubric_type` en el mismo incremento.
- Mantener el nombre de dominio `rubricKind` dentro del resultado de Spec 010 si evita una ruptura innecesaria del cliente; el SQL lee `rubric_type`.
- No cambiar calculos: solo `NOMINATIVE` participa de Mejor Comparsa.

## Cliente

- Mantener Evento para identidad y jornadas.
- Crear Competencia para comparsas, tipos de participacion basados en categorias, especialidades, rubros e items/criterios.
- Eliminar el catalogo paralelo de tipos de participacion.
- Mostrar criterios dentro de su item y una lista de historicos sin asignar.
- Mantener la matriz como lectura derivada.

## Validacion

- Pruebas de migracion fresca y segunda ejecucion sin pendientes.
- Pruebas DB de FK compuesta, backfill y preservacion de resultados.
- Pruebas API de altas, codigos, orden, criterios y errores.
- Pruebas de cliente de navegacion, constructor jerarquico y matriz.
- Suite API, suite DB, suite cliente, build, lint/typecheck y `git diff --check`.
- Comprobacion manual en 390x844, 768x1024 y 1440x900 antes del cierre.

## Plan integral aprobado

1. Cerrar aclaraciones de inicio, versiones y jornadas antes de implementar sus contratos. No tocar migracion 066 ya aplicada ni el checksum compartido.
2. T07: corregir base existente. Agregar selector de tipo de sujeto usando valores actuales del backend, conservar formularios hasta guardado exitoso, bloquear envios repetidos, etiquetar controles y explicar metadata. Endurecer auditoria con pruebas de secretos anidados y variantes de nombres.
3. T08: integridad de criterios nuevos y reordenamiento atomico. Diagnosticar datos, definir nueva migracion incremental y contrato de intercambio con bloqueo transaccional; validar BD/API antes de conectar UI.
4. T09: constructor progresivo, filtros y preview sin escrituras, manteniendo matriz derivada. Reutilizar componentes existentes cuando no impliquen montar hooks de votacion real.
5. T10: revision explicita de categorias y jornadas. Preservar registros ambiguos; definir esquema y validaciones tras aclarar anio/temporada y momento de bloqueo.
6. T11/T05: versionado, estados y publicacion. Definir pertenencia de entidades a versiones y referencias de consumidores antes de migrar; no sustituir una version utilizada ni abrir votacion implicitamente.
7. T06: regresion integral, analisis estatico proporcional para JS/JSX, comprobacion manual y revision de diff/secretos. No declarar build equivalente a typecheck.

Cada unidad se detiene tras su validacion. T07 no requiere migracion porque restaura contratos existentes; las capacidades nuevas con impacto de datos requieren sus migraciones antes del frontend.

## Diseno T08

- Migracion 067 posterior a 066, sin reescribir checksums: trigger que impide nuevos criterios NULL y desasignaciones, preservando ediciones de huerfanos historicos con identidad y parentela intactas. FK compuesta vigente.
- Recrear solo las restricciones de orden de item y criterio como DEFERRABLE INITIALLY IMMEDIATE, mismas columnas/nombres. No cambiar claves referenciadas por FK ni borrar datos.
- POST /evaluation-items/:itemId/reorder y POST /rubric-criteria/:criterionId/reorder: body { direction, neighborId, expectedOrder, expectedNeighborOrder }. IDs de ruta autoritativos; ADMIN+2FA. Respuesta { changes: [{ id, displayOrder }] } con las dos filas modificadas.
- Bloquear evento antes de leer ordenes/vecinos o escribir hijos; alinear PATCH y altas relacionadas para evitar inversion de bloqueos. Revalidar pertenencia tras bloquear. Intercambio CASE en una transaccion difiriendo solo la restriccion de orden afectada y forzando validacion inmediata antes de auditoria/commit.
- Auditar una sola accion *_REORDERED con before/after de ambos ordenes y contexto. 409 ORDER_CONFLICT para solicitud obsoleta/no adyacente, ORDER_BOUNDARY para extremo, CRITERION_REASSIGNMENT_REQUIRED para huerfano. 404 para recurso inexistente y 400 para body invalido.
- Completar rubricId en respuesta de criterios historicos: la UI ya lo necesita para elegir candidatos del mismo rubro.
- Pruebas DB de guardas y preservacion, upgrade historico sobre esquema aislado transaccional (sin pretender que sustituye el runner fresco), idempotencia del runner real, API de autorizacion/auditoria/rollback/concurrencia. Actualizar fixtures de altas normales para enviar item.
- Tras validacion BD/API, conectar subir/bajar usando los ordenes actuales y recargar rubro ante conflicto. Controles accesibles, deshabilitados durante guardado y en extremos/evento OPEN. No incorporar filtros/preview ni reordenar categorias/especialidades en esta unidad.
