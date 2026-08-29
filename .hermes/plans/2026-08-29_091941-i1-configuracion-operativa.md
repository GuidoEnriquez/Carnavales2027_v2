# Carnavales2027_v2 — Incremento I1: Configuración operativa Implementation Plan

> **For Hermes:** Implement task-by-task. Before implementation, load `test-driven-development`; after each task execute its listed verification. Do not start the next task until the current task is verified. Do not push, deploy, or perform destructive database operations without explicit authorization.

**Goal:** Entregar un panel administrativo protegido que permita configurar y abrir un evento de Carnaval con jornadas, categorías, comparsas, especialidades, rubros e ítems evaluables; dejando modeladas —sin UI operativa— las nominaciones y la programación de presentaciones por noche.

**Architecture:** Monorepo mínimo con `api/` y `client/`. La API Express expone recursos administrativos versionados bajo `/api/v1`, usa PostgreSQL con migraciones incrementales y aplica autorización ADMIN en el servidor. El cliente React/Vite consume esos contratos y concentra la administración dentro de un backoffice; no contiene reglas de autorización ni de apertura que reemplacen las validaciones transaccionales del servidor.

**Tech Stack:** Node.js 20+, JavaScript ESM, Express, PostgreSQL y `pg`; Better Auth con 2FA/OTP obligatorio para autenticación; React + Vite para el cliente; `node:test` + PostgreSQL aislada para integración de API/dominio. TypeScript queda fuera de I1 para mantener coherencia con el stack del proyecto anterior y limitar el alcance.

---

## 1. Alcance y fuentes

### Incluido

- Autenticación y autorización ADMIN mínima.
- Bootstrap seguro de primer administrador y seeds solo de desarrollo/testing.
- CRUD administrativo de eventos, jornadas, categorías, especialidades, participaciones de comparsa, rubros e ítems evaluables.
- Modelo de datos de nominaciones y programación por noche sin UI ni lógica operativa.
- Apertura atómica y validada de un evento.
- Auditoría append-only de cambios administrativos y de privilegios.

### Excluido

- Registro/invitación/asignación/reemplazo de jurados.
- Carga o confirmación de votos, planillas, PWA/offline/sync.
- Gestión de nominaciones, sorteo, rotación y reprogramación.
- Penalizaciones, escrutinio, desempates, resultados y actas.

### Requisitos cubiertos en I1

| Área | RF |
|---|---|
| Configuración y apertura | RF-01, RF-01a–RF-01o, RF-02 |
| Administración segura | RF-01p–RF-01s, RNF-01, RNF-03, RNF-04, RNF-06 |
| Trazabilidad | RF-15, RNF-05 |
| Preparación futura, sin implementación operativa | RF-03–RF-06, RF-07–RF-21 |

### Fuente funcional

- `docs/constitution.md`
- `docs/source-map.md`
- `specs/001-plataforma-votacion-carnavales/spec.md`
- `specs/001-plataforma-votacion-carnavales/clarifications.md`
- Obsidian: `20 - Proyectos/Carnavales 2027/Guia del equipo - Confluence.md`
- Obsidian: `20 - Proyectos/Carnavales 2027/Backlog SVC2 - Resumen.md`
- README histórico: `/run/media/guido/Datos/Proyectos/carnavales/README.md`

## 2. Decisiones de diseño propuestas

> Estas son propuestas técnicas derivadas de la spec; se deben revisar antes de implementar.

