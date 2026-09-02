# Spec 005 - I4-A: Offline-First de planillas

## Estado

- **Fase SDD:** funcionalidad futura. Spec 012 retiró su uso del cliente actual; la outbox y `/sync` permanecen solo como compatibilidad transitoria para clientes antiguos, no como capacidad operativa aceptada.
- **Fuentes:** RF-13, RF-14 y RNF-01 a RNF-05 de Spec 001; Jira SVC2-38; `docs/source-map.md`.
- **Dependencias:** I3 y Spec 004 implementadas y validadas.
- **Decisión de alcance:** el core Offline-First es independiente del `5 por equidad`, nulo para planillas digitales por decisión de producto del 2026-09-01; no crea, interpreta ni resuelve subsanaciones.
- **Dependencia posterior:** Spec 007 deroga RF-62 de Spec 004. Si un incremento futuro reactiva Offline-First, debe preservar la inmutabilidad de una decisión confirmada por ítem y no incluir `Quitar decisión`.

## Objetivo

Permitir que un jurado con una planilla previamente cargada guarde decisiones y solicite su confirmación durante una interrupción de red, conservándolas localmente y sincronizándolas de forma idempotente cuando vuelva la conectividad, sin relajar ninguna regla autoritativa del servidor.

## Alcance

Incluye:

- PWA instalable con cache de recursos estáticos; las respuestas de la API no se cachean mediante el service worker.
- Persistencia local cifrada y acotada al usuario autenticado para planillas previamente descargadas y una outbox durable.
- Operaciones de jurado `SAVE_SCORE` y `SUBMIT_BALLOT` para los estados existentes `PENDING`, `SCORED` y `NOT_PRESENTED`.
- Identificadores de operación generados por cliente, deduplicación idempotente del lado del servidor y auditoría de un único efecto de dominio.
- Sincronización FIFO por planilla, detección de revisión obsoleta y conflicto explícito sin sobrescritura automática.
- Estado visible de conectividad, pendientes, sincronización, error recuperable y conflicto, usable en móvil, tablet y desktop.

Excluye:

- El `5 por equidad`, la creación de subsanaciones y cualquier procedimiento de escrutinio.
- Penalizaciones, resultados, rankings, desempates, actas y publicación de resultados.
- Sincronización offline de administración, asignaciones, reaperturas, aperturas o cierres de votación.
- Resolución automática de conflictos, modificación de una planilla `SUBMITTED` y escritura directa a PostgreSQL desde el cliente.
- Dependencia de Background Sync: la sincronización debe funcionar en primer plano al recuperar red, foco o mediante acción explícita.

## Invariantes

- Solo se sincronizan decisiones de la planilla propia de un `JUDGE` con sesión y 2FA vigentes.
- El servidor conserva la autoridad sobre asignación activa, ventana de votación, propiedad, completitud, inmutabilidad y estados semánticos de score.
- `PENDING` persiste `NULL`; `SCORED` persiste 1 a 10; `NOT_PRESENTED` persiste 0. Offline no cambia esta semántica.
- La outbox no contiene ni genera operaciones de subsanación, penalización o escrutinio.
- Cada operación aceptada produce como máximo un efecto de dominio y una única auditoría de planilla; un reintento devuelve el resultado idempotente sin una auditoría adicional.
- Un conflicto, revocación, cierre, sesión expirada o fallo de autorización nunca se resuelve sobrescribiendo el estado remoto ni aplicando una regla reglamentaria inferida.

## Requisitos funcionales

- **RF-67.** EL CLIENTE DEBE permitir instalar la interfaz de jurado y abrir una planilla previamente descargada sin conectividad; la API y los puntajes no DEBEN quedar cacheados por el service worker.
- **RF-68.** ANTES de enviar una mutación de planilla, EL CLIENTE DEBE persistir una operación durable asociada al usuario, planilla, revisión base, tipo y `operationId` UUID.
- **RF-69.** EL CLIENTE DEBE poder encolar únicamente una decisión semántica permitida para un score o la confirmación de la planilla; DEBE conservar el orden de creación por planilla.
- **RF-70.** EL SERVIDOR DEBE deduplicar una operación por actor, planilla y `operationId`; reutilizar un identificador con contenido distinto DEBE rechazarse.
- **RF-71.** CUANDO una operación sincronizada se aplique, EL SERVIDOR DEBE validar las mismas reglas que la operación online y registrar exactamente una auditoría de dominio sin almacenar el puntaje en la auditoría.
- **RF-72.** CADA planilla DEBE exponer una revisión monotónica. SI la revisión base no coincide, EL SERVIDOR DEBE rechazar la operación con un conflicto estable y el estado canónico necesario para que el jurado decida cómo continuar.
- **RF-73.** EL CLIENTE NO DEBE sobrescribir automáticamente un conflicto. DEBE detener la outbox de esa planilla, conservar la evidencia local y ofrecer recargar el estado canónico o descartar explícitamente las operaciones locales afectadas.
- **RF-74.** SI una operación es rechazada por planilla confirmada, ventana cerrada, asignación revocada, sesión/2FA expirada o autorización, EL CLIENTE DEBE detenerla y mostrar un estado recuperable; no DEBE reintentarse indefinidamente.
- **RF-75.** EL CLIENTE DEBE borrar cache, outbox y claves locales al cerrar sesión o cambiar de usuario. La cache de planillas expira a las 12 horas; una operación pendiente se conserva solo hasta sincronizarse correctamente y la UI DEBE advertir si supera ese plazo.
- **RF-76.** LA interfaz DEBE mostrar estado de conectividad y sincronización sin depender de `hover` ni precisión de puntero, y permitir reintento y descarte explícitos en móvil, tablet y desktop.

## Contrato de sincronización

- Se agregará un contrato autenticado de sincronización de planilla que recibe una revisión base y una lista FIFO de operaciones de una única planilla.
- Cada operación incluye `operationId`, tipo (`SAVE_SCORE` o `SUBMIT_BALLOT`) y un hash de contenido calculado por el servidor para detectar reutilización incompatible del identificador.
- El procesamiento de un lote será transaccional: el servidor bloquea la planilla, valida la revisión base, aplica las operaciones en orden y devuelve la revisión resultante y el estado canónico sin exponer puntajes a terceros.
- El cliente solo puede enviar lotes de su propia planilla. Las operaciones ya registradas se reconocen idempotentemente; una operación no aceptada no genera efecto de dominio ni auditoría de decisión.

## Criterios de aceptación

- Una planilla descargada se abre sin red y permite guardar localmente la decisión inicial 1 a 10 o `No se presentó`; una decisión confirmada no puede volver a `PENDING` ni incluir `Quitar decisión`.
- Recobrar conectividad sincroniza una secuencia de operaciones una sola vez, incluso si se repite el envío o se pierde la respuesta.
- Un lote que intenta confirmar con `PENDING` recibe el mismo rechazo autoritativo de completitud y permanece visible para corrección.
- Una edición concurrente de otro dispositivo produce conflicto explícito y nunca una sobrescritura silenciosa.
- Una operación recibida tras cierre, revocación o expiración se rechaza de forma estable y deja de reintentarse automáticamente.
- Cerrar sesión elimina los datos locales de ese usuario; otro usuario no puede ver ni sincronizar su outbox. La cache de lectura expira a las 12 horas y las operaciones pendientes que excedan ese plazo muestran una advertencia hasta sincronizarse.
- Las pruebas cubren PWA, almacenamiento local, idempotencia, reintentos, conflicto, secreto, cierre, revocación, sesión/2FA y viewports operativos.
