# Índice de RF — colisiones de numeración

> Generado el 2026-09-07 como parte del saneamiento documental de la Fase 0 de `PLAN-maestro.md`. Cada incremento SDD numeró sus propios Requisitos Funcionales (RF) de forma independiente, sin coordinar con incrementos previos. El resultado: 22 números de RF están **definidos dos o más veces**, con contenido distinto, en specs distintas. Citar un RF por número sin indicar la spec es ambiguo desde este documento en adelante.

## Convención de desambiguación

Spec 008 ya adoptó, para sí misma, la convención `Spec-008/RF-xx` (ver su sección "Estado": *"los RF se refieren como Spec-008/RF-xx para evitar colisiones con la numeración local de otros incrementos"*). Este documento generaliza esa convención a **las cuatro colisiones detectadas**: al citar cualquiera de los números de la tabla siguiente, usar el prefijo `Spec-NNN/RF-xx`. Fuera de estos números, la cita simple `RF-xx` sigue siendo unívoca.

Este documento es descriptivo (evidencia de un problema existente) y no reabre ni modifica ninguna spec cerrada: cada RF listado conserva su texto y su validación original en su propio `spec.md`.

## Colisiones detectadas

### Cluster A — RF-63 a RF-67 (Spec 004 vs. Spec 008)

| RF | `Spec-004/RF-xx` (completitud de planillas) | `Spec-008/RF-xx` (gestión de accesos) |
|---|---|---|
| 63 | Auditar todo cambio de estado de score sin almacenar el puntaje. | El diccionario de roles debe incluir `JUDGE`, `VEEDOR`, `COMISARIO`, `SCRUTINEER`, `ADMIN`. |
| 64 | (contenido de Spec 004, ver su spec.md) | Solo `ADMIN` puede invitar usuarios operativos. |
| 65 | (contenido de Spec 004, ver su spec.md) | Invitaciones de un solo uso, token solo hasheado. |
| 66 | (contenido de Spec 004, ver su spec.md) | Invitaciones ilimitadas por defecto. |
| 67 | (contenido de Spec 004, ver su spec.md) | Alta unificada de Personas con selector de tipo. |

### Cluster B — RF-67 a RF-70 (Spec 005 vs. Spec 006, más RF-67 también en Spec 008)

| RF | `Spec-005/RF-xx` (Offline-First, diferida) | `Spec-006/RF-xx` (cierre sin reapertura) |
|---|---|---|
| 67 | Instalar la interfaz de jurado y abrir una planilla descargada sin conectividad; API y puntajes nunca cacheados por el service worker. | Una planilla `SUBMITTED` no debe poder transicionar a `REOPENED` por ningún medio. |
| 68 | Persistir una operación durable antes de enviar una mutación (usuario, planilla, revisión base, `operationId`). | No debe existir endpoint ni control ADMIN de reapertura. |
| 69 | Encolar solo una decisión semántica permitida; conservar el orden de creación. | Cierre con `PENDING` mantiene la ventana abierta y muestra el modal de faltantes. |
| 70 | El servidor debe deduplicar por actor + planilla + `operationId`. | El modal de cierre rechazado debe cumplir contratos de foco y accesibilidad. |

RF-67 colisiona además con `Spec-008/RF-67` de la tabla anterior — una colisión triple.

### Cluster C — RF-106 a RF-109 (Spec 012 vs. Spec 013, más RF-104 a RF-106 con Spec 011)

| RF | `Spec-012/RF-xx` (planilla online únicamente) | `Spec-013/RF-xx` (suplencias priorizadas) |
|---|---|---|
| 106 | Enviar cada decisión solo al endpoint online autoritativo. | Solo `ADMIN` con 2FA activa al suplente vinculado, con motivo, si el titular no está `SUBMITTED`. |
| 107 | Ante fallo de red, mantener el estado visible previo, sin persistencia local para reintento. | Si el titular ya está `SUBMITTED`, la activación se rechaza sin modificar nada. |
| 108 | No presentar mensajes ni controles de outbox o guardado local. | La activación revoca titular y reserva, y crea una nueva asignación `PRIMARY`. |
| 109 | El indicador de conectividad es solo informativo. | La planilla `OPEN` del titular pasa a `REPLACED`, sin bloquear cierre ni contar como voto válido. |

RF-104 a RF-106 de `Spec-013` colisionan además con `Spec-011/RF-104` (reversibilidad cero del sorteo), `Spec-011/RF-105` (UX accesible del modal de sorteo) y `Spec-011/RF-106` (consulta del resultado ya registrado) — contenido completamente distinto en ambos casos.

### Cluster D — RF-130 a RF-137 (Spec 015/017 y Spec 016/017)

| RF | `Spec-016/RF-xx` (supervisión VEEDOR) | `Spec-017/RF-xx` (configuración de competencia) |
|---|---|---|
| 130 | *(no definido en 016; ver Spec 015 abajo)* | Separar visualmente configuración de evento y de competencia. |
| 131 | Endpoint `GET /api/v1/monitor/events` con sesión + 2FA + `requireVotingObserver`. | Reutilizar `event_category` como tipo de participación; prohibido un catálogo paralelo. |
| 132 | Mínimo privilegio en la respuesta: sin puntajes, nombres de jurados/comparsas ni rankings. | Cada criterio nuevo debe identificar exactamente un ítem puntuable del mismo rubro y evento. |
| 133 | Rechazo a roles no autorizados (`JUDGE`, `COMISARIO`, `SCRUTINEER`, `ESCRIBANO`, sin 2FA, anónimos). | Criterios históricos sin reasignar se conservan, se exponen como pendientes y bloquean publicación. |
| 134 | Vista `#/veedor` con conteos, estado de ventana y % de confirmación, sin escritura. | Migración vincula automáticamente un criterio a su único ítem activo si corresponde. |
| 135 | Auto-refresco cada 15s, pausado en pestaña oculta. | Un criterio descriptivo no recibe puntuación independiente (reemplaza parcialmente Spec-001/RF-01y). |
| 136 | Guard de rol + navegación + redirect post-login. | Tipos de rubro `NOMINATIVE/RANDOM/GENERAL/CALCULATED/SPECIAL` sin hardcodear nombres reglamentarios. |
| 137 | Accesibilidad y responsive (390×844/768×1024/1440×900, `aria-live`, WCAG AA). | Solo `NOMINATIVE` integra Mejor Comparsa; `RANDOM` conserva ganador de rubro sin integrar; tipos nuevos no activan fórmulas. |

RF-130 colisiona también con `Spec-015/RF-130` (accesibilidad y responsive de la vista del acta oficial) — tres definiciones distintas para el mismo número.

## Cómo se generó esta lista

Script puntual (no versionado como herramienta permanente) que recorre `specs/*/spec.md`, extrae toda línea que define un RF en el patrón `- **RF-NNN[letra] (título opcional).**`, y agrupa por número de RF a través de specs. Filtra deliberadamente las meras referencias en prosa (p. ej. "Spec 017 reemplaza Spec 001/RF-01y") para no contar una cita como una definición. 22 colisiones sobre 191 RF definidos en total al 2026-09-07.

## Qué no cambia esto

- Ninguna spec cerrada se reabre ni se corrige en cuanto a su alcance o su validación.
- Los identificadores RF existentes en tests, `validation.md` y código (comentarios, nombres de test) no se renumeran retroactivamente.
- Specs futuras deben adoptar directamente el prefijo `Spec-NNN/RF-xx` cuando el número quede libre, o saltar al siguiente número disponible por encima de RF-165 para evitar sumar colisiones nuevas.
