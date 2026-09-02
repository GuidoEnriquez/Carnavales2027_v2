# Plan - Spec 013

1. Agregar migracion incremental para el vinculo fijo de reserva y el estado terminal `REPLACED` de planilla, con guardas de evento/noche/especialidad, historia y transicion valida.
2. Cambiar la apertura y acceso a planillas para que solo asignaciones `PRIMARY` activas sean votantes.
3. Incorporar `activateJudgeSubstitute` en una transaccion que bloquee titular, reserva, planilla y ventana; revoca las dos asignaciones originales, crea el reemplazo titular y genera su planilla si corresponde.
4. Exponer la accion ADMIN+2FA y adaptar el panel de asignaciones para configurar y mostrar parejas, y activar solo reservas elegibles con motivo.
5. Cubrir persistencia, API y cliente: prioridad, ausencia, incompletitud, titular presentado, concurrencia, secreto, cierre y accesibilidad.
6. Validar migraciones, suites API/DB/cliente, build, lint/typecheck disponibles, diff y evidencia real.