1. **IDs UUID para entidades de dominio.** Aíslan los recursos del dominio de los identificadores de Better Auth. Las FKs a usuarios de Better Auth conservan el tipo `TEXT` que use su tabla `user.id`.
2. **Soft-disable, no borrado histórico.** Categorías, especialidades, rubros e ítems con uso no se eliminan; se desactivan. Para entidades aún sin uso, la API puede ofrecer eliminación física solo si no viola la regla de preservación. Alternativa más simple: prohibir todo `DELETE` en I1 y usar siempre `active=false`; se recomienda esta última para reducir ambigüedad y preservar trazabilidad.
3. **Estados mínimos.** `event.status = CONFIGURING | OPEN`; `night.kind = COMPETITION | AWARDS`; `night.status = DRAFT | OPEN | CLOSED`; participación/categoría/especialidad/rubro/ítem usan `active: boolean`. El plan no agrega estados de votación porque están fuera de I1.
4. **Apertura como caso de uso transaccional.** `POST /events/:eventId/open` valida todos los mínimos y cambia de estado dentro de una transacción con bloqueo de fila del evento. El cliente no implementa una validación alternativa; solo muestra los errores estructurados de API.
5. **Relación rubro–especialidad derivada.** No habrá tabla `rubric_specialty`: `evaluation_item.specialty_id` es la única fuente de verdad. Un rubro puede involucrar varias especialidades por sus ítems activos.
6. **Nominaciones y programación preparadas, no expuestas.** Se crean tablas/entidades con FKs y restricciones básicas, pero no rutas ni pantallas de gestión. Esto no debe convertirse en una implementación parcial de votación.
7. **Auditoría de dominio append-only.** `audit_event` almacena actor, acción, tipo/id de entidad, datos antes/después acotados y timestamp. Triggers bloquean UPDATE/DELETE de la auditoría. No registrar contraseñas, tokens ni secretos.
8. **Better Auth sin modificar su esquema.** Un `app_role` o `user_role` de aplicación referencia `user.id`; Better Auth gestiona identidad/sesión y la aplicación gestiona autorización. No agregar columna de rol a la tabla de Better Auth.
9. **Último ADMIN en I1.** ADMIN activo significa usuario existente con rol `ADMIN`; no se añade estado de cuenta ni se modifica Better Auth. Los servicios de revocación de rol y eliminación de usuario deben impedir que el conteo llegue a cero.

## 3. Modelo de datos propuesto

### Entidades administradas en I1

```text
app_role (ADMIN)
user_role (user_id TEXT → Better Auth user.id, role_code)

carnival_event
  ├── event_category
  ├── event_specialty
  ├── night
  │     └── night_troupe_schedule              [modelo, sin UI]
  ├── event_troupe
  │     └── troupe_nomination                  [modelo, sin UI]
  └── rubric
        └── evaluation_item → event_specialty

audit_event
bootstrap_state
```

### Restricciones relevantes

- `event_category`: `UNIQUE(event_id, code)` y `UNIQUE(event_id, display_order)`; `active` obligatorio.
- `event_specialty`: `UNIQUE(event_id, code)`; `active` obligatorio.
- `event_troupe`: FK compuesta a categoría del mismo evento o trigger de consistencia; nunca categoría como texto libre.
- `rubric`: `UNIQUE(event_id, code)`; `requires_nomination`, `expected_subject_type`, `active`.
- `evaluation_item`: `UNIQUE(rubric_id, code)`; FK a especialidad del mismo evento (mediante FK compuesta o trigger); `active`.
- `night_troupe_schedule`: `UNIQUE(night_id, event_troupe_id)` y `UNIQUE(night_id, presentation_order)`; estado; no rutas en I1.
- `troupe_nomination`: FK a `event_troupe`, rubro y tipo de sujeto; no rutas en I1.
- Cuando `carnival_event.status = OPEN`, triggers/restricciones de servicio bloquean actualizaciones administrativas de configuración.
- Antes de abrir se valida RF-01c, RF-01c.1 y RF-01g.4 en el servidor dentro de transacción.

## 4. Contrato API propuesto

Todos los endpoints requieren sesión válida y rol `ADMIN`, excepto endpoints de Better Auth. Los errores responden JSON estable:

```json
{
  "error": {
    "code": "EVENT_CONFIGURATION_INCOMPLETE",
    "message": "El evento no puede abrirse.",
    "details": {
      "missing": ["ACTIVE_CATEGORY"],
      "incompleteRubrics": ["reina-comparsa"]
    }
  }
}
```

