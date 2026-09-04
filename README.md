# Carnavales2027_v2

Plataforma configurable de administración y votación para Carnavales. Goya 2027 es una configuración inicial de referencia, no una restricción del producto.

## Estado del proyecto

Implementado y validado:

- **I1/I1-C:** eventos, noches, categorías, comparsas, especialidades, rubros, ítems, criterios descriptivos, readiness, apertura transaccional y administración de privilegios.
- **I2-A:** padrón de jurados, invitaciones seguras, aceptación, 2FA, suspensión/reactivación y rol `JUDGE`.
- **I2-B:** cupos por noche/especialidad, asignaciones `PRIMARY`/`SUBSTITUTE`, revocaciones, reemplazos auditados y cierre operativo de noches.
- **I3/Spec 004/Spec 006:** apertura y cierre de votación, planillas por jurado, puntuaciones por comparsa, confirmación inmutable sin nuevas reaperturas, secreto de puntajes, supervisión por `VEEDOR` y completitud obligatoria por ítem. El cierre con pendientes abre un modal administrativo con jurado, comparsa, rubro e ítem.
- **Spec 007:** confirmación e inmutabilidad inmediata por ítem, con modal de decisión y controles bloqueados tras confirmar. Validada automáticamente y con comprobación manual responsive.
- **Spec 008:** invitaciones de un solo uso para `VEEDOR`, `COMISARIO` y `SCRUTINEER`, persistidas solo como hash. La emisión, inspección, aceptación, login real, 2FA y la UI responsive están validados. Las altas se gestionan desde Personas.
- **Spec 009:** rediseño operativo oscuro del jurado, validado automáticamente y con comprobación manual. Cerrada.
- **Spec 010:** consolidación de resultados, rankings, desempate por criterios 1 y 2, y guardias de integridad de liberación (RF-94a). Cerrada.
- **Spec 011:** sorteo ceremonial con `crypto.randomInt()`, auditoría encadenada e interfaz de escrutinio, con comprobación manual en 3 viewports. Cerrada.
- **Spec 012:** planilla online únicamente; retira el uso operativo de outbox y cache local en el cliente actual, con comprobación manual. Cerrada.
- **Spec 013:** suplencias priorizadas: pares fijos titular/suplente, activación ADMIN+2FA con motivo ante titular incompleto o ausente, transición `REPLACED` y preservación histórica sin bloqueo de cierre ni liberación. Cerrada.
- **Spec 014:** gestión de penalizaciones (`troupe_penalty`): deducción reglamentaria en Mejor Comparsa con piso en cero, preservación de rubros artísticos (RF-118), panel accesible de Comisariato, revocación auditada y bloqueo tras liberación de resultados. Cerrada el 2026-09-03.
- **Spec 015:** actas oficiales y certificación de escrutinio (`official_scrutiny_record`): sello criptográfico JCS/SHA-256 (RFC 8785), inmutabilidad estricta por triggers en BD, segregación estricta de funciones (ADMIN solo lectura; emisión exclusiva `SCRUTINEER`/`ESCRIBANO` con 2FA) y vista notarial imprimible (`@media print`). Cerrada el 2026-09-03.
- **Perfiles Operativos:** alta unificada de roles auxiliares (VEEDOR, COMISARIO, SCRUTINEER, ESCRIBANO), invitación por consola/SMTP, aceptación solo password, ciclo de vida `INVITED→REGISTERED→SUSPENDED`. Migraciones 064-065. Implementado y validado (99 tests) el 2026-09-03.

Todavía fuera de alcance: publicación externa de resultados (portal público) y conexión/sincronización Offline-First. Spec 005 conserva compatibilidad exploratoria para clientes antiguos, pero no es una capacidad operativa aceptada.

## Incremento vigente

Spec 016 — Supervisión de votación por VEEDOR está implementada y validada automáticamente. Permanece abierta únicamente la comprobación manual en 390×844, 768×1024 y 1440×900, con teclado y emulación táctil. La evidencia detallada se registra en `specs/016-supervision-veedor/validation.md`.

## Próxima puerta SDD

Spec 004 mantiene activa la prevención de omisiones: cada ítem debe resolverse con 1 a 10 o `No se presentó` (0) antes de confirmar o cerrar una planilla; `PENDING` bloquea ambas operaciones. Por decisión de producto del 2026-09-01, el `5 por equidad` es nulo para planillas digitales: la plataforma impide la omisión humana que esa regla buscaba subsanar. No existe flujo, cálculo ni ajuste operativo asociado.

