# Spec 028 — Competencia: jerarquia de cabecera y orden automatico de tipos y especialidades

## Estado

Aprobada por product owner el 2026-09-15.

## Objetivo

Mejorar la jerarquia visual de la pagina Administracion > Competencia y reemplazar el orden manual de Tipos de participacion y Especialidades por un sistema automatico al crear y un reordenamiento posterior via Subir/Bajar.

## Alcance

- Cabecera de Competencia: verificar y pulir la jerarquia existente (eyebrow, titulo, pestañas).
- Tipos de participacion (`event_category`): orden automatico al crear, reordenamiento por Subir/Bajar, sin campo numerico manual.
- Especialidades (`event_specialty`): mismo comportamiento que Tipos de participacion.
- Backend: service, rutas y auditoria para auto-orden y reorder.
- Tests API y cliente.

## Fuera de alcance

- Comparsas, rubros, matriz de planillas, jornadas, u otras entidades.
- Nueva migracion: se reutiliza el patron advisory-lock (Spec 027) y swap con offset (Spec 027) sin modificar constraints.
- Cabecera global (AppNavigation) ni navegacion del drawer.

## Requerimientos funcionales

- **Spec-028/RF-171.** AL CREAR un Tipo de participacion o una Especialidad, el SISTEMA DEBE asignar automaticamente el `display_order` como `MAX(display_order) + 1` dentro del evento, sin requerir que el administrador indique un valor manual.
- **Spec-028/RF-172.** EL SISTEMA DEBE permitir al administrador modificar el orden de un Tipo de participacion o Especialidad existente mediante botones "Subir" y "Bajar" (intercambio de posicion con el vecino adyacente).
- **Spec-028/RF-173.** AL INTERCAMBIAR el orden de dos elementos adyacentes, EL SISTEMA DEBE validar la concurrencia optimista: si el `expectedOrder` o `expectedNeighborOrder` no coinciden con el estado actual, DEBE rechazar con 409 `ORDER_CONFLICT`. Si no existe vecino en la direccion indicada, DEBE rechazar con 409 `ORDER_BOUNDARY`.
- **Spec-028/RF-174.** AL DESACTIVAR un Tipo de participacion o Especialidad (soft-delete), EL SISTEMA DEBE preservar los `display_order` existentes con sus huecos. No se permite renumerar automaticamente. Un nuevo registro recibe `MAX(display_order) + 1`.
- **Spec-028/RF-175.** La interfaz de creacion y edicion de Tipos de participacion y Especialidades DEBE excluir el campo numerico de orden. El orden solo se modifica via Subir/Bajar.
- **Spec-028/RF-176.** La cabecera de la pagina Competencia DEBE mostrar: (a) etiqueta pequena "COMPETENCIA" (eyebrow), (b) titulo principal con el nombre del evento (`event.name`), (c) boton "Volver". La navegacion interna de pestañas DEBE ubicarse debajo de la linea divisoria del titulo, sin duplicar el titulo ni la navegacion global.

## Requerimientos no funcionales

- **Spec-028/RNF-38.** El intercambio de orden DEBE usar un patron seguro ante concurrencia: lock del evento (`FOR UPDATE`) para serializar con apertura, verificacion de adyacencia y unicidad, y swap transaccional (offset +1000000) compatible con el constraint `UNIQUE (event_id, display_order)` sin necesidad de constraints DEFERRABLE.
- **Spec-028/RNF-39.** Cada operacion de creacion y reordenamiento DEBE generar un evento de auditoria (`CATEGORY_CREATED`, `CATEGORY_REORDERED`, `SPECIALTY_CREATED`, `SPECIALTY_REORDERED`) con before/after y contexto.
- **Spec-028/RNF-40.** Las operaciones de creacion y reordenamiento DEBEN estar bloqueadas cuando el evento no esta en estado `CONFIGURING` (409 `EVENT_LOCKED`).
- **Spec-028/RNF-41.** La interfaz DEBE ser responsive en viewports 390x844, 768x1024 y 1440x900.

## Criterios de validacion

- Crear 3 tipos de participacion sin especificar orden: reciben displayOrder 1, 2, 3 segun el orden de creacion.
- Crear una especialidad sin especificar orden: recibe displayOrder 1; una segunda recibe 2.
- Desactivar el tipo #2 (orden 2): el tipo #1 queda en 1 y #3 en 3 (hueco preservado).
- Crear un nuevo tipo despues de desactivar #2: recibe displayOrder 4 (MAX+1).
- Subir/Bajar intercambia correctamente dos elementos adyacentes.
- Subir el primero o Bajar el ultimo produce 409 ORDER_BOUNDARY.
- Intentar reordenar con expectedOrder desactualizado produce 409 ORDER_CONFLICT.
- Con evento OPEN, los botones de crear, editar y reordenar estan ocultos/deshabilitados.
- Formularios de crear/editar no contienen campo numerico de orden.
- Cabecera muestra eyebrow COMPETENCIA, titulo = event.name, Volver, y pestañas debajo del divisor.
- Suites API/DB/cliente y build pasan.