| Recurso | Rutas propuestas |
|---|---|
| Sesión actual | `GET /api/v1/me` |
| Eventos | `GET/POST /api/v1/events`, `GET/PATCH /api/v1/events/:eventId`, `POST /api/v1/events/:eventId/open` |
| Noches | `GET/POST /api/v1/events/:eventId/nights`, `PATCH /api/v1/nights/:nightId` |
| Categorías | `GET/POST /api/v1/events/:eventId/categories`, `PATCH /api/v1/categories/:categoryId` |
| Especialidades | `GET/POST /api/v1/events/:eventId/specialties`, `PATCH /api/v1/specialties/:specialtyId` |
| Participaciones | `GET/POST /api/v1/events/:eventId/troupes`, `PATCH /api/v1/event-troupes/:eventTroupeId` |
| Rubros | `GET/POST /api/v1/events/:eventId/rubrics`, `PATCH /api/v1/rubrics/:rubricId` |
| Ítems evaluables | `GET/POST /api/v1/rubrics/:rubricId/items`, `PATCH /api/v1/evaluation-items/:itemId` |
| Estado de configuración | `GET /api/v1/events/:eventId/readiness` |

`POST /open` devuelve errores detallados; `GET /readiness` permite que el panel anticipe faltantes, pero no reemplaza la validación al abrir.

## 5. Cliente propuesto

- Ruta pública: `/login`.
- Ruta protegida: `/admin/events`.
- Ruta protegida: `/admin/events/:eventId/configuration` con secciones: Resumen, Noches, Categorías, Comparsas, Especialidades, Rubros e Ítems.
- La pantalla muestra el estado `CONFIGURING` / `OPEN`, el resumen de completitud y una acción explícita **Abrir evento**.
- Al abrir, se deshabilitan formularios de configuración y se explica que las correcciones auditadas no forman parte de I1.
- Formulario de rubro: código, nombre, activo, objetivo de evaluación (`TROUPE | NOMINATION`) y tipo de sujeto si corresponde.
- Formulario de ítem: código, nombre, activo y especialidad responsable; no se selecciona una especialidad directamente para el rubro.

## 6. Plan de implementación granular

### Task 1: Inicializar repositorio y convenciones de proyecto

**Objective:** Crear la estructura mínima reproducible de monorepo sin incorporar reglas de dominio.

**Files:**
- Create: `README.md`, `.gitignore`, `.env.example`, `api/package.json`, `client/package.json`
- Create: `api/src/`, `api/src/tests/`, `api/src/db/`, `client/src/`
- Test: comandos de instalación, lint/build base.

**Steps:**
1. Inicializar Git local y definir `.gitignore` para dependencias, `.env`, builds y cobertura.
2. Crear API ESM con scripts `dev`, `test`, `db:migrate`, `db:seed`, `db:test`.
3. Crear cliente Vite React con scripts `dev`, `build`, `test` si se agrega un runner compatible.
4. Documentar variables necesarias sin secretos.
5. Verificar: `npm install` en API y cliente; `npm run build` en cliente; `node --check` en API.

**Hecho cuando:** ambos paquetes instalan y ejecutan sus verificaciones básicas desde una clonación limpia.

### Task 2: Integrar PostgreSQL y runner de migraciones

**Objective:** Establecer migraciones incrementales, checksum e idempotencia.

**Files:**
- Create: `api/src/db/pool.js`, `api/src/db/migrate.js`, `api/src/db/migrations/001_core.sql`
- Create: `api/src/db/tests/migrations.test.js`

**Steps:**
1. Escribir test que aplica migraciones en una base aislada y verifica `schema_migrations`.
2. Ejecutar el test y comprobar que falla antes del runner.
3. Implementar pool lazy y runner con advisory lock, transacción por migración y checksum.
4. Agregar migración con extensiones necesarias (`pgcrypto`) y tabla de control.
5. Repetir migraciones y verificar que la segunda corrida no aplica cambios.

**Hecho cuando:** `npm run db:migrate` es reproducible y la reejecución es idempotente.

### Task 3: Incorporar Better Auth y roles de aplicación

**Objective:** Autenticar usuarios sin modificar tablas internas de Better Auth y autorizar ADMIN en servidor.

**Files:**
- Create: `api/src/auth/auth.js`, `api/src/auth/require-session.js`, `api/src/auth/require-admin.js`
- Create: `api/src/routes/auth.routes.js`, `api/src/routes/me.routes.js`
- Modify: `api/src/db/migrations/002_authz.sql`, `api/src/server.js`
- Test: `api/src/tests/authz.test.js`