Conexión y sincronización Offline-First son una funcionalidad futura. Existe código exploratorio de I4-A para una outbox idempotente, conflictos de revisión y PWA de recursos estáticos, pero no está aceptado para operación ni validado manualmente. Sus artefactos históricos están en [`specs/005-offline-first/`](specs/005-offline-first/); cualquier activación, modificación o retiro requiere un nuevo ciclo SDD. Ver [`docs/sdd-status.md`](docs/sdd-status.md).

## Arquitectura

```text
api/       # Express, Better Auth, PostgreSQL y migraciones
client/    # React/Vite, panel ADMIN y vistas JUDGE
docs/      # Constitución y mapa de fuentes
specs/     # Requisitos, clarificaciones, tareas y validaciones
```

La autorización real se verifica en la API: sesión, 2FA, rol y estado del perfil. Las guardas del cliente solo orientan la experiencia de usuario.

## Estructura de base de datos

La persistencia usa PostgreSQL y está definida por las migraciones incrementales `001` a `065` en `api/src/db/migrations/`. Los estados se implementan con columnas `TEXT` y restricciones `CHECK`; no se usan tipos `ENUM` nativos. La tabla `"user"` pertenece a Better Auth y el modelo de dominio solo la referencia.

### Relaciones principales

```mermaid
erDiagram
  carnival_event ||--o{ night : contiene
  carnival_event ||--o{ event_category : define
  event_category ||--o{ event_troupe : agrupa
  carnival_event ||--o{ event_specialty : define
  carnival_event ||--o{ rubric : define
  rubric ||--o{ evaluation_item : contiene
  rubric ||--o{ rubric_criterion : describe
  event_troupe ||--o{ troupe_nomination : recibe
  rubric ||--o{ troupe_nomination : aplica_a
  night ||--o{ night_troupe_schedule : programa
  event_troupe ||--o{ night_troupe_schedule : participa

  judge_profile ||--o{ judge_invitation : recibe
  night ||--o{ judge_quota : limita
  event_specialty ||--o{ judge_quota : limita
  judge_profile ||--o{ judge_assignment : ocupa
  night ||--o{ judge_assignment : asigna
  event_specialty ||--o{ judge_assignment : asigna

  judge_assignment ||--|| ballot : genera
  ballot ||--o{ ballot_score : contiene
  evaluation_item ||--o{ ballot_score : evalua
  night_troupe_schedule ||--o{ ballot_score : evalua
  night ||--o| voting_window : controla
  ballot ||--o{ ballot_audit_log : audita

  carnival_event ||--o{ troupe_penalty : aplica_a
  event_troupe ||--o{ troupe_penalty : sanciona
  night ||--o{ troupe_penalty : ocurre_en
  carnival_event ||--o| results_release : libera
  carnival_event ||--o| official_scrutiny_record : certifica
```

### Tablas por dominio

| Dominio | Tablas | Estructura y relaciones relevantes |
|---|---|---|
| Autorización y auditoría | `app_role`, `user_role`, `bootstrap_state`, `audit_event`, `role_invitation`, `operational_profile`, `operational_invitation` | `user_role` es la relación N:M entre usuarios Better Auth y roles. `bootstrap_state` conserva el ADMIN inicial. `audit_event` es append-only. `role_invitation` conserva solo el hash, estado y vencimiento de cada invitación operativa. `operational_profile` y `operational_invitation` soportan roles auxiliares (VEEDOR, COMISARIO, SCRUTINEER, ESCRIBANO). |
| Configuración | `carnival_event`, `night`, `event_category`, `event_troupe`, `event_specialty` | Un evento contiene jornadas, categorías, comparsas y especialidades. Categorías, especialidades y comparsas están scoped por evento. |
| Evaluación | `rubric`, `evaluation_item`, `rubric_criterion`, `troupe_nomination` | Una rúbrica pertenece a un evento y tiene ítems y criterios. Cada ítem referencia una rúbrica y una especialidad del mismo evento. Las nominaciones vinculan comparsa y rúbrica del mismo evento. |
| Programación | `night_troupe_schedule`, `configuration_seed` | `night_troupe_schedule` relaciona jornada y comparsa, con orden de presentación único por jornada. `configuration_seed` registra la semilla inicial aplicada a un evento. |
| Jurados | `judge_profile`, `judge_invitation`, `judge_quota`, `judge_assignment` | El perfil de jurado referencia opcionalmente al usuario autenticado. Las invitaciones preservan su historial. Las cuotas son por jornada y especialidad; las asignaciones relacionan jurado, evento, jornada y especialidad. |
| Votación | `ballot`, `ballot_score`, `voting_window`, `ballot_audit_log`, `ballot_sync_operation` | Una planilla corresponde a una asignación de jurado. Cada score relaciona planilla, ítem evaluable y comparsa programada. La ventana controla la votación de una jornada. La auditoría y el ledger de sincronización son append-only. |
| Comisariato y sanciones | `troupe_penalty` | Sanciones en puntos descontables de Mejor Comparsa. Con contexto de evento, comparsa y noche competitiva. Bloqueada contra mutación o revocación post-liberación. |
| Escrutinio y actas | `results_release`, `official_scrutiny_record` | `results_release` registra la liberación oficial por SCRUTINEER/ESCRIBANO. `official_scrutiny_record` almacena el acta notarial sellada con hash JCS/SHA-256 e inmutable a nivel de base de datos. |
| Histórico | `ballot_score_subsanation` | Conserva subsanaciones históricas de 5 puntos; no existe flujo operativo vigente que cree nuevas subsanaciones. |

