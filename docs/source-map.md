# Mapa de fuentes — Carnavales2027_v2

> Estado: Jira SVC2 y Confluence C2 fueron contrastados el 2026-08-31. Sus páginas y tickets siguen siendo las fuentes canónicas; este archivo registra cómo se usan dentro del SDD del repositorio. El reglamento formal completo aún no está distribuido en este árbol.

## Estado SDD actual

- I1/I1-C: configuración operativa, validado.
- I2-A/I2-B: padrón, invitaciones, cupos, asignaciones y reemplazos, validados.
- I3 + Spec 004 + Spec 006: planillas, puntuaciones, secreto, inmutabilidad, completitud y cierre sin reapertura, implementados y validados automáticamente; resta verificación manual de teclado, lista extensa y viewports para Spec 006.
- Diferido: penalizaciones, resultados, escrutinio y actas. Offline/sync está implementado exclusivamente conforme a Spec 005.
- Spec 004 implementa prevención de omisiones: las nuevas planillas exigen `SCORED` (1 a 10) o `NOT_PRESENTED` (0 por acción explícita) antes de confirmar o cerrar. `PENDING` bloquea ambas operaciones.
- El `5 por equidad` no está implementado para nuevas planillas digitales. El reglamento vigente todavía lo contempla y su eventual eliminación reglamentaria está pendiente de resolución formal de la COC.
- I4-A Offline-First está implementado para sincronizar únicamente decisiones ya válidas de planillas; no implementa ni interpreta el `5 por equidad`, subsanaciones, penalizaciones, escrutinio, resultados ni actas. La validación manual de PWA, sesión/2FA, teclado/tacto y viewports sigue pendiente en `specs/005-offline-first/validation.md`.
- Decisión de producto del 2026-08-31: no se permiten nuevas reaperturas de planillas. Un cierre con `PENDING` se rechaza y ADMIN recibe un modal con jurado, comparsa, rubro e ítem faltante. Fuente de RF-67 a RF-70 de Spec 006.

## Visión funcional objetivo

- `README.md` objetivo funcional proporcionado por el responsable del producto el 2026-08-30 como objetivo de evolución del sistema.
- Decisión de producto del 2026-08-30 — cerrar I1 antes de ampliar alcance y corregir administración incompleta, criterios descriptivos, bloqueo tras `OPEN` y contratos de error. Fuente de RF-01w–RF-01z.
- Este README orienta el backlog, pero sus reglas se incorporan a la implementación únicamente después de contrastarlas con Jira, Confluence o el reglamento y de completar el ciclo SDD.
- Ante contradicciones de roles, estados, catálogo reglamentario, cálculos, seguridad u operación offline, la regla se registra como pendiente de clarificación y no autoriza código por sí sola.

## Jira — proyecto SVC2

### Base y alcance

- `SVC2-1` — Epic PMV: Sistema de Votaciones Carnavales Goya 2027
- `SVC2-5` — Definir alcance y reglas funcionales
- `SVC2-30` — Modelo de datos: eventos, jurados, asignaciones y votación — finalizada
- `SVC2-49` — Definir tablas principales
- `SVC2-50` — Definir relaciones entre los datos
- `SVC2-51` — Controlar datos repetidos o incorrectos

### Jurados y acceso

- `SVC2-9` — Registrar e invitar jurados
- `SVC2-10` — Identificación y validación del jurado
- `SVC2-25` — Sesión de jurado por evento/noche
- `SVC2-59` — Jurados habilitados por noche
- `SVC2-60` — Cupo configurable de jurados
- `SVC2-61` — Reemplazo de jurado
- `SVC2-67` — Padrón e invitaciones configurables

### Votación, integridad y offline

- `SVC2-13` — Cargar puntuaciones por comparsa
- `SVC2-14` — Validar carga de puntuaciones
- `SVC2-26` — Máquina de estados e inmutabilidad de votos
- `SVC2-27` — Reglas de cierre y modificación
- `SVC2-28` — Auditoría, trazabilidad y cadena de integridad
- `SVC2-38` — Sincronización offline idempotente
- `SVC2-80` — Confirmar planilla de evaluación

### Resultados

- `SVC2-17` — Consolidar notas válidas
- `SVC2-19` — Regla oficial de desempate
- `SVC2-41` — Supervisar votaciones sin exponer puntajes

