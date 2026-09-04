# Clarificaciones — Spec 016: Supervisión de Votación por VEEDOR

## Preguntas resueltas durante la redacción

1. **¿El VEEDOR ve todas las noches o solo la activa?**
   - **Decisión:** ve todas las noches competitivas del evento seleccionado que tengan actividad de votación (planillas o ventana registrada). No se restringe a «la noche activa» porque la supervisión puede abarcar varias jornadas. Las noches sin actividad simplemente no aparecen en el listado del monitor.

2. **¿Ve nombres de comparsas o de jurados en el detalle?**
   - **Decisión:** no. Por secreto de voto (Spec 003) y mínimo privilegio (SVC2-41), la vista solo expone **conteos agregados** por estado de planilla y el estado de la ventana de votación. No hay desglose por comparsa ni por jurado. El listado admin-only `GET .../voting/ballots` (con nombres de jurado) sigue fuera del alcance del VEEDOR.

3. **¿Cadencia de refresco aprobada?**
   - **Decisión:** polling cada **15 segundos** con `setInterval`, pausado cuando `document.visibilityState === "hidden"` y reanudado (con refresco inmediato) al volver a `visible`. Es suficiente para supervisión operativa sin sobrecargar la API; WebSockets quedan diferidos.

4. **¿Por qué un endpoint nuevo `GET /api/v1/monitor/events` en lugar de reutilizar `GET /api/v1/events`?**
   - **Decisión:** `GET /api/v1/events` está guardado por `requireAdmin` (todo el router de `events.routes.js` es ADMIN). Relajar esa guarda ampliaría la superficie de administración hacia VEEDOR. Se opta por un endpoint de solo lectura dedicado, bajo `requireVotingObserver` ya existente, que devuelve exactamente los agregados que la vista necesita (eventos + noches competitivas + conteos), respetando mínimo privilegio.

5. **¿El ADMIN también puede usar la vista de supervisión?**
   - **Decisión:** sí. `requireVotingObserver` ya admite `ADMIN` y `VEEDOR`. El guard de cliente `RequireVotingObserverRole` replica esa combinación solo para UX. La vista es de lectura y no sustituye a `#/admin/voting` (que tiene acciones de abrir/cerrar).

6. **¿Qué significa cada conteo para el VEEDOR?**
   - **Decisión (lenguaje de negocio en UI):**
     - `OPEN` → «En carga»
     - `SUBMITTED` → «Confirmadas»
     - `REOPENED` → «Reabiertas (histórico)»
     - `REPLACED` → «Reemplazadas (histórico)»
     - `total` → planillas votantes (`OPEN + SUBMITTED + REOPENED`); `REPLACED` no cuenta como votante (Spec 013).

7. **¿Se muestra algo si aún no se abrió la votación?**
   - **Decisión:** sí, estado explícito «Votación no abierta» (`votingStatus: NOT_OPEN`) con conteos en cero, para que el VEEDOR distinga «no empezó» de «error de carga».

## [NECESITA ACLARACIÓN]

- Ninguna pendiente al 2026-09-04. Las decisiones 1–7 fueron tomadas con el responsable de producto al aprobar `PLAN-role-ux.md` (Fases 0 y 3).