### Estados y restricciones

| Entidad | Estados o valores válidos |
|---|---|
| `carnival_event` | `CONFIGURING`, `OPEN` |
| `night` | Tipo `COMPETITION` o `AWARDS`; estado `DRAFT`, `OPEN` o `CLOSED` |
| `judge_profile` | `INVITED`, `REGISTERED`, `SUSPENDED` |
| `judge_invitation` | Estado `PENDING`, `USED`, `REVOKED`; entrega `PENDING`, `SENT`, `FAILED` |
| `role_invitation` | Estado `PENDING`, `USED`, `REVOKED`; token persistido solo como hash |
| `judge_assignment` | Estado `ACTIVE`, `REVOKED`; tipo `PRIMARY`, `SUBSTITUTE` |
| `ballot` | `OPEN`, `SUBMITTED`; `REOPENED` solo para finalización de registros históricos |
| `ballot_score.status` | `DRAFT`, `LOCKED` |
| `ballot_score.evaluation_state` | `PENDING` con score `NULL`; `SCORED` con 1 a 10; `NOT_PRESENTED` con 0 |
| `troupe_penalty.status` | `APPLIED`, `REVOKED` |
| `official_scrutiny_record.certified_role` | `SCRUTINEER`, `ESCRIBANO` (inmutable tras inserción) |
| `operational_profile` | `INVITED`, `REGISTERED`, `SUSPENDED` |
| `operational_invitation` | Estado `PENDING`, `USED`, `REVOKED`; entrega `PENDING`, `SENT`, `FAILED` |
| `voting_window` | `OPEN`, `CLOSED` |

### Invariantes de integridad

- Un evento contiene jornadas, categorías, comparsas, especialidades, rúbricas e ítems propios; no se admite reasignarlos entre eventos.
- La configuración solo cambia mientras el evento está `CONFIGURING`; tras abrirse queda protegida por guards de base de datos.
- Una comparsa no puede repetirse ni compartir orden de presentación dentro de una jornada.
- Un jurado solo puede tener una asignación activa por jornada, y las asignaciones activas no pueden exceder el cupo de jornada y especialidad.
- Una planilla debe coincidir con una asignación activa en jurado, evento, jornada y especialidad.
- Un score es único por planilla, ítem evaluable y comparsa programada; el ítem, rúbrica, especialidad y jornada deben pertenecer al mismo contexto de evento.
- La Spec 007 deroga el RF-62 de Spec 004: toda decisión confirmada por el jurado para un ítem queda inmutable y ya no puede volver a `PENDING`.
- Las planillas confirmadas son inmutables; no existen nuevas reaperturas. Una planilla histórica ya `REOPENED` solo puede finalizar en `SUBMITTED`.
- Los scores `PENDING` bloquean confirmar la planilla y cerrar la votación; la combinación de estado semántico y score se valida en PostgreSQL.
- La auditoría, perfiles, invitaciones, asignaciones, planillas y scores conservan historia y no admiten borrado físico operativo.
- No se puede eliminar ni degradar al último `ADMIN` activo.

