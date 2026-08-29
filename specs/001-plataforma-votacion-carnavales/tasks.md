# Tasks — Spec 001: Incremento I1 · Configuración operativa

## Reglas de ejecución

- Implementar **una sola tarea por vez** y no iniciar la siguiente sin verificar la actual.
- Cada tarea debe respetar `docs/constitution.md`, `spec.md`, `clarifications.md` y el plan aprobado.
- Tests primero cuando aplique. No declarar éxito sin salida real de test, migración, build o verificación indicada.
- No push, merge, deploy ni operaciones destructivas sin autorización explícita.
- Si una fuente funcional contradice una tarea, detener implementación y actualizar primero la spec.

## Estado general

| ID | Estado | Dependencias |
|---|---|---|
| T01–T25 | Pendiente | Ver tareas individuales |

---

## T01 — Inicializar repositorio y archivos base

**RF:** Constitución §7; RNF-03, RNF-04.  
**Dependencias:** Ninguna.

- Crear estructura de monorepo, `.gitignore`, README raíz y `.env.example` sin secretos.
- Inicializar Git local si aún no existe.
- Definir los directorios `api/`, `client/`, `docs/`, `specs/` y estructura de `.hermes/plans/` ya existente.

**Hecho cuando:** `git status` muestra la estructura inicial esperada y no incluye secretos, dependencias ni artefactos de build.

## T02 — Inicializar API JavaScript ESM

**RF:** RNF-03, RNF-04.  
**Dependencias:** T01.

- Crear `api/package.json` y la estructura mínima de Express ESM.
- Definir scripts iniciales: desarrollo, test, migración, seed y DB de tests.
- Agregar endpoint de salud sin datos de dominio.

**Hecho cuando:** `npm install` y `npm test` en `api/` finalizan correctamente; un test verifica el endpoint de salud.

## T03 — Inicializar cliente React/Vite

**RF:** Alcance I1 — panel administrativo.  
**Dependencias:** T01.

- Crear `client/package.json`, Vite, React y ruta base.
- Agregar build mínimo reproducible.

**Hecho cuando:** `npm install` y `npm run build` en `client/` finalizan correctamente.

## T04 — Configurar pool PostgreSQL y variables de entorno

**RF:** RNF-01, RNF-03.  
**Dependencias:** T02.

- Implementar pool lazy de PostgreSQL con validación de `DATABASE_URL`.
- Documentar variables de desarrollo, testing y bootstrap sin valores sensibles.
- No abrir conexiones al importar módulos que puedan reutilizarse en test.

**Hecho cuando:** un test valida fallo claro sin `DATABASE_URL` y una conexión correcta con URL de test.

## T05 — Crear runner de migraciones idempotente

**RF:** RNF-03, RNF-04.  
**Dependencias:** T04.

- Crear tabla de control, checksums y advisory lock.
- Aplicar cada migración en transacción.
- Implementar modo de estado de migraciones.

**Hecho cuando:** ejecutar migraciones dos veces deja la segunda ejecución sin migraciones pendientes y el test lo demuestra.

## T06 — Integrar Better Auth sin modificar su esquema

**RF:** RF-01p, RNF-01.  
**Dependencias:** T02, T04, T05.

- Configurar Better Auth con su mecanismo oficial de migración.
- Mantener la identidad/sesión de Better Auth separada del dominio.
- Verificar el tipo real de `user.id` antes de crear FKs de aplicación.

**Hecho cuando:** se puede obtener una sesión válida y no se agrega ninguna columna de aplicación a tablas internas de Better Auth.

## T07 — Crear roles de aplicación y middleware ADMIN

**RF:** RF-01p, RF-01r, RNF-01.  
**Dependencias:** T06.

- Crear migración de roles de aplicación referenciando el usuario de Better Auth.
- Crear middleware de sesión y autorización ADMIN en servidor.
- Exponer `GET /api/v1/me` con identidad y roles mínimos.

**Hecho cuando:** tests de integración comprueban 401 anónimo, 403 autenticado sin ADMIN y 200 ADMIN.

## T08 — Implementar auditoría append-only

**RF:** RF-01r, RF-15, RNF-05.  
**Dependencias:** T05, T07.

- Crear tabla `audit_event`, helper transaccional y trigger que bloquee UPDATE/DELETE.
- Definir payload permitido y prohibir almacenar tokens, contraseñas y secretos.

**Hecho cuando:** tests prueban INSERT permitido y UPDATE/DELETE rechazados; un cambio de rol genera auditoría.

