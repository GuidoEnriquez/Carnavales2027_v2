# Clarificaciones - Spec 013

1. **Disparador:** no hay activacion automatica. ADMIN decide la ausencia o incompletitud y activa al suplente con motivo.
2. **Prioridad:** si el titular ya envio `SUBMITTED`, el suplente no puede activarse.
3. **Incompletitud:** una planilla titular `OPEN`, incluso con decisiones ya confirmadas en algunos items, puede ser reemplazada por ADMIN.
4. **Pareja:** cada suplente se reserva para un titular fijo de la misma noche y especialidad; no existe bolsa intercambiable.
5. **Historia:** la planilla titular reemplazada conserva sus scores y auditoria, pero queda excluida de cierre, conteos votantes y resultados.
6. **Tipo activo:** al activarse, el suplente obtiene una nueva asignacion `PRIMARY` vinculada a la titular revocada; su reserva `SUBSTITUTE` se revoca y no se reescribe.
7. **Datos existentes:** una migracion conserva planillas ya `SUBMITTED`; las planillas `OPEN` de suplentes previas pasan a `REPLACED` para impedir votos nuevos bajo la regla vigente.