**Steps:**
1. Escribir pruebas de integración: anónimo recibe 401; usuario autenticado sin ADMIN recibe 403; ADMIN llega a una ruta protegida.
2. Migrar Better Auth con su mecanismo oficial y crear `app_role`/`user_role` referenciando `user.id` como `TEXT`.
3. Implementar middleware que obtenga sesión de Better Auth y consulte rol de aplicación en DB.
4. Exponer `GET /api/v1/me` con identidad y roles mínimos; nunca devolver secretos.
5. Ejecutar pruebas de autorización.

**Hecho cuando:** ningún endpoint administrativo se puede consumir sin una sesión ADMIN válida.

### Task 4: Bootstrap único de administrador y reglas de privilegio

**Objective:** Crear ADMIN inicial de modo seguro y preservar siempre al menos un ADMIN activo.

**Files:**
- Create: `api/src/scripts/bootstrap-admin.js`, `api/src/db/seeds/development.js`
- Modify: `api/src/db/migrations/002_authz.sql`, `api/package.json`, `.env.example`
- Test: `api/src/tests/bootstrap-admin.test.js`, `api/src/tests/roles.test.js`

**Steps:**
1. Probar que el bootstrap falla sin configuración requerida y en ejecuciones posteriores.
2. Implementar bootstrap exclusivo de producción, con variables de entorno documentadas y sin imprimir credenciales.
3. Implementar seed ADMIN exclusivamente si `NODE_ENV` es desarrollo/test; rechazar producción.
4. Añadir transacción/regla que impida degradar o borrar el último ADMIN activo.
5. Auditar alta, promoción, degradación e intento rechazado relevante.

**Hecho cuando:** la política RF-01p–RF-01s queda cubierta por pruebas reales.

### Task 5: Auditoría append-only de administración

**Objective:** Registrar cambios críticos sin permitir modificación o borrado del historial.

**Files:**
- Modify: `api/src/db/migrations/003_audit.sql`
- Create: `api/src/audit/audit-service.js`
- Test: `api/src/db/tests/audit.test.js`

**Steps:**
1. Escribir pruebas que permiten `INSERT` y rechazan `UPDATE` / `DELETE` sobre auditoría.
2. Crear tabla `audit_event` y trigger append-only.
3. Implementar helper de auditoría transaccional para servicios administrativos.
4. Validar que no almacene contraseñas, tokens ni otros secretos.

**Hecho cuando:** cambios de privilegios, configuración y apertura generan eventos auditables inmutables.

### Task 6: Modelo y CRUD de eventos y jornadas

**Objective:** Permitir configurar un evento y sus jornadas antes de abrirlo.

**Files:**
- Modify: `api/src/db/migrations/004_events.sql`
- Create: `api/src/modules/events/event.repository.js`, `event.service.js`, `event.routes.js`
- Test: `api/src/modules/events/event.test.js`

**Steps:**
1. Escribir pruebas de creación, edición permitida en `CONFIGURING` y edición rechazada en `OPEN`.
2. Crear tablas `carnival_event` y `night`, con tipos de jornada competencia/premios.
3. Implementar servicios y rutas ADMIN para eventos/jornadas.
4. Auditar operaciones de escritura.
5. Ejecutar las pruebas de módulo y autorización.

**Hecho cuando:** un ADMIN puede gestionar eventos y noches de manera segura; una noche sin votación está representada explícitamente.

### Task 7: Modelo y CRUD de categorías y participaciones de comparsa

**Objective:** Cumplir RF-01g a RF-01g.4 sin texto libre ni pérdida histórica.

**Files:**
- Modify: `api/src/db/migrations/005_troupes.sql`
- Create: `api/src/modules/troupes/category.service.js`, `troupe.service.js`, `troupe.routes.js`
- Test: `api/src/modules/troupes/troupe.test.js`

**Steps:**
1. Escribir pruebas: código único por evento; participación exige categoría del mismo evento; categoría usada no se borra; categoría inactiva no acepta nuevas participaciones.
2. Crear `event_category` y `event_troupe`; aplicar integridad de mismo evento mediante FK compuesta o trigger testeado.
3. Implementar CRUD administrativo y operación de desactivación.
4. Auditar cambios.
5. Ejecutar pruebas contra PostgreSQL aislado.

