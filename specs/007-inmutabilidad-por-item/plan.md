# Plan Técnico - Spec 007

## 1. Modificación de Reglas en Backend (API)
- Actualizar el controlador/servicio de votación que procesa la mutación de votos.
- Agregar una guardia autoritativa: si el registro actual del score en la base de datos ya tiene `evaluation_state IN ('SCORED', 'NOT_PRESENTED')`, lanzar un error `SCORE_ALREADY_SUBMITTED` o `SCORE_IMMUTABLE`, bloqueando la sobreescritura.
- Ajustar tests automatizados (`voting-api.test.js`) que asumían la mutabilidad del score, para que ahora validen que el servidor devuelve 409 Conflict al intentar sobrescribir.

## 2. Implementación de Interfaz del Jurado (Cliente)
- Modificar el componente de selección de voto en la vista del jurado.
- Al hacer clic en un puntaje, en lugar de invocar la mutación de guardado de inmediato, se abre el diálogo de confirmación integrado en `JudgeBallotPage.jsx`.
- El modal mostrará el puntaje seleccionado y pedirá confirmación explícita (Sí/Ok vs Cancelar). Al confirmar, se ejecuta la llamada a la API.
- Eliminar por completo el botón y la lógica de "Quitar decisión" que permitía regresar a `PENDING`.
- Deshabilitar o bloquear visualmente los botones de puntaje de un ítem si este ya fue evaluado (`evaluationState !== 'PENDING'`).

## 3. Consideraciones Offline (Outbox)
- Asegurar que el estado local de IndexedDB trate los ítems confirmados como inmutables y no permita apilar nuevas operaciones de actualización para el mismo ítem en la cola de sincronización.
