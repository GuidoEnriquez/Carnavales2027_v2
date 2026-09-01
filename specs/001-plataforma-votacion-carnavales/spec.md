# Spec 001 — Plataforma de votación para Carnavales

## Estado

- **Fase SDD:** I1-C, I2-A, I2-B, I3, Specs 004, 005 y 006 implementadas. Spec 006 y Spec 007 cuentan con validación automatizada y manual reproducible. La validación manual de Spec 005 continúa pendiente.
- **Implementación:** los incrementos posteriores a I1 se rigen por sus propias specs, clarificaciones, planes y tareas; el alcance futuro continúa sujeto a clarificación incremental.
- **Fuentes:** `docs/source-map.md`, especialmente la copia de Confluence C2 en Obsidian.

## Contexto y objetivo

El sistema permite administrar y ejecutar una votación digital de Carnaval, con Goya 2027 como configuración inicial y sin constantes de código que limiten su reutilización para otros eventos o ciudades.

Debe permitir registrar, habilitar y asignar jurados; cargar y confirmar puntuaciones por comparsa; preservar secreto e inmutabilidad; tolerar cortes de conectividad; y realizar escrutinio, penalizaciones, desempates y actas mediante roles separados.

## Actores

| Actor | Responsabilidad principal |
|---|---|
| Administrador | Configura eventos, jornadas, comparsas, rubros; registra, invita, asigna y reemplaza jurados. |
| Jurado | Evalúa exclusivamente los ítems autorizados de su especialidad, evento y noche. |
| Veedor | Supervisa el estado operativo sin acceder a puntajes ni resultados durante competencia. |
| Comisario | Registra faltas reglamentarias y gestiona penalizaciones autorizadas. |
| Escrutinio | Consolida notas válidas, aplica reglas de resultados y genera actas. |
| Escribano | Certifica resultados y custodia planillas según el procedimiento autorizado. |

### Modelo conceptual de evaluación

- **Especialidad:** ámbito de responsabilidad de un jurado; por ejemplo, Baile, Vestuario o Batería en la configuración sugerida de Goya 2027.
- **Rubro:** categoría competitiva definida por un evento, por ejemplo Reina de Comparsa, Comisión de Frente o Mejor Batería de Comparsa.
- **Ítem evaluable:** unidad que recibe puntuación dentro de un rubro y cuya configuración identifica la especialidad responsable de puntuarla.
- **Nominación o sujeto evaluado:** figura, persona, pareja, grupo o elemento presentado por una comparsa sobre el cual se aplica un ítem; no es un ítem ni genera por sí mismo una nota.
- **Criterio descriptivo:** descripción reglamentaria separada del ítem puntuable. No genera una nota independiente salvo que la configuración de planilla lo establezca explícitamente.

## Incremento I1 — Configuración operativa

**Objetivo:** un administrador puede dejar un evento listo para la etapa posterior de asignación de jurados y votación, configurando eventos, jornadas, comparsas, rubros y especialidades sin cambios de código.

**Incluye:**

- Administración de eventos.
- Jornadas/noches, incluido si admiten votación.
- Catálogo y participación de comparsas por evento.
- Especialidades.
- Rubros e ítems de evaluación vinculados a especialidades.
- Modelo de datos para representar nominaciones o sujetos evaluados, sin gestión funcional de nominaciones en I1.
- Modelo de datos para la programación de comparsas por noche, sin interfaz ni lógica de sorteo, rotación o reprogramación en I1.
- Autenticación y autorización mínima para restringir el panel y la API administrativa a administradores.
- Panel administrativo en el cliente para realizar la configuración incluida en I1.
- Validaciones de consistencia, duplicados y configuraciones incompletas.

**Excluye por ahora:** invitaciones, asignaciones y reemplazos de jurados; carga de votos; sincronización offline; penalizaciones; escrutinio y actas. El modelo y contratos de I1 deben dejar preparada la evolución hacia esos módulos, sin implementarlos anticipadamente.