El código exploratorio de I4-A conserva la revisión de planilla y el ledger `ballot_sync_operation`, pero Offline/sync continúa fuera del alcance operativo hasta contar con un incremento SDD futuro.

## Requisitos

- Node.js 20 o superior.
- PostgreSQL 14 o superior.
- Dos bases PostgreSQL separadas para desarrollo y pruebas.

## Instalación local

Instalar dependencias en ambos módulos:

```bash
cd api && npm ci
cd ../client && npm ci
```

Crear `api/.env` a partir de [`api/.env.example`](api/.env.example), completar las conexiones PostgreSQL y generar un secreto local:

```bash
openssl rand -base64 32
```

Configurar el resultado como `BETTER_AUTH_SECRET`. Luego, desde `api/`:

```bash
npm run auth:migrate
npm run db:migrate
NODE_ENV=development npm run db:seed
NODE_ENV=development npm run db:seed:goya
npm run dev
```

El seed ADMIN usa `SEED_ADMIN_EMAIL`, `SEED_ADMIN_NAME` y `SEED_ADMIN_PASSWORD`. El seed de Goya crea solo datos iniciales sugeridos: evento, noches, categoría y especialidades; no crea comparsas, rubros ni ítems completos.

### Usuarios de demostracion local

El fixture local `Carnaval de Fantasia 2027 - Noche Unica` contiene los siguientes usuarios. Todos usan el valor local de `SEED_ADMIN_PASSWORD` en `api/.env`; la contrasena no se versiona ni se documenta en texto plano.

| Rol | Nombre | Email |
| --- | --- | --- |
| JUDGE (titular) | Alba Acosta | `demo.alba.acosta@carnaval.local` |
| JUDGE (titular) | Clara Cabral | `demo.clara.cabral@carnaval.local` |
| JUDGE (titular) | Esteban Escobar | `demo.esteban.escobar@carnaval.local` |
| JUDGE (suplente) | Bruno Benitez | `demo.bruno.benitez@carnaval.local` |
| JUDGE (suplente) | Diana Duarte | `demo.diana.duarte@carnaval.local` |
| JUDGE (suplente) | Florencia Fernandez | `demo.florencia.fernandez@carnaval.local` |
| ESCRIBANO | Escribano demo | `demo.escribano@carnaval.local` |
| COMISARIO | Comisario demo | `demo.comisario@carnaval.local` |

Cada cuenta debe completar 2FA antes de usar rutas protegidas.

Si una base local fue creada con una versión anterior del fixture y muestra `Invalid password hash`, regenerá primero la credencial del ADMIN y luego repará las cuentas demo:

```bash
NODE_ENV=development npm run db:seed
npm run db:seed:fiction
```

En otra terminal, desde `client/`:

```bash
npm run dev
```

Abrir `http://localhost:5173/#/login`. En desarrollo, Vite redirige `/api` a `http://localhost:3000` y conserva el flujo same-origin.

## Roles y rutas de cliente

- `#/admin/events`: configuración y apertura de eventos.
- `#/admin/judges`: Personas: padrón de jurados, altas de Veedores, Comisarios y Escrutadores, y listado de accesos auxiliares.
- `#/admin/assignments`: cupos, asignaciones y reemplazos.
- `#/admin/voting`: apertura, cierre y estado de planillas; un cierre bloqueado lista los votos pendientes en un modal.
- `#/judge`: consulta de asignaciones y planillas propias.
- `#/judge/ballot?ballotId=:ballotId`: carga y confirmación de una planilla propia.
- `#/invitations/accept`: aceptación de invitaciones de jurados.
- `#/invitations/operational/accept`: aceptación de invitaciones de perfiles operativos (VEEDOR, COMISARIO, SCRUTINEER, ESCRIBANO).
- `#/invitations/role/accept?token=:token`: aceptación pública de una invitación operativa; el cliente elimina el token de la URL antes de inspeccionarla.

Las rutas protegidas requieren 2FA verificado. `ADMIN` administra el sistema; `JUDGE` solo accede a sus asignaciones activas y planillas propias; `VEEDOR` ve conteos operativos sin puntajes.

## API principal

La API expone, entre otros, estos contratos bajo `/api/v1`:

