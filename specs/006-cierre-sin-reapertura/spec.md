# Spec 006 - Cierre de votacion sin reapertura

## Estado

- **Fase SDD:** implementada y validada automáticamente; resta comprobación manual con teclado, lista extensa y viewports.
- **Fuente:** decision de producto del 2026-08-31, registrada en esta spec; SVC2-14, SVC2-26, SVC2-27 y SVC2-80.
- **Relacion:** reemplaza exclusivamente la reapertura administrativa de I3. Mantiene vigente la completitud de Spec 004.

## Objetivo

Impedir que una planilla confirmada vuelva a editarse. Cuando ADMIN intente cerrar una votacion que conserve decisiones pendientes, el sistema debe conservar la ventana abierta y mostrar un modal que identifique los votos faltantes para resolverlos sin buscar manualmente los items.

## Alcance

Incluye:

- Eliminar la transicion nueva `SUBMITTED -> REOPENED` de la persistencia y el servicio.
- Retirar el endpoint y el control administrativo de reapertura.
- Mostrar a ADMIN un dialogo modal accesible al rechazar el cierre por pendientes.
- Enumerar jurado, comparsa, rubro e item de cada decision pendiente.

Excluye:

- Marcar automaticamente puntajes pendientes como ausencias o `NOT_PRESENTED`.
- Reabrir la ventana de votacion cerrada.
- Subsanaciones, penalizaciones, escrutinio, resultados y actas.

## Requisitos funcionales

- **RF-67.** UNA planilla `SUBMITTED` NO DEBE poder transicionar a `REOPENED` por ningun endpoint, servicio ni mutacion directa autorizada por la base de datos.
- **RF-68.** EL SISTEMA NO DEBE exponer el endpoint ni el control ADMIN de reapertura de planillas.
- **RF-69.** CUANDO ADMIN intente cerrar una votacion con al menos un score `PENDING`, EL SISTEMA DEBE mantener la ventana abierta y mostrar un dialogo modal que enumere jurado, comparsa, rubro e item de cada voto faltante.
- **RF-70.** EL dialogo de cierre rechazado DEBE tener titulo y descripcion accesibles, recibir foco inicial, cerrarse mediante una accion explicita o `Escape`, devolver el foco al disparador y funcionar en movil, tablet y escritorio con una lista desplazable.

## Compatibilidad historica

Las planillas historicas que ya esten en `REOPENED` pueden finalizar su unica edicion y confirmar nuevamente. No se permite crear una reapertura nueva ni se modifican registros de auditoria existentes.

## Contrato HTTP

- Se retira `POST /api/v1/events/:eventId/ballots/:ballotId/reopen`.
- `POST /api/v1/events/:eventId/nights/:nightId/voting/close` conserva el error `VOTING_CLOSE_INCOMPLETE_BALLOTS` y devuelve el detalle de cada pendiente sin puntajes.

## Criterios de aceptacion

- Una peticion al endpoint retirado responde 404.
- PostgreSQL rechaza una nueva transicion `SUBMITTED -> REOPENED`.
- La UI ADMIN no muestra controles ni formularios de reapertura.
- Un cierre con pendientes deja la votacion abierta y abre un modal con el detalle completo de los pendientes.
- El modal cumple los requisitos de foco, teclado, tacto y viewports definidos en RF-70.