## Incremento I1-C — Cierre de configuración operativa

**Objetivo:** cerrar las brechas detectadas en la validación estática de I1 antes de ampliar el dominio competitivo.

**Incluye:**

- Listado, edición y soft-disable de categorías, participaciones, especialidades, rubros e ítems evaluables mientras el evento esté en `CONFIGURING`.
- Criterios descriptivos ordenados por rubro, administrables por API y panel, sin valor de puntuación ni participación en readiness.
- Bloqueo en base de datos de toda entidad de configuración, incluidas nominaciones preparatorias y programación por noche, cuando el evento esté `OPEN`.
- Contratos de error HTTP consistentes para validaciones, inexistencia, duplicados, referencias inválidas y recursos bloqueados.
- Listado de usuarios existentes y promoción/revocación auditada del rol `ADMIN`, sin registro público ni alta operativa de usuarios.
- Panel que permita revisar y corregir la configuración existente, muestre especialidades derivadas y confirme explícitamente la apertura irreversible.
- Revalidación completa de migraciones, seeds, API y cliente, incluida toda migración posterior a 017.

**Continúa excluido:** gestión operativa de nominaciones y programación; usuarios/jurados operativos; invitaciones, asignaciones y reemplazos; votación; offline/sync; penalizaciones; escrutinio; resultados; actas y reportes.

**Fuente de I1-C:** revisión de aceptación de I1 y decisión formal del responsable del producto del 2026-08-30, registrada en `docs/source-map.md`. I1-C corrige cobertura de requisitos existentes y no incorpora reglas reglamentarias nuevas.

## Requisitos funcionales confirmados

### Configuración y acceso

