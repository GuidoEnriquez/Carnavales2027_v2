# Clarificación — Spec 001: Plataforma de votación para Carnavales

## Estado

- **Fase SDD:** I1-C, I2-A, I2-B, I3, Specs 004, 005 y 006 implementados. Los estados de aprobación de Specs 007 y 008 se consultan en `docs/sdd-status.md`.
- **Código:** la evolución de planillas vigente se documenta en Specs 004 y 006; Spec 005 conserva código exploratorio de Offline-First, funcionalidad futura no aceptada para operación. Penalizaciones, escrutinio, resultados y actas continúan diferidos.
- **Base revisada:** `spec.md`, `docs/source-map.md` y las notas de Obsidian referenciadas.

## Decisiones ya resueltas

| Tema | Decisión | Impacto en spec |
|---|---|---|
| Alcance I1 | Configuración operativa de eventos, noches, comparsas, especialidades, rubros e ítems; incluye panel administrativo. | I1 vertical, sin votación ni jurados todavía. |
| Acceso I1 | El panel y la API administrativa requieren autenticación/autorización mínima de administrador. | No se expone administración anónima. |
| Ciclo de evento | Editable en configuración; bloqueado al abrirse para competencia. | No hay correcciones posteriores en I1. |
| Apertura | Exige al menos una noche de competencia, comparsa, especialidad y rubro. | Apertura falla informando faltantes. |
| Rubros y especialidades | Relación N:M. | Un rubro puede involucrar varias especialidades. |
| Votos en rubro compartido | Cada jurado registra voto independiente; no hay voto conjunto. | Preparar modelo para múltiples votos por rubro. |

## Ambigüedades que bloquean el plan de I1

1. **Especialidades mínimas.** ✅ Resuelto: Baile, Vestuario y Batería son datos iniciales sugeridos para Goya 2027, editables por evento; no son valores obligatorios globales.
2. **Catálogo de comparsas.** ✅ Resuelto: la participación de una comparsa en un evento administra nombre visible, categoría y estado de participación. La categoría se selecciona desde un catálogo configurable y scoped por evento; posee identificador, nombre visible, código, orden y estado activo/inactivo. Cada participación exige exactamente una categoría activa del mismo evento, sin texto libre. Categorías con uso histórico no se eliminan físicamente: se desactivan. Primera categoría es dato inicial sugerido para Goya 2027, no una constante global. El orden de presentación no pertenece a esa entidad: varía por noche y será una programación independiente que soporte sorteo o rotación.
3. **Rubros/ítems.** ✅ Resuelto: especialidad = responsabilidad del jurado; rubro = categoría competitiva; ítem evaluable = unidad puntuable dentro de rubro, con una única especialidad responsable; nominación/sujeto = figura, persona, pareja, grupo o elemento evaluado; criterio descriptivo = referencia reglamentaria sin nota propia salvo configuración explícita. Las especialidades aplicables a un rubro se derivan exclusivamente de sus ítems activos; I1 no incluye `rubro_especialidad`.
4. **Apertura de evento.** ✅ Resuelto: cada rubro activo incluido en competencia debe tener al menos un ítem evaluable activo, y cada ítem activo debe pertenecer a una especialidad activa. Los rubros inactivos no bloquean la apertura. Ante incumplimiento se deben identificar los rubros incompletos.
5. **Programación por noche.** ✅ Resuelto: I1 incorpora la entidad de relación entre noche y participación de comparsa, con orden de presentación y estado; no incluye sorteo, rotación, reprogramación ni UI. Ese módulo llegará junto con votación.
6. **Nominaciones/sujetos evaluados.** ✅ Resuelto: I1 prepara el modelo pero no administra nominaciones. Cada rubro define si evalúa directamente la comparsa o requiere nominación; para los segundos se configura tipo de sujeto esperado. La ausencia de nominaciones no bloquea abrir el evento y se valida antes de habilitar la votación correspondiente.
7. **Bootstrap y administración de privilegios.** ✅ Resuelto: no hay autoasignación ADMIN pública; desarrollo/testing usa seeds controlados fuera de producción; producción crea el primer ADMIN con bootstrap seguro de una sola ejecución; la base es fuente de verdad de roles; altas/promociones se autorizan y auditan; no se puede eliminar ni degradar al último ADMIN activo. Para I1, ADMIN activo significa usuario existente con rol `ADMIN`; la habilitación/deshabilitación de cuentas y su impacto sobre sesiones quedan fuera de alcance.
8. **2FA obligatorio.** ✅ Fuente recuperada: todos los roles requieren 2FA/OTP antes de rutas protegidas. OTP es numérico de 6 dígitos, expira en 5 minutos y se almacena cifrado; desarrollo puede usar consola y producción requiere proveedor de correo seguro. Tras verificar, se rota la sesión y se revocan sesiones previas. **Impacto:** T06 se reabre para activar y probar 2FA antes de T07.
9. **Administración completa en I1-C.** ✅ Resuelto: administrar un catálogo implica listar, crear, editar y activar/desactivar antes de `OPEN`. No se agrega borrado físico.
10. **Criterios descriptivos.** ✅ Resuelto para I1-C: pertenecen a un rubro, tienen descripción, orden y estado activo; son referencias independientes de los ítems y nunca reciben puntuación ni intervienen en readiness.
11. **Bloqueo total tras apertura.** ✅ Resuelto: nominaciones y programación preparatorias también son configuración del evento y quedan bloqueadas en base de datos al pasar a `OPEN`.
12. **README objetivo.** ✅ Resuelto: el README objetivo del producto es la fuente funcional completa de referencia, pero cada módulo posterior se especifica y clarifica antes de implementarse.

## Posibles contradicciones o riesgos

- La guía dice que el jurado evalúa solo personas/figuras identificadas en planilla; I1 todavía no define dónde se administran esas figuras. No se debe asumir que son equivalentes a rubros.
- La guía de Goya describe 3 noches competitivas y 3 jurados por noche. Eso debe quedar como datos de seed o configuración de evento, nunca como constantes del sistema.
- El cálculo de rubros compartidos no está definido: que existan votos independientes no responde aún cómo se agregan durante escrutinio. No bloquea I1, pero sí bloquea el módulo de resultados.

### Decisiones extraídas de fuentes existentes

- **Categorías de comparsa:** catálogo configurable por evento, sustentado en `SVC2-32 — catálogo categorías` y en el README histórico que menciona primera categoría sin convertirla en regla global.
- **Rubros nominativos y aleatorios:** el README histórico aporta un catálogo inicial de Goya 2027; debe cargarse como seed/configuración de ejemplo, no como constantes de sistema.

## Siguiente resolución prioritaria

I2-A, I2-B, I3 y Spec 004 están cerrados y validados. Conexión/sincronización Offline-First es una funcionalidad futura; el código exploratorio de Spec 005 no la habilita operativamente. Impugnaciones, penalizaciones, escrutinio, resultados y actas requieren sus propios incrementos antes de implementarse.