## Confluence — espacio C2

### Páginas

- Inicio del espacio Carnavales 2027
- Guía oficial del equipo y planificación
- Guía de incorporación y trabajo del equipo
- Sprint 1 — Guía operativa para tomar y gestionar Issues
- Ítems a votar por jurados

### Fuente principal

`Guía del equipo y planificación` concentra el baseline funcional: alcance, reglas de votación, escala, omisiones, cierre de planilla, flujos de jurados, asignación, acceso, offline-first, inmutabilidad, secreto, auditoría, penalizaciones, desempate, escrutinio, actas, roles y sprints.

### Fuente de rubros

`Ítems a votar por jurados` define rubros nominativos, aleatorios y resultados derivados.

### Procedimiento operativo

`Sprint 1 — Guía operativa para tomar y gestionar Issues` define acuerdos de trabajo y cierre de issues.

## Obsidian — referencias disponibles

El vault contiene copias/síntesis utilizables para redactar la spec. Jira y Confluence siguen siendo la fuente canónica cuando exista un conflicto o haya información más reciente.

- `Guia del equipo - Confluence.md` (copia local de referencia, no distribuida en este repositorio)
  - Copia de la página de Confluence C2 `5013505`.
  - Define objetivo configurable y reutilizable, offline-first, secreto de voto, roles, jornadas, escala, omisiones, penalizaciones, desempate y escrutinio.
- `Backlog SVC2 - Resumen.md` (copia local de referencia, no distribuida en este repositorio)
  - Resumen de Jira SVC2 al `2026-08-27`; útil para épicas, prioridades y trazabilidad, pero no para inferir estados actuales.
- `Base de Datos - Modelo Completo.md` (copia local de referencia, no distribuida en este repositorio)
  - Diseño de referencia para datos, concurrencia, idempotencia y cierres transaccionales.
- `Registro e Invitacion de Jurados (SVC2-9).md` (copia local de referencia, no distribuida en este repositorio)
  - Reglas y criterios de aceptación de padrón, invitaciones y habilitación de jurados.
  - Contrastada el 2026-08-30 para I2-A. Se adoptan alta exclusiva por ADMIN, padrón sin cupo, invitación de uso único y separación entre registro y habilitación; la especialidad fija del diseño histórico se reemplaza por especialidad en cada asignación para respetar el catálogo scoped por evento de I1.

## Decisiones de producto I2-A — 2026-08-30

- Dividir Spec 002 en I2-A, padrón e invitaciones, e I2-B, cupos, asignaciones y reemplazos.
- I2-A incorpora únicamente los roles `ADMIN` y `JUDGE`.
- El alta de jurados es exclusiva por invitación de un ADMIN; no existe registro público autónomo.
- El perfil exige nombre, correo y DNI, no guarda especialidad y conserva su historia sin borrado físico.
- Las invitaciones vencen a las 72 horas por defecto, con duración configurable; una reemisión revoca la pendiente anterior.
- Suspender un jurado conserva perfil y rol, bloquea sus capacidades y revoca sus sesiones activas.

## Decisiones de producto I2-B — 2026-08-30

- El cupo se configura por noche + especialidad y una reducción por debajo de las asignaciones activas se rechaza.
- Un jurado solo puede tener una asignación activa por noche.
- `PRIMARY` y `SUBSTITUTE` son tipos de asignación y ambos consumen cupo.
- Las altas ocurren antes de `OPEN`; durante `OPEN` solo se permiten revocaciones y reemplazos; una noche `CLOSED` queda bloqueada.
- Los reemplazos revocan la asignación original, crean una nueva relacionada y exigen motivo; su efecto es futuro.
- Impugnaciones, ventanas temporales, planillas, votación y offline/sync quedan fuera de I2-B.

## Decisiones de producto I3 — 2026-08-30

> Histórico: estas decisiones de omisión/subsanación fueron reemplazadas para nuevas planillas por Spec 004.

- Score `0` representa exclusivamente "no presentado / no evaluado" y nunca una omisión subsanable.
- Una omisión conserva score `NULL`; solo el rol de aplicación `SCRUTINEER`, con 2FA, puede marcarla antes de confirmar la planilla.
- Tras la confirmación, `SCRUTINEER` registra la subsanación reglamentaria de 5 puntos como entidad separada, auditable e inmutable, sin modificar ni reabrir el voto original.
- `SCRUTINEER` no se autoasigna públicamente y no hereda permisos de ADMIN, JUDGE ni VEEDOR.