**Hecho cuando:** no existe una vía de API ni de DB para asignar texto libre o una categoría de otro evento.

### Task 8: Modelo y CRUD de especialidades

**Objective:** Gestionar especialidades configurables por evento sin valores globales obligatorios.

**Files:**
- Modify: `api/src/db/migrations/006_specialties.sql`
- Create: `api/src/modules/specialties/specialty.service.js`, `specialty.routes.js`
- Test: `api/src/modules/specialties/specialty.test.js`

**Steps:**
1. Probar código único por evento y bloqueo de desactivación si deja ítems activos inválidos (o devolución de error de readiness, según servicio).
2. Crear `event_specialty` con `code`, `name`, `display_order`, `active`.
3. Implementar CRUD ADMIN y desactivación.
4. Preparar seed Goya 2027 con Baile, Vestuario y Batería solamente como datos.

**Hecho cuando:** un evento puede usar una configuración distinta y no hay especialidades hardcodeadas.

### Task 9: Modelo y CRUD de rubros e ítems evaluables

**Objective:** Implementar la fuente de verdad rubro → ítems → especialidad.

**Files:**
- Modify: `api/src/db/migrations/007_rubrics.sql`
- Create: `api/src/modules/rubrics/rubric.service.js`, `rubric.routes.js`
- Test: `api/src/modules/rubrics/rubric.test.js`

**Steps:**
1. Escribir pruebas: ítem pertenece a un solo rubro; ítem requiere especialidad activa del mismo evento; no existe tabla `rubro_especialidad`; especialidades de rubro se obtienen desde ítems activos.
2. Crear tablas `rubric` y `evaluation_item`; definir objetivo `TROUPE | NOMINATION`, tipo de sujeto opcional y `active`.
3. Implementar CRUD ADMIN para rubro e ítem.
4. Exponer en GET de rubro las especialidades derivadas como dato de lectura, no editable.
5. Auditar cambios y correr pruebas.

**Hecho cuando:** RF-01d, RF-01e y RF-01j–RF-01n quedan demostrados por tests de integración.

### Task 10: Modelar nominaciones y programación por noche sin UI

**Objective:** Dejar las relaciones futuras persistibles sin implementar flujo operativo prematuro.

**Files:**
- Modify: `api/src/db/migrations/008_future-voting-model.sql`
- Test: `api/src/db/tests/future-model.test.js`

**Steps:**
1. Escribir pruebas de integridad de `night_troupe_schedule` y `troupe_nomination` sin crear rutas HTTP.
2. Crear las tablas, sus FKs, estados mínimos y unicidades propuestas.
3. Verificar que no se agregan rutas, pantallas ni lógica de sorteo/nominación.
4. Documentar explícitamente que esas tablas no forman un módulo operativo todavía.

**Hecho cuando:** el modelo está preparado y las pruebas verifican consistencia, sin expandir el alcance de I1.

### Task 11: Implementar validación transaccional de apertura

**Objective:** Abrir un evento solo cuando toda configuración activa está completa.

**Files:**
- Create: `api/src/modules/events/event-readiness.service.js`
- Modify: `api/src/modules/events/event.service.js`, `event.routes.js`
- Test: `api/src/modules/events/event-opening.test.js`

**Steps:**
1. Crear casos de fallo independientes: falta noche de competencia, comparsa, especialidad activa, rubro activo, categoría válida, ítem activo o especialidad activa para ítem.
2. Crear caso exitoso de apertura y comprobar que bloquea ediciones posteriores.
3. Implementar cálculo de readiness y apertura dentro de transacción con bloqueo de evento.
4. Responder errores estructurados con lista de comparsas y rubros incompletos.
5. Auditar apertura exitosa y rechazos relevantes.

**Hecho cuando:** los criterios RF-01a–RF-01c.1 y RF-01g.4 pasan mediante pruebas de integración.

### Task 12: Crear cliente React, sesión y guardas ADMIN

**Objective:** Preparar el backoffice sin confiar la autorización al navegador.

