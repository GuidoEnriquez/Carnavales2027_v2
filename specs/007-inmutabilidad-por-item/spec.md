# Spec 007 - Inmutabilidad por ítem y confirmación de voto

## Estado
- **Fase SDD:** Redacción de Spec (Pendiente de aprobación).
- **Trazabilidad:** no hay fuente de aprobación registrada ni `validation.md`. **[NECESITA ACLARACIÓN]** antes de declararla implementada o aceptada.
- **Fuente:** Requisito de usuario del 2026-09-01 (Chat).
- **Relación:** Sobrescribe el RF-62 de la Spec 004. Elimina la posibilidad de editar o "quitar" una decisión de puntaje una vez confirmada.

## Objetivo
Garantizar que el jurado reflexione y confirme cada voto individual antes de registrarlo, y volver ese voto inmutable de forma inmediata (por ítem) tras su confirmación, sin esperar al cierre de toda la planilla.

## Alcance
Incluye:
- Mostrar un modal de confirmación individual en la interfaz del jurado cuando selecciona una nota (1-10) o la opción "No se presentó".
- Bloquear en la API (servidor) cualquier intento de modificación o eliminación de un score que ya tenga estado `SCORED` o `NOT_PRESENTED`.
- Actualizar la UI del jurado para reflejar visualmente que un ítem puntuado ya no puede ser alterado.

Excluye:
- Cierre general de la planilla o de la votación por noche (ya cubierto en specs 004 y 006).

## Requisitos funcionales
- **RF-77 (Modal de confirmación):** Cuando el jurado seleccione una puntuación ordinaria (1-10) o "No se presentó" para un ítem `PENDING`, la interfaz DEBE mostrar un diálogo modal de advertencia indicando el contexto y el puntaje seleccionado (ej. "Usted está por votar X. ¿Desea confirmar?").
- **RF-78 (Inmutabilidad por ítem - API):** El servidor DEBE rechazar con error HTTP 409 cualquier petición de actualización sobre un ítem de evaluación que ya se encuentre en estado `SCORED` o `NOT_PRESENTED`, independientemente de si la planilla sigue abierta.
- **RF-79 (Bloqueo en UI):** Una vez que un ítem es puntuado y confirmado, la interfaz del jurado DEBE deshabilitar los controles de selección de puntaje para dicho ítem y eliminar la acción "Quitar decisión" (derogando el RF-62 de la Spec 004).
