# Spec 013 - Suplencias priorizadas

## Estado

- **Fase SDD:** aprobada para implementacion el 2026-09-02.
- **Fuente:** decision de producto del 2026-09-02: el suplente solo puede votar cuando ADMIN confirma que su titular no presento una planilla completa; cada suplente queda vinculado a un titular fijo por noche y especialidad.
- **Incrementos impactados:** Spec 002 (asignaciones), Spec 003 (apertura de planillas), Spec 004 (cierre con pendientes) y Spec 007 (inmutabilidad por item).

## Objetivo

Dar prioridad efectiva al jurado titular sin perder trazabilidad: el suplente queda en espera y solo ADMIN, con 2FA y motivo, puede activarlo si el titular no presento su planilla o la dejo incompleta.

## Alcance

Incluye:

- Pareja fija `PRIMARY`/`SUBSTITUTE` del mismo evento, noche y especialidad.
- Planilla inicial exclusiva para la asignacion titular.
- Activacion transaccional y auditada del suplente por ADMIN.
- Preservacion de la planilla del titular como `REPLACED`, sin modificar sus decisiones inmutables ni bloquear el cierre.
- Creacion de la planilla del suplente dentro de la misma transaccion cuando la ventana ya esta abierta.
- UI ADMIN para configurar la pareja y activar al suplente con confirmacion y motivo.

Excluye:

- Activacion automatica por hora, timeout o ausencia de conexion.
- Votos simultaneos, desempate, penalizaciones, resultados, escrutinio, actas y Offline-First.

## Requisitos funcionales

- **RF-104.** Un `SUBSTITUTE` DEBE vincularse a un unico `PRIMARY` activo del mismo evento, noche y especialidad; un `PRIMARY` puede tener como maximo un suplente activo.
- **RF-105.** Al abrir la votacion, el sistema DEBE crear planillas solo para asignaciones `PRIMARY`; una asignacion `SUBSTITUTE` en espera no puede leer, guardar ni confirmar una planilla.
- **RF-106.** Solo ADMIN con 2FA puede activar el suplente vinculado, con motivo obligatorio, cuando la planilla del titular no esta `SUBMITTED`.
- **RF-107.** Si la planilla del titular esta `SUBMITTED`, la activacion DEBE rechazarse sin modificar asignaciones ni planillas.
- **RF-108.** La activacion DEBE revocar titular y reserva, crear una nueva asignacion `PRIMARY` para el suplente y conservar el vinculo historico con la asignacion titular reemplazada.
- **RF-109.** Si existe una planilla `OPEN` del titular, la activacion DEBE transicionarla a `REPLACED`, preservando scores y auditoria. Esa planilla no DEBE bloquear el cierre ni contar como voto valido.
- **RF-110.** Si la ventana esta abierta, la activacion DEBE crear la planilla y los scores del suplente dentro de la misma transaccion. Si no esta abierta, la apertura posterior crea una unica planilla para la nueva asignacion titular.
- **RF-111.** La activacion, las revocaciones y la transicion de planilla DEBEN ser atomicas, serializadas y auditadas sin puntajes.

## Criterios de aceptacion

- Una pareja titular/suplente consume dos cupos, pero solo el titular recibe planilla inicial.
- El suplente no puede acceder a una planilla mientras esta en espera.
- ADMIN puede activar solo al suplente vinculado cuando el titular no presento o dejo incompleta su planilla.
- Una carrera entre la confirmacion titular y la activacion deja exactamente un voto valido.
- El cierre ignora planillas `REPLACED` y sigue bloqueando toda planilla votante con items `PENDING`.
- Las decisiones ya confirmadas del titular permanecen inmutables aun si su planilla es reemplazada.