- **RF-01.** EL SISTEMA DEBE permitir configurar eventos, jornadas, comparsas, rubros, especialidades y cupos de jurados sin modificar código.
- **RF-01a.** MIENTRAS un evento esté en estado de configuración, EL SISTEMA DEBE permitir a un administrador editar su configuración operativa.
- **RF-01b.** CUANDO un administrador abra un evento para competencia, EL SISTEMA DEBE bloquear las modificaciones de su configuración operativa. Las correcciones posteriores auditadas quedan fuera de I1 y requieren una ampliación de esta spec.
- **RF-01c.** CUANDO un administrador intente abrir un evento para competencia, EL SISTEMA DEBE rechazar la operación e informar los elementos faltantes si no existe al menos una jornada de competencia, una comparsa participante, una especialidad activa y un rubro activo configurados.
- **RF-01c.1.** CUANDO un administrador intente abrir un evento, EL SISTEMA DEBE verificar que todo rubro activo incluido en competencia tenga al menos un ítem evaluable activo y que cada uno de esos ítems esté asociado a una especialidad activa. Los rubros inactivos NO DEBEN participar de esta validación. SI un rubro no cumple, EL SISTEMA DEBE rechazar la apertura e identificar los rubros con configuración incompleta.
- **RF-01d.** EL SISTEMA DEBE derivar las especialidades aplicables a un rubro a partir de sus ítems evaluables activos. Cada ítem evaluable DEBE pertenecer a un único rubro y DEBE identificar una única especialidad responsable. I1 NO DEBE crear una entidad ni tabla directa `rubro_especialidad`.
- **RF-01e.** CUANDO un rubro tenga ítems evaluables activos asignados a más de una especialidad, EL SISTEMA DEBE permitir que cada jurado habilitado de cada especialidad cargue y confirme una puntuación independiente para sus ítems. EL SISTEMA NO DEBE crear ni requerir una puntuación conjunta entre jurados.
- **RF-01f.** EL SISTEMA NO DEBE imponer especialidades obligatorias a nivel global. Baile, Vestuario y Batería DEBEN estar disponibles como configuración inicial sugerida para Goya 2027 y DEBEN poder editarse por evento.
- **RF-01g.** EL SISTEMA DEBE permitir administrar la participación de una comparsa en un evento mediante, como mínimo, nombre visible, categoría y estado de participación.
- **RF-01g.1.** EL SISTEMA DEBE administrar las categorías de comparsa mediante un catálogo configurable y acotado a cada evento. Una categoría DEBE tener identificador, nombre visible, código, orden y estado activo/inactivo. Primera categoría DEBE estar disponible como dato inicial sugerido para Goya 2027, pero NO DEBE ser la única categoría ni un valor obligatorio global.
- **RF-01g.2.** CADA participación de comparsa DEBE estar asociada a exactamente una categoría perteneciente al mismo evento; EL SISTEMA NO DEBE almacenar categorías como texto libre en la participación.
- **RF-01g.3.** CUANDO una categoría tenga participaciones históricas asociadas, EL SISTEMA NO DEBE permitir su eliminación física y DEBE permitir únicamente desactivarla para impedir nuevas asignaciones.
- **RF-01g.4.** CUANDO un administrador intente abrir un evento, EL SISTEMA DEBE rechazar la operación e identificar las comparsas participantes sin una categoría activa y válida del mismo evento.
- **RF-01h.** EL SISTEMA NO DEBE almacenar el orden de presentación como atributo fijo de la comparsa dentro de un evento. El orden DEBE modelarse, cuando se implemente, como una programación independiente por noche que soporte sorteo o rotación.
- **RF-01i.** I1 DEBE incorporar el modelo de datos de programación por noche mediante una entidad independiente que relacione noche y participación de comparsa, almacene orden de presentación y estado. I1 NO DEBE incluir la generación de sorteo, rotación, reprogramaciones ni interfaz de gestión de esa programación.
- **RF-01j.** EL SISTEMA DEBE permitir configurar rubros por evento y uno o más ítems evaluables dentro de cada rubro. Cada ítem DEBE identificar la especialidad responsable de puntuarlo.
- **RF-01k.** EL SISTEMA DEBE distinguir los ítems evaluables de las nominaciones o sujetos evaluados —figura, persona, pareja, grupo o elemento presentado por una comparsa— y DEBE permitir que una evaluación se refiera a dichos sujetos sin convertirlos en ítems.
- **RF-01l.** EL SISTEMA DEBE mantener los criterios descriptivos del reglamento separados de los ítems puntuables. Un criterio descriptivo NO DEBE generar una nota independiente salvo que la configuración de planilla lo establezca expresamente.
- **RF-01m.** EL SISTEMA DEBE permitir que cada rubro indique si su evaluación se realiza directamente sobre la comparsa o si requiere una nominación o sujeto evaluado.
- **RF-01n.** PARA un rubro que requiera nominación, EL SISTEMA DEBE permitir configurar el tipo de sujeto esperado: persona, pareja, grupo, figura, elemento u otro. I1 DEBE preparar el modelo para representar nominaciones, pero NO DEBE incluir su carga, modificación, validación, cierre ni presentación en planillas.
- **RF-01o.** LA ausencia de nominaciones NO DEBE bloquear la apertura general del evento. EL SISTEMA DEBE validar las nominaciones requeridas antes de habilitar la votación correspondiente, en el futuro módulo operativo de votación.
- **RF-01p.** EL SISTEMA NO DEBE permitir la autoasignación del rol ADMIN mediante registro público.
- **RF-01q.** EN desarrollo y testing, EL SISTEMA DEBE permitir crear administradores exclusivamente mediante seeds controlados habilitados fuera de producción. EN producción, el primer administrador DEBE crearse mediante un bootstrap explícito, seguro y ejecutable una única vez por un operador.
- **RF-01r.** UNA VEZ inicializado el sistema, la base de datos DEBE ser la única fuente de verdad para roles. EL SISTEMA DEBE permitir crear o promover administradores únicamente a usuarios autorizados y DEBE auditar toda creación o modificación de privilegios.
- **RF-01s.** EL SISTEMA DEBE impedir eliminar o degradar al último administrador activo. Para I1, un administrador activo es todo usuario existente que posea el rol `ADMIN`; I1 no incorpora estado habilitado/deshabilitado de cuenta.
- **RF-01t.** EL SISTEMA DEBE exigir verificación en dos pasos para todos los roles antes de conceder acceso a rutas protegidas, incluido el panel administrativo. Una autenticación de email y contraseña sin OTP verificado NO DEBE considerarse sesión plenamente autorizada.
- **RF-01u.** EL SISTEMA DEBE usar OTP numérico de seis dígitos, con expiración de cinco minutos y almacenamiento cifrado. En desarrollo el envío puede usar un adaptador de consola; en producción DEBE usar un proveedor de correo configurado y fallar de forma segura si no está disponible.
- **RF-01v.** CUANDO un usuario complete correctamente la verificación 2FA, EL SISTEMA DEBE rotar su sesión y revocar las sesiones previas conforme a la política de autenticación.
- **RF-01w.** MIENTRAS un evento esté en `CONFIGURING`, EL SISTEMA DEBE permitir listar y corregir sus categorías, participaciones, especialidades, rubros e ítems; la baja funcional de estos catálogos DEBE realizarse mediante `active=false`, sin eliminación física.
- **RF-01x.** CUANDO un evento esté `OPEN`, EL SISTEMA DEBE impedir en la base de datos toda inserción, actualización, eliminación o reasignación de sus entidades de configuración, incluidas las nominaciones y programaciones preparatorias de I1.
- **RF-01y.** EL SISTEMA DEBE administrar criterios descriptivos ordenados dentro de cada rubro como referencias sin puntuación independiente. Estos criterios NO DEBEN crear ítems ni bloquear la apertura del evento.
- **RF-01z.** CUANDO la API rechace una operación administrativa, EL SISTEMA DEBE devolver un código estable y un estado HTTP acorde para que el cliente pueda informar validaciones, conflictos, inexistencia y bloqueo sin ocultar el motivo.
- **RF-02.** EL SISTEMA DEBE distinguir jornadas de competencia de jornadas sin votación.
- **RF-03.** CUANDO un usuario se registra o inicia sesión, EL SISTEMA NO DEBE habilitarlo a votar solo por tener correo válido.
- **RF-04.** EL SISTEMA DEBE habilitar la votación únicamente si existe una asignación activa del jurado para el evento, la noche y la especialidad correspondiente.
- **RF-05.** EL SISTEMA DEBE determinar del lado del servidor la jornada activa del jurado.
- **RF-06.** CUANDO se asigna o reemplaza un jurado, EL SISTEMA DEBE conservar trazabilidad de la operación.