## Decisiones de producto Spec 004 — 2026-08-30

- El reglamento citado para esta decisión no está distribuido en el repositorio; la regla debe contrastarse cuando se incorpore su fuente local o verificable.
- Las nuevas planillas distinguen `PENDING`, `SCORED` y `NOT_PRESENTED`; `PENDING` no puede confirmarse ni cerrarse.
- La escala ordinaria es 1-10. El 0 se registra solo mediante una acción independiente de rubro o figura no presentada.
- El rechazo de cierre identifica el ítem pendiente y su contexto de jurado y comparsa.
- Las subsanaciones previas se preservan como historia; su operación futura pertenece al incremento de escrutinio y no autoriza omisiones nuevas antes de confirmar.

## Prevención de omisiones y contingencia reglamentaria

- La planilla no permite confirmar ni cerrar si conserva secciones, rubros o ítems en `PENDING`; el rechazo identifica los pendientes para que el jurado los resuelva.
- Cada ítem se resuelve únicamente con una puntuación ordinaria de 1 a 10 o con la acción `No se presentó`, que registra `NOT_PRESENTED` y score efectivo 0.
- El jurado no puede seleccionar manualmente la nota 0.
- El `5 por equidad` no participa del flujo normal de votación ni está disponible para el jurado. No se implementan flujo, endpoint, migración, cálculo ni ajuste para esa contingencia.
- El reglamento vigente todavía contempla el `5 por equidad` como subsanación de una omisión. La COC no aprobó todavía una resolución que lo elimine o lo declare no aplicable a nuevas planillas digitales. Esta ausencia no autoriza inferir su eliminación.
- Al intentar confirmar una planilla con pendientes, el jurado recibe un diálogo modal bloqueante que enumera los votos faltantes. La confirmación no se envía hasta resolverlos; el diálogo debe ser accesible y operativo en móvil, tablet y desktop.

### Fuente canónica pendiente: resolución COC

Antes de iniciar una Spec de subsanación o escrutinio que aplique, adapte o descarte el `5 por equidad`, se debe incorporar una resolución formal de la COC con:

- Identificador o número de resolución.
- Fecha.
- Autoridad aprobatoria.
- Texto o regla aprobada.
- Referencia al acta o documento de respaldo.

Hasta contar con esa fuente, no se crea una Spec de implementación del `5 por equidad` ni se modifica Spec 004. I4-A puede especificar e implementar su core técnico solo conforme a su alcance explícito: decisiones existentes, sincronización idempotente, conflicto explícito y secreto local de planillas.

### Decisión de arquitectura I4-A - 2026-08-31

- La contingencia reglamentaria del `5 por equidad` pertenece a un futuro incremento de subsanación o escrutinio. No es una transición disponible para las nuevas planillas y no forma parte de la sincronización offline.
- I4-A se limita a persistir y sincronizar `PENDING`, `SCORED` y `NOT_PRESENTED`, más la confirmación de una planilla, bajo las invariantes ya aplicadas por el servidor.
- La API continúa siendo autoritativa para identidad, 2FA, asignación activa, ventana de votación, completitud, inmutabilidad y secreto. Una operación offline que deje de ser válida se rechaza de forma explícita y no se reconcilia aplicando reglas de escrutinio.

## Uso en SDD

- La spec debe enlazar cada requisito a una fuente Jira/Confluence o a su copia identificada de Obsidian.
- Toda spec que incorpore o cambie una interfaz operativa debe declarar sus requisitos de uso móvil/tablet/desktop, interacción táctil y accesibilidad, con criterio de validación proporcionado.
- Los títulos de tickets no se interpretan como reglas completas.
- Ante conflicto entre una copia de Obsidian y Jira/Confluence actual, se documenta como `[NECESITA ACLARACIÓN]` antes del plan o código.
- La visión funcional objetivo se divide en incrementos verticales: cierre I1; usuarios y jurados; programación y nominaciones; votación; Offline-First implementado en Spec 005; supervisión y penalizaciones; escrutinio/resultados; actas/reportes.