- `GET /me`
- `GET /users`
- `POST /users/invitations`
- `POST /invitations/role/inspect`
- `POST /invitations/role/accept`
- `GET/POST /judges`
- `POST /judges/:judgeId/invitations`
- `POST /judges/:judgeId/suspend`
- `POST /judges/:judgeId/reactivate`
- `GET /events/:eventId/judge-assignments`
- `PUT /events/:eventId/nights/:nightId/specialties/:specialtyId/judge-quota`
- `POST /events/:eventId/judge-assignments`
- `POST /judge-assignments/:assignmentId/revoke`
- `POST /judge-assignments/:assignmentId/replace`
- `GET /judge/assignments`
- `GET /judge/ballots`
- `GET /judge/ballots/:ballotId`
- `PUT /judge/ballots/:ballotId/scores/:scoreId`
- `POST /judge/ballots/:ballotId/submit`
- `POST /judge/ballots/:ballotId/sync`
- `POST /events/:eventId/nights/:nightId/voting/open`
- `POST /events/:eventId/nights/:nightId/voting/close`
- `GET /events/:eventId/nights/:nightId/voting/status`
- `GET /events/:eventId/nights/:nightId/voting/ballots`
- `POST /operational-profiles` [ADMIN+2FA] crear perfil + invitación
- `GET /operational-profiles` [ADMIN+2FA] listar perfiles
- `POST /operational-profiles/:id/invitations` [ADMIN+2FA] reemitir invitación
- `DELETE /operational-profiles/:id/invitations/:invId` [ADMIN+2FA] revocar invitación
- `POST /operational-profiles/:id/suspend` [ADMIN+2FA] suspender
- `POST /operational-profiles/:id/reactivate` [ADMIN+2FA] reactivar
- `POST /operational-invitations/inspect` [PÚBLICO] inspeccionar invitación
- `POST /operational-invitations/accept` [PÚBLICO] aceptar invitación (solo password)

Cada ítem de planilla permanece en `PENDING`, recibe un puntaje ordinario `SCORED` de 1 a 10, o se marca mediante la acción independiente `NOT_PRESENTED` con valor efectivo 0. Si el jurado intenta confirmar con pendientes, recibe un modal bloqueante que los identifica por comparsa, rubro e ítem. Los pendientes también bloquean el cierre administrativo y abren un modal con jurado, comparsa, rubro e ítem faltante. Una planilla confirmada no se puede reabrir.

## Producción

Antes de iniciar producción:

```bash
npm run auth:migrate
npm run db:migrate
npm run bootstrap:admin
npm start
```

El bootstrap requiere `BOOTSTRAP_ADMIN_EMAIL`, `BOOTSTRAP_ADMIN_NAME` y `BOOTSTRAP_ADMIN_PASSWORD`, y solo puede ejecutarse una vez. Producción requiere `EMAIL_PROVIDER=smtp`, `SMTP_*`, `EMAIL_FROM`, `BETTER_AUTH_URL`, `FRONTEND_URL`, HTTPS y un secreto fuerte.

El cliente no es servido por la API. En producción se necesita un reverse proxy o servidor same-origin que sirva el cliente y reenvíe `/api` a la API; el proxy de Vite es solo para desarrollo.

## Validación

Desde `api/`:

```bash
npm test
npm run db:test
npm run db:migrate -- --status
npm audit
```

Desde `client/`:

```bash
npm test
npm run build
npm audit
```

Las pruebas PostgreSQL requieren que `TEST_DATABASE_URL` apunte a una base aislada. La evidencia detallada está en los archivos `validation.md` de cada especificación en [`specs/`](specs/).

La evidencia automatizada completa reporta 38 pruebas de persistencia, 107 de API y 99 de cliente, además del build exitoso de Vite y las migraciones 001-065 sin pendientes.

## SDD y seguridad