### Carga y confirmación de votos

- **RF-07.** CUANDO un jurado habilitado evalúa una comparsa, EL SISTEMA DEBE mostrar únicamente los ítems autorizados para su especialidad y planilla.
- **RF-08.** EL SISTEMA DEBE permitir puntuaciones ordinarias de 1 a 10. El valor 0 DEBE reservarse exclusivamente para un rubro o figura no presentada y DEBE registrarse mediante una acción independiente, nunca como pendiente ni parte de la escala ordinaria.
- **RF-09.** SI una figura o rubro se presentó y falta su puntuación, el procedimiento de subsanación reglamentaria DEBE conservar su circunstancia y trazabilidad. El flujo operativo de esa subsanación requiere su propio incremento de escrutinio; las nuevas planillas no pueden confirmarse con ítems pendientes.
- **RF-10.** CUANDO una planilla tenga ítems obligatorios en estado pendiente, EL SISTEMA DEBE impedir su confirmación o cierre e informar los ítems pendientes.
- **RF-11.** CUANDO un jurado confirma una planilla, EL SISTEMA DEBE volverla inmutable para ese jurado.
- **RF-12.** MIENTRAS se realiza la competencia, EL SISTEMA NO DEBE mostrar puntajes de otros jurados, totales, rankings, resultados preliminares ni información que permita inferirlos.

### Integridad, auditoría y conectividad