## T09 — Implementar bootstrap seguro de primer ADMIN

**RF:** RF-01p–RF-01s, RNF-06.  
**Dependencias:** T07, T08.

- Crear script de bootstrap ejecutable solo con configuración explícita de operador.
- Registrar estado de bootstrap para impedir segunda ejecución.
- No imprimir credenciales ni secretos.

**Hecho cuando:** tests prueban ausencia de configuración, ejecución inicial exitosa y segunda ejecución rechazada.

## T10 — Implementar seeds de ADMIN para desarrollo/testing

**RF:** RF-01q.  
**Dependencias:** T07, T08.

- Crear seed controlado de ADMIN para desarrollo/test.
- Rechazar ejecución con entorno de producción.
- Mantener reejecución idempotente.

**Hecho cuando:** el seed crea/reutiliza ADMIN en test y falla explícitamente con `NODE_ENV=production`.

## T11 — Proteger el último ADMIN activo

**RF:** RF-01s.  
**Dependencias:** T07, T08.

- Implementar servicio/regla transaccional para cambios de rol.
- Rechazar eliminación o degradación del último ADMIN activo.
- Auditar alta, promoción, degradación e intento rechazado relevante.

**Hecho cuando:** los tests prueban que un único ADMIN no puede perder el rol y que sí puede hacerlo cuando existe otro ADMIN activo.

## T12 — Modelar eventos y jornadas

**RF:** RF-01, RF-01a, RF-02.  
**Dependencias:** T05, T08.

- Crear migración de evento y jornadas/noches.
- Incluir estados de evento `CONFIGURING | OPEN` y distinción `COMPETITION | AWARDS`.
- Crear repositorio/servicio sin rutas todavía.

**Hecho cuando:** tests de DB prueban unicidad de jornada por evento y representación explícita de una noche sin votación.

## T13 — Exponer API ADMIN de eventos y jornadas

**RF:** RF-01, RF-01a, RF-02.  
**Dependencias:** T07, T12.

- Agregar rutas ADMIN para crear/listar/editar eventos y jornadas.
- Permitir cambios solamente en `CONFIGURING`.
- Auditar cada escritura.

**Hecho cuando:** tests de API cubren CRUD ADMIN, autorización y edición bloqueada cuando el evento está OPEN.

## T14 — Modelar categorías por evento

**RF:** RF-01g.1, RF-01g.3.  
**Dependencias:** T12.

- Crear categoría scoped por evento con id, nombre, código, orden y `active`.
- Aplicar unicidad de código y orden dentro de evento.
- Adoptar soft-disable en lugar de borrado desde I1.

**Hecho cuando:** pruebas de DB verifican unicidad y que una categoría usada no puede eliminarse físicamente.

## T15 — Modelar participaciones de comparsa

**RF:** RF-01g, RF-01g.2.  
**Dependencias:** T14.

- Crear participación de comparsa por evento con nombre visible, categoría obligatoria y estado.
- Garantizar que la categoría sea del mismo evento y no se guarde texto libre.

**Hecho cuando:** pruebas de integración rechazan una categoría de otro evento, categoría inactiva y participación sin categoría.

## T16 — Exponer API ADMIN de categorías y comparsas

**RF:** RF-01g–RF-01g.4.  
**Dependencias:** T07, T14, T15.

- Crear rutas ADMIN para categorías y participaciones de comparsa.
- Ofrecer desactivación explícita, no `DELETE` físico.
- Auditar escrituras.

**Hecho cuando:** tests de API confirman que no se acepta texto libre y que solo se listan categorías activas como elegibles para nuevas participaciones.

## T17 — Modelar y exponer especialidades por evento

**RF:** RF-01f.  
**Dependencias:** T12, T07.

- Crear especialidad scoped por evento con código, nombre, orden y `active`.
- Exponer CRUD ADMIN y soft-disable.
- No establecer valores obligatorios globales.

**Hecho cuando:** tests prueban que dos eventos pueden tener catálogos distintos y que Baile/Vestuario/Batería no están hardcodeados.

## T18 — Modelar rubros e ítems evaluables

**RF:** RF-01d, RF-01j, RF-01l–RF-01n.  
**Dependencias:** T17.

- Crear rubro e ítem evaluable; cada ítem pertenece a un rubro y tiene una especialidad responsable activa del mismo evento.
- Configurar objetivo `TROUPE | NOMINATION` y tipo de sujeto esperado en rubro.
- No crear tabla `rubro_especialidad`.

