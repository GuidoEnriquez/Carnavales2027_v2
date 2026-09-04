# Spec 016 — Supervisión de Votación por VEEDOR

## Estado

- **Fase SDD:** especificación y plan aprobados (2026-09-04).
- **Fuentes normativas:** Jira `SVC2-41` («Supervisar votaciones sin exponer puntajes»); Confluence C2 «Guía del equipo y planificación» (sección Supervisión); Spec 003 (secreto de puntajes); Spec 008 (rol `VEEDOR`); `PLAN-role-ux.md` (Fases 0 y 3).
- **Dependencias:** rol `VEEDOR` y autenticación 2FA (Spec 008 / Perfiles Operativos); ventana de votación y planillas (Spec 003/004/006); guarda de API existente `requireVotingObserver` (`api/src/auth/require-voting-observer.js`).

## Contexto y problema

El rol `VEEDOR` existe en la API desde Spec 008 y puede autenticarse con 2FA, pero el cliente no tiene ninguna pantalla para él: tras el login cae en `#/home` sin enlaces (callejón sin salida). La API ya autoriza a `VEEDOR` la lectura de `GET /events/:eventId/nights/:nightId/voting/status` (conteos agregados de planillas), pero el descubrimiento de eventos (`GET /api/v1/events`) está restringido a `ADMIN`, por lo que un `VEEDOR` no puede operar.

## Objetivo

Proveer al `VEEDOR` una **vista de supervisión de la votación en tiempo operativo**, limitada a conteos agregados y estados de planillas por noche competitiva, **sin exponer puntajes, nombres de jurados ni rankings** (secreto de voto y mínimo privilegio).

## Alcance

### Incluye:

- Nuevo endpoint de solo lectura `GET /api/v1/monitor/events`, protegido por sesión + 2FA + `requireVotingObserver` (`ADMIN` o `VEEDOR`), que devuelve para cada evento: identificación, estado, y sus noches competitivas (`COMPETITION`) con estado de la ventana de votación y conteos agregados de planillas por estado (`OPEN`, `SUBMITTED`, `REOPENED`, `REPLACED`) y total votante.
- Nueva página cliente `#/veedor` (`VeedorMonitorPage`) accesible solo para `VEEDOR` (y `ADMIN` como observador): selector de evento y noche, tarjetas de conteo (En carga / Confirmadas / Reabiertas / Total), barra de progreso de confirmación y estado de la ventana de votación.
- Auto-refresco por polling cada 15 segundos, pausado cuando la pestaña está oculta (`document.visibilitychange`), con reanudación inmediata al volver.
- Guard de cliente `RequireVotingObserverRole` (solo UX; la autorización real sigue en la API).
- Redirección post-login del rol `VEEDOR` a `#/veedor` y enlace «Supervisión» en la navegación global.
- Mensajes de empty-state y de error claros, en lenguaje de negocio, sin exponer datos sensibles.
- Accesibilidad: vista usable en móvil (390×844), tablet (768×1024) y desktop (1440×900), navegación por teclado, `aria-live` en actualizaciones de conteo, contraste WCAG AA y controles táctiles ≥ 48px.

### Excluye:

- Exposición de puntajes, rankings, nombres de jurados o detalle por comparsa (secreto de voto, SVC2-41).
- Cualquier escritura o acción operativa del `VEEDOR` (la vista es estrictamente de lectura).
- Alertas push, WebSockets o notificaciones en tiempo real (se usa polling simple; la infraestructura en tiempo real queda diferida).
- Supervisión de penalizaciones o de resultados liberados (cubiertos por Spec 014 y Spec 010 con sus propios roles).
- Modificaciones a Offline-First (diferido por Spec 005/012).

## Requisitos Funcionales

- **RF-131 (Endpoint de supervisión).** EL SISTEMA DEBE exponer `GET /api/v1/monitor/events` con sesión y 2FA verificados, autorizado exclusivamente a `ADMIN` o `VEEDOR` mediante `requireVotingObserver`. La respuesta DEBE contener, por evento: `id`, `name`, `status`, y un arreglo `nights` con las noches de tipo `COMPETITION` que tengan al menos una planilla o una ventana de votación registrada, cada una con `id`, `name`, `status`, `votingStatus` (`NOT_OPEN`/`OPEN`/`CLOSED`), `counts` (`OPEN`, `SUBMITTED`, `REOPENED`, `REPLACED`) y `total` votante (`OPEN + SUBMITTED + REOPENED`).
- **RF-132 (Mínimo privilegio en la respuesta).** El endpoint de supervisión NO DEBE incluir puntajes, nombres o correos de jurados, nombres de comparsas, ni datos de rankings o resultados. Solo conteos agregados y estados.
- **RF-133 (Rechazo a roles no autorizados).** Todo acceso al endpoint por parte de `JUDGE`, `COMISARIO`, `SCRUTINEER`, `ESCRIBANO`, usuarios sin 2FA o anónimos DEBE ser rechazado (401 `UNAUTHENTICATED`, 403 `TWO_FACTOR_REQUIRED` o 403 `VEEDOR_REQUIRED`).
- **RF-134 (Vista de supervisión).** CUANDO un `VEEDOR` autenticado ingresa a `#/veedor`, EL CLIENTE DEBE mostrar las noches competitivas del evento seleccionado con sus conteos de planillas, el estado de la ventana de votación y el porcentaje de confirmación, sin acciones de escritura.
- **RF-135 (Auto-refresco no invasivo).** LA VISTA DEBE refrescar los conteos cada 15 segundos mientras la pestaña esté visible, pausar el refresco cuando la pestaña se oculta y reanudarlo al volver, sin acción manual del usuario.
- **RF-136 (Guard y navegación por rol).** EL CLIENTE DEBE proteger `#/veedor` con un guard que admita `VEEDOR` o `ADMIN`; la navegación global DEBE ofrecer el enlace «Supervisión» a esos roles; el login DEBE redirigir al `VEEDOR` a `#/veedor`.
- **RF-137 (Accesibilidad y responsive).** LA VISTA DEBE ser operable con teclado y táctil en 390×844, 768×1024 y 1440×900, con `aria-live="polite"` en los conteos actualizados, foco visible y contraste WCAG AA.

## Criterios de Aceptación

1. Un `VEEDOR` con 2FA puede ingresar a `#/veedor`, elegir evento y noche, y ver los conteos de planillas y el estado de la ventana sin ver puntajes ni nombres.
2. `GET /api/v1/monitor/events` devuelve solo agregados (conteos y estados); no aparece ningún campo con puntajes, jurados ni comparsas.
3. Un `JUDGE`, `COMISARIO`, `SCRUTINEER`, `ESCRIBANO` o usuario sin 2FA recibe 401/403 al llamar el endpoint; la ruta `#/veedor` muestra acceso denegado a roles no autorizados.
4. Los conteos se actualizan automáticamente cada ~15 s con la pestaña visible y dejan de emitir requests cuando la pestaña está oculta.
5. El login de un usuario cuyo único rol es `VEEDOR` termina en `#/veedor`; la navegación muestra «Supervisión» solo a `VEEDOR`/`ADMIN`.
6. La vista es usable con teclado y táctil en los tres viewports de referencia, y las actualizaciones de conteo son anunciadas por tecnología asistiva (`aria-live`).