- **RF-13.** EL SISTEMA DEBE continuar permitiendo la carga de datos de votación durante interrupciones de red y sincronizar las operaciones cuando recupere conectividad.
- **RF-14.** EL SISTEMA DEBE procesar de forma idempotente las operaciones sincronizadas para impedir efectos duplicados.
- **RF-15.** EL SISTEMA DEBE registrar en auditoría las acciones críticas de configuración, habilitación, voto, confirmación, reemplazo, penalización, escrutinio y actas.
- **RF-16.** EL SISTEMA DEBE permitir al veedor visualizar estado operativo sin exponer puntajes durante competencia.

### Penalizaciones y resultados

- **RF-17.** EL SISTEMA DEBE registrar y aplicar penalizaciones por separado de la evaluación artística, sin modificar retroactivamente los votos originales.
- **RF-18.** EL SISTEMA DEBE conservar únicamente puntajes de rubros aleatorios, y no nominativos, cuando una comparsa incumpla el mínimo de integrantes en una noche, conforme a la regla configurada.
- **RF-19.** CUANDO se ejecute el escrutinio autorizado, EL SISTEMA DEBE consolidar únicamente notas válidas y aplicar penalizaciones configuradas.
- **RF-20.** PARA el premio Mejor Comparsa, SI hay empate, EL SISTEMA DEBE aplicar en orden: mayor cantidad de rubros nominativos ganados; Mejor Batería; y sorteo si persiste el empate.
- **RF-21.** EL SISTEMA DEBE generar trazabilidad y actas para el escrutinio y la certificación autorizada.

## Requisitos no funcionales iniciales

- **RNF-01 — Seguridad:** validación de autenticación y autorización debe hacerse del lado del servidor.
- **RNF-02 — Secreto:** los datos que puedan revelar resultados se restringen por rol, fase del evento y autorización.
- **RNF-03 — Datos:** los cambios de esquema deben ser incrementales, reproducibles y no destructivos.
- **RNF-04 — Calidad:** toda regla crítica debe vincularse a test o verificación concreta antes de declararse cumplida.
- **RNF-05 — Trazabilidad:** cada requisito debe mantener referencia a Jira, Confluence u Obsidian.
- **RNF-06 — Bootstrap seguro:** la creación inicial de ADMIN en producción debe usar configuración segura de operador, poder ejecutarse una única vez y no exponer secretos ni mecanismos de promoción pública.
- **RNF-07 — 2FA:** el proveedor y el almacenamiento de OTP deben usar mecanismos criptográficos de Better Auth; ninguna ruta protegida debe depender solo de una sesión primaria sin verificación 2FA.

## Fuera de alcance inicial

- Pasarela de pagos.
- Gestión pública de entradas.
- Aplicación de sanciones económicas fuera del registro y cálculo reglamentario.
- Publicación pública no autorizada de resultados antes del escrutinio.

## Criterios globales de finalización

1. Los requisitos aplicables cuentan con implementación, prueba o verificación documentada.
2. Un jurado no puede votar fuera de su asignación, noche o especialidad.
3. Una planilla confirmada no puede alterarse sin un proceso reglamentario y auditado definido por la spec.
4. La sincronización no duplica operaciones ni votos.
5. Los puntajes permanecen secretos durante la competencia para actores no autorizados.
6. El cálculo de resultados, penalizaciones y desempates es reproducible desde datos auditables.

## Pendientes de clarificación

- `[NECESITA ACLARACIÓN]` Datos definitivos de los ítems/rubros nominativos, aleatorios y derivados.
- `[NECESITA ACLARACIÓN]` Regla autorizada para corregir una planilla o un voto confirmado: quién puede hacerlo, en qué ventana, y qué evidencia exige.
- `[RESUELTO EN SPEC 004]` Semántica exacta de una puntuación 0: el jurado registra `NOT_PRESENTED` mediante una acción explícita sobre el ítem de su propia planilla.
- `[NECESITA ACLARACIÓN]` Medio, formato y procedimiento de contingencia de las actas oficiales.