**Files:**
- Create: `client/src/app/router.jsx`, `client/src/auth/session-context.jsx`, `client/src/api/http.js`
- Create: `client/src/pages/LoginPage.jsx`, `client/src/pages/AdminEventsPage.jsx`, `client/src/components/RequireAdmin.jsx`
- Test: `client/src/auth/RequireAdmin.test.jsx`

**Steps:**
1. Escribir prueba de redirección/estado para usuario anónimo y usuario sin ADMIN.
2. Consumir el endpoint de sesión y establecer guardas de UX.
3. Implementar login mediante endpoints oficiales de Better Auth.
4. Dejar claro en comentarios/documentación que estas guardas no reemplazan `require-admin` en API.
5. Ejecutar pruebas y build de cliente.

**Hecho cuando:** solo un ADMIN autenticado llega a las pantallas administrativas, y la API continúa protegiendo datos por sí misma.

### Task 13: Construir panel de eventos y jornadas

**Objective:** Proveer la interfaz administrativa de configuración base.

**Files:**
- Create: `client/src/pages/EventConfigurationPage.jsx`, `client/src/features/events/`
- Test: `client/src/features/events/EventConfigurationPage.test.jsx`

**Steps:**
1. Escribir prueba de formularios que muestran datos y errores de API.
2. Construir listado/creación/edición de eventos.
3. Agregar sección para crear/editar jornadas y distinguir competencia de premios.
4. Deshabilitar controles cuando el evento está `OPEN`.
5. Verificar la integración con API en entorno local.

**Hecho cuando:** un ADMIN configura evento y jornadas desde cliente sin usar herramientas de base de datos.

### Task 14: Construir panel de categorías y comparsas

**Objective:** Administrar catálogo de categorías y participaciones conforme a restricciones históricas.

**Files:**
- Create: `client/src/features/troupes/`
- Modify: `client/src/pages/EventConfigurationPage.jsx`
- Test: `client/src/features/troupes/*.test.jsx`

**Steps:**
1. Probar que el formulario usa selector de categoría, nunca input libre.
2. Implementar listado/alta/edición/desactivación de categorías.
3. Implementar alta/edición de participación de comparsa con categoría de mismo evento.
4. Mostrar por qué una categoría no puede eliminarse y ofrecer desactivación.
5. Ejecutar build y pruebas de UI.

**Hecho cuando:** el cliente no permite crear configuraciones que la API rechaza por categoría inválida.

### Task 15: Construir panel de especialidades, rubros e ítems

**Objective:** Configurar el árbol de evaluación y sus especialidades derivadas.

**Files:**
- Create: `client/src/features/specialties/`, `client/src/features/rubrics/`
- Modify: `client/src/pages/EventConfigurationPage.jsx`
- Test: `client/src/features/rubrics/*.test.jsx`

**Steps:**
1. Probar que un ítem requiere una especialidad y que un rubro no ofrece selector directo de especialidad.
2. Implementar CRUD de especialidades.
3. Implementar CRUD de rubros con objetivo de evaluación y tipo de sujeto cuando corresponda.
4. Implementar CRUD de ítems; mostrar especialidades derivadas en modo lectura.
5. Ejecutar pruebas y build.

**Hecho cuando:** la UI representa el modelo sin introducir la relación prohibida `rubro_especialidad`.

### Task 16: Implementar readiness y acción de apertura en UI

**Objective:** Hacer visible la completitud sin duplicar reglas de negocio.

**Files:**
- Create: `client/src/features/events/EventReadinessPanel.jsx`
- Modify: `client/src/pages/EventConfigurationPage.jsx`
- Test: `client/src/features/events/EventReadinessPanel.test.jsx`

**Steps:**
1. Probar renderizado de comparsas/rubros faltantes a partir de respuesta API.
2. Mostrar readiness remoto y la acción de apertura con confirmación explícita.
3. Tras abrir, refrescar estado y dejar la configuración en solo lectura.
4. Verificar que errores concurrentes o validaciones de backend se muestran correctamente.
5. Ejecutar build y pruebas.

**Hecho cuando:** un ADMIN puede detectar faltantes, abrir correctamente y observar el bloqueo posterior.