- [Constitución](docs/constitution.md)
- [Mapa de fuentes](docs/source-map.md)
- [Estado SDD](docs/sdd-status.md)
- [Spec 001](specs/001-plataforma-votacion-carnavales/spec.md)
- [Clarificaciones](specs/001-plataforma-votacion-carnavales/clarifications.md)
- [Tareas I1](specs/001-plataforma-votacion-carnavales/tasks.md)
- [Spec 002](specs/002-jurados-asignaciones/spec.md)
- [Validación I2](specs/002-jurados-asignaciones/validation.md)
- [Spec 003](specs/003-votacion-planillas/spec.md)
- [Clarificaciones I3](specs/003-votacion-planillas/clarifications.md)
- [Tareas I3](specs/003-votacion-planillas/tasks.md)
- [Validación I3](specs/003-votacion-planillas/validation.md)
- [Spec 004](specs/004-completitud-planillas/spec.md)
- [Clarificaciones Spec 004](specs/004-completitud-planillas/clarifications.md)
- [Tareas Spec 004](specs/004-completitud-planillas/tasks.md)
- [Validación Spec 004](specs/004-completitud-planillas/validation.md)
- [Spec 005 - Offline-First](specs/005-offline-first/spec.md)
- [Clarificaciones Spec 005](specs/005-offline-first/clarifications.md)
- [Tareas Spec 005](specs/005-offline-first/tasks.md)
- [Validación Spec 005](specs/005-offline-first/validation.md)
- [Spec 006 - Cierre sin reapertura](specs/006-cierre-sin-reapertura/spec.md)
- [Clarificaciones Spec 006](specs/006-cierre-sin-reapertura/clarifications.md)
- [Tareas Spec 006](specs/006-cierre-sin-reapertura/tasks.md)
- [Validación Spec 006](specs/006-cierre-sin-reapertura/validation.md)
- [Spec 007 - Inmutabilidad por ítem](specs/007-inmutabilidad-por-item/spec.md)
- [Clarificaciones Spec 007](specs/007-inmutabilidad-por-item/clarifications.md)
- [Tareas Spec 007](specs/007-inmutabilidad-por-item/tasks.md)
- [Plan Spec 007](specs/007-inmutabilidad-por-item/plan.md)
- [Validación Spec 007](specs/007-inmutabilidad-por-item/validation.md)
- [Spec 008 - Gestión de accesos](specs/008-gestion-accesos/spec.md)
- [Clarificaciones Spec 008](specs/008-gestion-accesos/clarifications.md)
- [Plan Spec 008](specs/008-gestion-accesos/plan.md)
- [Tareas Spec 008](specs/008-gestion-accesos/tasks.md)
- [Validación Spec 008](specs/008-gestion-accesos/validation.md)
- [Spec 009 - Experiencia operativa jurado](specs/009-experiencia-operativa-jurado/spec.md)
- [Clarificaciones Spec 009](specs/009-experiencia-operativa-jurado/clarifications.md)
- [Plan Spec 009](specs/009-experiencia-operativa-jurado/plan.md)
- [Tareas Spec 009](specs/009-experiencia-operativa-jurado/tasks.md)
- [Validación Spec 009](specs/009-experiencia-operativa-jurado/validation.md)
- [Spec 010 - Resultados](specs/010-resultados/spec.md)
- [Clarificaciones Spec 010](specs/010-resultados/clarifications.md)
- [Plan Spec 010](specs/010-resultados/plan.md)
- [Tareas Spec 010](specs/010-resultados/tasks.md)
- [Validación Spec 010](specs/010-resultados/validation.md)
- [Spec 011 - Sorteo ceremonial](specs/011-sorteo-ceremonial/spec.md)
- [Clarificaciones Spec 011](specs/011-sorteo-ceremonial/clarifications.md)
- [Plan Spec 011](specs/011-sorteo-ceremonial/plan.md)
- [Tareas Spec 011](specs/011-sorteo-ceremonial/tasks.md)
- [Validación Spec 011](specs/011-sorteo-ceremonial/validation.md)
- [Spec 012 - Planilla online únicamente](specs/012-planilla-online-unicamente/spec.md)
- [Clarificaciones Spec 012](specs/012-planilla-online-unicamente/clarifications.md)
- [Plan Spec 012](specs/012-planilla-online-unicamente/plan.md)
- [Tareas Spec 012](specs/012-planilla-online-unicamente/tasks.md)
- [Validación Spec 012](specs/012-planilla-online-unicamente/validation.md)
- [Spec 013 - Suplencias priorizadas](specs/013-suplencias-priorizadas/spec.md)
- [Clarificaciones Spec 013](specs/013-suplencias-priorizadas/clarifications.md)
- [Plan Spec 013](specs/013-suplencias-priorizadas/plan.md)
- [Tareas Spec 013](specs/013-suplencias-priorizadas/tasks.md)
- [Validación Spec 013](specs/013-suplencias-priorizadas/validation.md)
- [Plan Perfiles Operativos](PLAN-operational-profiles.md)

No commitear `.env`, contraseñas, tokens ni secretos. No existe autoasignación pública de `ADMIN`. La seguridad del sistema se aplica del lado del servidor.
