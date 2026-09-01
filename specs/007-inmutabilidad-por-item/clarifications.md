# Clarificaciones - Spec 007

| Tema | Decisión |
|---|---|
| Derogación de RF-62 (Spec 004) | La posibilidad de "deshacer" o "quitar decisión" (volver de `SCORED` a `PENDING`) introducida en la Spec 004 queda oficialmente derogada. Una vez que un voto se confirma en el modal, es inamovible. |
| Modal de confirmación | El modal debe mostrar claramente la nota seleccionada (o "No se presentó") y a quién se le está asignando, previniendo errores de "dedo" (misclicks). |
| Offline-First | Conexión y sincronización son una funcionalidad futura; el código exploratorio de Spec 005 deberá reconciliarse con esta regla solo si un incremento SDD futuro lo autoriza. |
| Errores del jurado tras confirmar | Al volverse inmutable, cualquier error humano que se confirme en el modal no podrá ser modificado por el jurado bajo ninguna circunstancia. Cualquier futura corrección extrema requerirá un procedimiento administrativo de Escrutinio (fuera del alcance de esta spec). |
