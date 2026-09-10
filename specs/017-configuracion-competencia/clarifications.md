# Clarificaciones - Spec 017: Configuracion de competencia

## Decisiones confirmadas

| Tema | Decision |
|---|---|
| Pertenencia de criterios | Cada criterio nuevo pertenece a un item puntuable; se reemplaza el contrato de Spec 001/RF-01y sobre pertenencia directa al rubro. |
| Valor del criterio | Sigue siendo descriptivo y no recibe puntuacion propia. |
| Historia | Los criterios existentes se preservan. Solo se reasignan automaticamente cuando el rubro tiene exactamente un item activo. |
| Publicacion | Un criterio historico sin item bloquea publicacion hasta su reasignacion. |
| Tipo de participacion | Se reutiliza `event_category`; no se crea `participation_type`. |
| Edicion | Solo `DRAFT` es editable. `REVIEW`, `PUBLISHED` y `LOCKED` son de solo lectura. |
| Campos de item | `required` y `allow_not_presented` son metadata futura y no modifican Spec 004. |
| Resultados | `NOMINATIVE` conserva su semantica de Spec 010; tipos nuevos no ingresan a Mejor Comparsa. |
| Resolucion automatica | Los metodos de resolucion son metadata; no ejecutan formulas ni decisiones. |

## Compatibilidad obligatoria

- El cambio de nombre tecnico `rubric_kind` a `rubric_type` debe preservar datos y actualizar en el mismo incremento todos los servicios, seeds y pruebas que dependen de la clasificacion.
- No se permite dejar dos columnas editables que puedan divergir como fuentes de verdad.
- La API puede mantener temporalmente el alias de respuesta `rubricKind` solo donde sea consumido por resultados existentes; la persistencia tiene una unica fuente de verdad.
- La auditoria debe aceptar la propiedad funcional `allowNotPresented` sin dejar de detectar campos sensibles reales como OTP, token, password, secret, authorization o cookie.

## Pendiente

- **[NECESITA ACLARACION]** Relacion exacta entre `PUBLISHED`, `LOCKED` y la apertura de competencia.
- Mientras siga pendiente, Spec 017 no cambia la precondicion ni el efecto de `POST /events/:eventId/open` definidos por las specs vigentes.

## Pedido ampliado - decisiones pendientes

- El responsable solicita implementar el plan propuesto. Se aprueba su ejecucion incremental; las propuestas de dominio enumeradas para aprobacion siguen pendientes, no se interpretan como resueltas implicitamente.
- La primera unidad restaura formularios y endurece auditoria sin migraciones ni cambios de votos. El filtro conserva deteccion por subcadena para secretos, con excepcion exacta y booleana para allowNotPresented; la excepcion no se extiende a objetos ni nombres similares.

- **[NECESITA ACLARACION]** Inicio: confirmar si iniciar competencia bloquea atomicamente PUBLISHED -> LOCKED, sin abrir votacion de jornadas.
- **[NECESITA ACLARACION]** Versiones: definir si una nueva version puede entrar en vigencia despues del inicio y como afecta asignaciones y planillas existentes. Nunca reasignarlas silenciosamente.
- **[NECESITA ACLARACION]** Jornadas: definir fuente del anio esperado (campo explicito o temporada), si todas las jornadas deben compartirlo y si inconsistencias bloquean guardado o publicacion.
- El modelo preferido NOT_PRESENTED/score null difiere del contrato persistido de Spec 004 (estado diferenciado y score 0). Sin aprobacion explicita de migracion de votos se conserva el contrato vigente.
- El pedido permite adaptar nombres de tablas: se mantiene event_category por evento, sin catalogo paralelo participation_type.

## T08 - Decisiones tecnicas

- Se conserva orden unico por rubro para items y criterios, incluyendo inactivos y huecos. No se redefine unicidad por item ni se renumera historia.
- Reordenar criterios intercambia posiciones de vecinos del mismo item. Reasignar un criterio no cambia su orden global por rubro.
- Nueva migracion 067 conserva NULL historicos, pero rechaza altas nuevas y conversiones de asignado a NULL. No permite cambiar identidad/parentesco para fabricar huerfanos historicos.
- Reordenamiento recibe direccion UP/DOWN, vecino esperado y orden esperado de ambos; se rechaza informacion obsoleta con 409. No aplica cambios ni auditoria en caso de conflicto.
- T08 no cambia estados ni readiness de apertura; se conserva la guarda CONFIGURING actual.

## T09a/T09b - Decisiones confirmadas (2026-09-10)

- `brand_color` no requiere migracion nueva: la columna 069 ya existe y el CHECK `^#[0-9A-Fa-f]{6}$` sigue siendo la guarda de BD. La API valida el mismo formato y normaliza cadena vacia a NULL.
- `brandColor` no activa el filtro de secretos de auditoria (`password|token|secret|otp|authorization|cookie`): se audita como campo funcional en `TROUPE_CREATED/UPDATED` con before/after.
- El orden de pasada se edita solo sobre filas existentes de `night_troupe_schedule` (creadas por seeds/flujo de jornadas); T09b no crea ni elimina asignaciones a jornadas, solo intercambia `presentation_order` entre vecinos de la misma `night_id`.
- T09b no toca Spec 025: es lectura + reorden administrativo bajo `CONFIGURING`; con evento `OPEN` los controles se ocultan igual que el resto de la configuracion.
- Filtros/busqueda y preview son solo vista: no alteran Spec 004/007/010 ni generan planillas, votos o auditoria de votacion.
