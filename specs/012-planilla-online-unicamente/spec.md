# Spec 012 — Planilla online únicamente

## Estado

- **Fase SDD:** aprobada para implementación el 2026-09-02.
- **Fuentes:** decisión de producto 2026-09-02, Spec 005 y la Constitución.
- **Dependencias:** Specs 004, 006, 007 y 009.

## Objetivo

Retirar la operación Offline-First no aceptada del flujo actual de jurado. La planilla solo confirma decisiones después de una respuesta autoritativa online.

## Alcance

- La UI no crea outbox, cache de planillas ni solicitudes automáticas a `/sync`.
- Guardar una decisión usa el endpoint online existente y actualiza la UI únicamente después de éxito.
- Confirmar una planilla usa el endpoint online existente y conserva los rechazos de completitud.
- Ante error de red, la decisión sigue `PENDING` en pantalla y se informa que debe reintentarse con conexión.
- Se conserva temporalmente el endpoint `/sync` y el almacenamiento heredado para que clientes ya desplegados puedan completar su transición; el cliente actual no los consume. Su retiro definitivo requiere evidencia de actualización y un incremento posterior.

## Fuera de alcance

- Activar, mejorar o validar Offline-First.
- Borrar automáticamente operaciones locales heredadas o intentar migrarlas; no se pierde ni se sincroniza de forma silenciosa información local.
- Cambios a inmutabilidad, completitud, roles, PWA de recursos estáticos o dominio de votación.

## Requisitos funcionales

- **RF-106.** EL CLIENTE DEBE enviar cada decisión solo al endpoint online autoritativo y reflejarla después de una respuesta exitosa.
- **RF-107.** SI falla la red o el servidor rechaza una decisión, EL CLIENTE DEBE mantener el estado visible previo, informar el error y no persistir una operación local para reintento automático.
- **RF-108.** EL CLIENTE NO DEBE presentar mensajes ni controles de outbox, sincronización pendiente, descarte local o voto guardado en dispositivo.
- **RF-109.** EL CLIENTE DEBE conservar el indicador de conectividad como información, sin usarlo para habilitar votos locales.

## Criterios de aceptación

- Una decisión 1–10 o `No se presentó` solo se bloquea en UI tras respuesta exitosa de API.
- Un fallo de red no modifica la planilla ni crea datos locales nuevos.
- La confirmación conserva el modal de pendientes y el cierre definitivo ya aprobados.
- Las pruebas cubren éxito, fallo de red, rechazo de completitud, inmutabilidad y los tres viewports de Spec 009.
