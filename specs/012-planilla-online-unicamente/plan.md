# Plan — Spec 012

1. Simplificar `JudgeBallotPage` para cargar, guardar y confirmar exclusivamente mediante API online.
2. Eliminar de la UI los estados y controles de outbox; conservar el indicador de conectividad y los modales críticos existentes.
3. Mantener `ballot-store` y `/sync` como compatibilidad transitoria sin consumidores nuevos.
4. Ajustar las pruebas de planilla para respuestas exitosas, red caída y rechazo de completitud.
5. Ejecutar cliente, API, DB, build y comprobación manual proporcional.