**Hecho cuando:** pruebas verifican que las especialidades de un rubro se derivan de ítems activos, no de una relación directa.

## T19 — Exponer API ADMIN de rubros e ítems

**RF:** RF-01d, RF-01e, RF-01j–RF-01n.  
**Dependencias:** T07, T18.

- Crear rutas ADMIN de rubros e ítems.
- Devolver especialidades derivadas de ítems como información de lectura.
- No exponer ruta para una relación directa rubro-especialidad.

**Hecho cuando:** pruebas de API prueban creación de ítems, validación de especialidad y ausencia de endpoint/tabla de relación directa.

## T20 — Preparar modelo de nominaciones sin gestión funcional

**RF:** RF-01k–RF-01o.  
**Dependencias:** T15, T18.

- Crear entidad de nominación/sujeto vinculable a participación y rubro.
- No crear endpoint, pantalla, workflow ni validación de planilla para nominaciones.

**Hecho cuando:** migración y pruebas de integridad existen, y la revisión de rutas confirma que no se implementó gestión operativa de nominaciones.

## T21 — Preparar programación por noche sin lógica de sorteo

**RF:** RF-01h, RF-01i.  
**Dependencias:** T12, T15.

- Crear entidad `night_troupe_schedule` con noche, participación, orden y estado.
- Aplicar unicidad de comparsa y orden dentro de noche.
- No crear endpoints, UI, sorteo, rotación ni reprogramación.

**Hecho cuando:** pruebas de DB validan unicidades y la revisión de API confirma que no hay funciones operativas adelantadas.

## T22 — Implementar readiness y apertura transaccional

**RF:** RF-01a–RF-01c.1, RF-01g.4.  
**Dependencias:** T13, T16, T17, T19.

- Implementar servicio de completitud y endpoint de lectura.
- Implementar `POST /api/v1/events/:eventId/open` dentro de transacción y bloqueo de evento.
- Validar jornadas, comparsas, categorías activas, especialidades activas, rubros activos e ítems activos válidos.
- Responder lista de comparsas/rubros incompletos.

**Hecho cuando:** pruebas de integración cubren todos los fallos de apertura, el caso exitoso y el bloqueo de edición posterior.

## T23 — Implementar cliente: sesión y rutas ADMIN

**RF:** Alcance I1, RF-01p, RNF-01.  
**Dependencias:** T03, T07.

- Crear contexto de sesión, cliente HTTP y guardas de interfaz.
- Crear login y navegación inicial de administrador.
- Aclarar en documentación que la seguridad real permanece en API.

**Hecho cuando:** test de cliente verifica redirección de anónimo/no-ADMIN y `npm run build` finaliza correctamente.

## T24 — Implementar panel de configuración de eventos

**RF:** RF-01, RF-01a, RF-01f–RF-01n.  
**Dependencias:** T13, T16, T17, T19, T23.

- Implementar pantallas/secciones para eventos, jornadas, categorías, comparsas, especialidades, rubros e ítems.
- Usar selector de categoría, no texto libre.
- Mostrar especialidades de rubro derivadas y bloquear edición tras OPEN.

**Hecho cuando:** pruebas de UI verifican formularios principales y build; verificación manual permite configurar un evento completo como ADMIN.

## T25 — Implementar panel de readiness, seed Goya y validación final

**RF:** RF-01c–RF-01c.1, RF-01g.4, RF-01q, RF-15, RNF-04–RNF-06.  
**Dependencias:** T10, T22, T24.

- Implementar panel que muestra faltantes de configuración y permite abrir el evento.
- Crear seed idempotente de Goya 2027: datos sugeridos, no constantes de aplicación.
- Ejecutar matriz RF → test/verificación y documentarla en `validation.md`.
- Revisar que I1 no incorporó votación, jurados, sorteo, nominaciones operativas, offline, resultados ni actas.

**Hecho cuando:** `npm test`, `npm run db:test`, `npm run build`, migraciones, seed y flujo manual de configuración→apertura reportan éxito real; `validation.md` enumera evidencia por RF.

---

## Orden de commits propuesto

1. `chore: initialize carnavales 2027 v2 workspace`
2. `feat(db): add migration runner and authorization foundation`
3. `feat(auth): add secure admin bootstrap and role controls`
4. `feat(admin): add event and competition configuration API`
5. `feat(admin-ui): add protected configuration backoffice`
6. `test: validate event readiness and opening workflow`

Cada commit se crea solamente después de verificar las tareas que contiene. No hacer push sin aprobación.