### Task 17: Seed de Goya 2027 y documentación operativa

**Objective:** Ofrecer datos de demostración sin convertirlos en reglas del sistema.

**Files:**
- Create: `api/src/db/seeds/goya-2027.js`
- Modify: `README.md`, `.env.example`, `docs/source-map.md`
- Test: `api/src/db/tests/seed.test.js`

**Steps:**
1. Probar que el seed es idempotente y rechaza producción.
2. Sembrar como datos editables: especialidades Baile/Vestuario/Batería, Primera categoría, noches de Goya y catálogo inicial de rubros del README histórico cuando esté suficientemente definido.
3. Documentar comandos de desarrollo, migración, seed, bootstrap y test, sin secretos.
4. Verificar reejecución de migraciones/seed y la creación de base de tests aislada.

**Hecho cuando:** un desarrollador puede levantar un ambiente de demo desde cero sin hardcodear Goya dentro de lógica de aplicación.

### Task 18: Validación final y matriz RF → prueba

**Objective:** Demostrar la cobertura del incremento antes de declararlo terminado.

**Files:**
- Create: `specs/001-plataforma-votacion-carnavales/validation.md`
- Modify: `README.md`

**Steps:**
1. Crear matriz para RF-01, RF-01a–RF-01s, RF-02, RF-15 y RNF aplicables.
2. Ejecutar `npm test`, `npm run db:test`, `npm run build` y flujo manual ADMIN de creación → configuración → readiness → apertura.
3. Confirmar que no se implementaron rutas/UI de votación, nominaciones, sorteo o escrutinio.
4. Revisar diff y documentar limitaciones verificadas.
5. Preparar commit de I1 solo después de que todas las verificaciones sean exitosas; no hacer push.

**Hecho cuando:** la matriz indica evidencia real para cada requisito de I1 y diferencia explícitamente lo diferido.

## 7. Estrategia de pruebas

| Nivel | Casos prioritarios |
|---|---|
| DB/integración | misma categoría/especialidad/evento; constraints de unicidad; no soft-delete histórico; audit append-only; programación sin duplicados por noche |
| Servicio | cálculo de readiness; apertura transaccional; bloqueo de edición OPEN; último ADMIN activo; bootstrap único |
| API | 401 anónimo, 403 no-ADMIN, validación de payload, errores de apertura detallados |
| Cliente | guardas de ruta; formularios sin texto libre de categoría; errores de API; UI read-only después de OPEN |
| Manual | seed, bootstrap controlado, creación de evento, configuración incompleta, apertura fallida, corrección, apertura exitosa |

## 8. Riesgos y tradeoffs

- **Autorización Better Auth:** se debe verificar la versión instalada y la forma oficial de montar rutas/sesión antes de codificar. El plan no asume que sus tablas se llamen de una forma específica.
- **FK de mismo evento:** PostgreSQL no puede expresar todas las reglas de alcance con FKs simples; preferir constraints compuestas donde sea posible y triggers pequeños, testeados, para el resto.
- **Soft-disable universal:** evita ambigüedad y protege historia, pero obliga a filtrar `active=true` en formularios y readiness.
- **Modelo futuro:** las tablas de nominaciones/programación no deben llevar endpoints prematuros; su inclusión solo prepara integridad futura.
- **Catálogo de rubros inicial:** el README histórico tiene ejemplos y tipos, pero no constituye necesariamente la lista final oficial; seeds deben identificarse como ejemplos hasta validar la página “Ítems a votar por jurados”.

## 9. Criterio de aprobación antes de implementación

Se puede pasar a `tasks.md` cuando se aprueben estas propuestas:

1. Stack JavaScript ESM + Express + PostgreSQL/pg + Better Auth + React/Vite.
2. Soft-disable como política general de I1, sin DELETE físico desde panel.
3. Estados mínimos propuestos para eventos y jornadas.
4. Tablas de nominaciones y programación creadas sin endpoints/UI.
5. Endpoints REST propuestos y estructura modular por recurso.

Una vez aprobado, `tasks.md` dividirá estas tareas en unidades de hasta 30 minutos y cada una declarará RF, dependencias y verificación real.
