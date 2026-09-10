# Validación — Spec 027: Rediseño UX del Panel Administrador

## Estado

- Incremento abierto el 2026-09-10. Fase A (A1/A2/A3) cerrada el 2026-09-10.

## Registro por task

### A1 + A2 + A3 (2026-09-10)

- Componentes nuevos (aditivos, reutilizan `Dialog`/`StatusPill`): `ConfirmDialog.jsx`, `EntityDrawer.jsx`, `PageHeader.jsx`, `EventStatusBanner.jsx`, `admin-ux-labels.js` (C4: solo presentación, API intacta) + CSS aditivo en `styles/admin.css` + `AdminUxFoundations.test.jsx` (4 tests).
- `EventReadinessPanel.jsx`: `window.confirm` → `ConfirmDialog` ("Abrir el evento bloqueará toda su configuración. ¿Querés continuar?"); `POST open`, readiness y auditoría intactos. Tests de `confirm` reescritos al flujo dialog (5 tests).
- `EventCard.jsx`: `article role=button` + keydown manual → `<button type=button aria-label=Configurar N>`; mismo contenido visual + reset CSS; tests de `AdminEventsPage` actualizados al nuevo nombre accesible ("Configurar Goya").
- RF cubiertos: RF-UX-01/03/10/11. Sin cambios de rutas, API, estados, roles ni reglas.
- Comandos: `npx vitest run` → 42 archivos / 268 tests en verde; `npm run build` → 72 módulos OK; `git diff --check` limpio, sin secretos.
- Archivos modificados (alcance propio): `client/src/components/{ConfirmDialog,EntityDrawer,PageHeader,EventStatusBanner,admin-ux-labels,AdminUxFoundations.test,EventCard,EventCard.test}.jsx/js`, `client/src/features/EventReadinessPanel.jsx`, `client/src/tests/{AdminEventsPage,EventReadinessPanel}.test.jsx`, `client/src/styles/admin.css`, `specs/027-admin-ux-redesign/*`.
- Nota: el working tree contiene cambios preexistentes ajenos (api Spec 017/schedule, `AdminCompetenciaPage`) no tocados en esta fase.
- Pendiente: Fases C–G según `tasks.md`.

### B1 + B2 (2026-09-10)

- Nuevos (solo lectura, reutilizan `PageHeader`/`EventStatusBanner`/`StatusPill`): `components/ConfigurationProgress.jsx` (camino recomendado con `role=progressbar` + pasos enlazados), `pages/AdminHomePage.jsx` (estado humano vía `uxStatusLabel`, contadores comparsas/jornadas/jurados/rubros, próximo paso con "Continuar configuración", problemas de readiness con "Ir al problema") + `AdminHomePage.test.jsx` (2 tests).
- Navegación: ruta `#/admin/home` (`App.jsx`, guard ADMIN), entrada "Panel" en `AppNavigation.jsx`, tarjeta Administración de `HomePage.jsx` apunta al panel. Rutas existentes intactas.
- Reglas: cero escrituras en el panel (test fija 8 llamadas GET y ningún método de escritura); readiness/apertura/segregación intactas.
- RF cubiertos: RF-UX-01/02/07/10/11.
- Comandos: `npx vitest run` → 43 archivos / 270 tests en verde; `npm run build` → 77 módulos OK; `git diff --check` limpio, sin secretos. Nota: `OfficialRecordPage.test.jsx` dio un falso negativo por timing en una pasada intermedia y pasó aislado (3/3) y en la suite final.
- Archivos modificados (alcance propio): `client/src/{components/ConfigurationProgress.jsx,pages/AdminHomePage.jsx,pages/AdminHomePage.test.jsx,App.jsx,components/AppNavigation.jsx,pages/HomePage.jsx,tests/HomePage.test.jsx,styles/admin.css}`, `specs/027-admin-ux-redesign/*`.
- Pendiente: Fases D–G según `tasks.md`.

### C1 + C2 + C3 (2026-09-10)

- Nuevos (reutilizan `EntityDrawer`/`DialogFooter`/`StatusPill`): `features/NightForm.jsx` (jornada), `features/TroupeForm.jsx` (comparsa, validación #RRGGBB en cliente), `features/CatalogForm.jsx` (tipos/especialidades).
- `EventConfigurationPage.jsx`: N formularios simultáneos → tabla `#|Jornada|Fecha|Tipo|Editar` + drawer; "Orden de visualización" autocompletado `max+1` (C1); `OPEN` sin botones + `EventStatusBanner` + `PageHeader`.
- `AdminCompetenciaPage.jsx` (comparsas): cards con edición inline → tabla `Comparsa|Tipo|Estado|Editar` + drawer; filtros, conteo, swatch y "Vista jurado" conservados; guard `writing` anti doble envío integrado a `WriteContext`.
- `AdminCompetenciaPage.jsx` (tipos/especialidades): cards inline → tablas con código + `StatusPill` + drawer; microcopy de orden; `RESOURCE_CONFLICT` → "Ese nombre u orden ya está en uso." (C4).
- Contratos API intactos (mismos paths/payloads/métodos); validaciones de servidor preservadas (`CATEGORY_INACTIVE`, `VALIDATION_ERROR`, `EVENT_LOCKED`).
- RF cubiertos: RF-UX-01/03/08/09/10/11.
- Comandos: `npx vitest run` → 43 archivos / 270 tests en verde; `npm run build` → 81 módulos OK; `git diff --check` limpio, sin secretos.
- Archivos modificados (alcance propio): `client/src/{features/NightForm,TroupeForm,CatalogForm}.jsx`, `pages/EventConfigurationPage.jsx`, `pages/AdminCompetenciaPage.jsx`, `tests/{EventConfigurationPage,AdminCompetenciaPage}.test.jsx`, `styles/admin.css`, `specs/027-admin-ux-redesign/*`.
- Pendiente: Fases E–G según `tasks.md`.

### D1 + D2 + D3 + D4 (2026-09-10)

- Nuevo `features/RubricTree.jsx` (solo lectura, mismos datos del editor): árbol por especialidad con rubros, ítems ordenados y criterios; "Sin rubros asignados" por especialidad vacía.
- `AdminRubricsSection`: campos de metadata futura (`resolutionMethod`, `expectedSubjectType`, `required`, `allowNotPresented`) colapsados en `<details>` "Opciones avanzadas (sin efecto operativo)" en crear/editar rubro e ítem; `aria-describedby` y payloads intactos. Editor, reorden y validaciones sin cambios.
- Resumen: huérfanos con microcopy "criterio(s) pendiente(s) de asignar" (C4).
- Matriz: título y nav "Planillas de evaluación" (interno `matrix` intacto); aviso `role=alert` de rubros sin ítems y especialidades sin rubro, cada faltante con `[Resolver]` que navega a Rubros y expande el rubro (`focusRubricId`).
- RF cubiertos: RF-UX-01/05/10/11.
- Comandos: `npx vitest run` → 43 archivos / 272 tests en verde; `npm run build` → 82 módulos OK; `git diff --check` limpio, sin secretos.
- Archivos modificados (alcance propio): `client/src/features/RubricTree.jsx`, `pages/AdminCompetenciaPage.jsx`, `tests/AdminCompetenciaPage.test.jsx`, `styles/admin.css`, `specs/027-admin-ux-redesign/*`.
- Pendiente: Fases F–G según `tasks.md`.

### E1 + E2 + E3 + E4 (2026-09-10)

- `AdminJudgesPage.jsx`: acciones excepcionales (reemitir/revocar/suspender, jurados y auxiliares) migradas de `window.confirm` a `ConfirmDialog` con consecuencias y foco de retorno; filtros Buscar (nombre/correo/DNI) + Estado con conteo y vacíos diferenciados. Cero `window.confirm` restante en admin.
- Nuevo `features/JudgeAssignmentDialog.jsx`: contexto Noche·Especialidad visible, radios Titular/Suplente, "Suplente de" solo para suplente; mismo POST de asignación.
- `AdminAssignmentsPage.jsx`: formularios separados → board por tabs de noche y grupos por especialidad con cupo inline (`x/y puestos · Cupo máximo`), cupo en dialog, slots Titular/Suplente con suplente reservado, `⚠ Falta cubrir`, excepcionales en `[Acciones ▾]` (`aria-expanded`) + dialogs con motivo obligatorio y aviso de auditoría, historial colapsado de revocadas/reemplazadas. Endpoints, payloads, mensajes de error y gating (`canConfigure`, `nightStatus CLOSED`) intactos; agrupado defensivo por id con fallback a nombre.
- RF cubiertos: RF-UX-01/03/04/10/11.
- Comandos: `npx vitest run` → 43 archivos / 276 tests en verde; `npm run build` → 83 módulos OK; `git diff --check` limpio, sin secretos.
- Archivos modificados (alcance propio): `client/src/{pages/AdminJudgesPage.jsx,pages/AdminAssignmentsPage.jsx,features/JudgeAssignmentDialog.jsx,tests/AdminJudgesPage.test.jsx,tests/AdminAssignmentsPage.test.jsx,styles/admin.css}`, `specs/027-admin-ux-redesign/*`.
- Pendiente: Fase G según `tasks.md`.

### F1 + F2 + F3 (2026-09-10)

- `AdminVotingPage.jsx`: `<dialog>` manual (refs/showModal/focus casero) → `Dialog` + `DialogFooter` compartidos con retorno de foco; planillas con `StatusPill` humano (Confirmada/En carga/Reabierta); `EventStatusBanner` del evento. `Dialog.jsx`: `aria-modal="true"` explícito (uso siempre modal vía `showModal`).
- `EventReadinessPanel.jsx`: cada faltante con `[Ir al problema]` (jornadas → scroll a la sección vía `onGoToNights`; comparsas/rubros → `#/admin/competencia`); `EventConfigurationPage.jsx` expone la sección y el callback.
- `AdminPenaltiesPage.jsx`: header → `PageHeader` + banner; formulario, lista, revocación y segregación intactos. Escrutinio/acta sin cambios.
- RF cubiertos: RF-UX-01/03/07/10/11.
- Comandos: `npx vitest run` → 43 archivos / 277 tests en verde; `npm run build` → 83 módulos OK; `git diff --check` limpio, sin secretos.
- Archivos modificados (alcance propio): `client/src/{pages/AdminVotingPage.jsx,pages/AdminPenaltiesPage.jsx,features/EventReadinessPanel.jsx,pages/EventConfigurationPage.jsx,components/Dialog.jsx,tests/EventReadinessPanel.test.jsx}`, `specs/027-admin-ux-redesign/*`.
- Pendiente: Fase G según `tasks.md`.

### G0 + G1 (2026-09-10)

- **Discrepancia registrada con honestidad:** `AdminHomePage.jsx`, su test (3er caso) y el ítem G0 fueron refinados por una contribución externa concurrente (no por esta sesión). Se verificó que conserva solo lectura (8 GET, cero escrituras), respeta segregación y pasa en suite; se agregaron los estilos responsive del dashboard (`.admin-dashboard`, 2 columnas ≥64rem, apilado en mobile).
- G1 propio: `components/AdminUxInteraction.test.jsx` (5 tests: Escape en drawer/dialog, `aria-modal`, cleanup sin rastros, progressbar + pasos, orden del árbol, disclosure Suplente); auditoría: tablas con scroll horizontal, drawers 94vw, targets ≥44px y foco visible por tokens, `scope="col"`, `aria-pressed/expanded`, sin color como único indicador.
- RF cubiertos: RF-UX-10/11.
- Comandos: `npx vitest run` → 44 archivos / 282 tests en verde; `npm run build` → 83 módulos OK; `git diff --check` limpio, sin secretos.
- Archivos modificados (alcance propio): `client/src/{components/AdminUxInteraction.test.jsx,styles/admin.css}`, `specs/027-admin-ux-redesign/*`.
- Spec 027 completa: Fases A–G cerradas. Comprobación manual en viewports/teclado/táctil pendiente de sesión con navegador (fuera del alcance automatizable aquí).

### G0 — Refinamiento visual del dashboard (2026-09-10)

- Rediseño de `pages/AdminHomePage.jsx`: layout de dos columnas en desktop (`admin-dashboard`), tarjeta destacada de próximo paso (`admin-next-step-card`), resumen de contadores (`admin-stats`) con enlaces a cada sección, accesos directos contextuales según estado (`CONFIGURING`/`OPEN`/`CLOSED`) y lista de problemas con ícono de advertencia + CTA.
- Estilos aditivos en `styles/admin.css` bajo bloque Spec 027/B+G: grid responsive, tarjetas, quick-links y ajustes mobile.
- Tests actualizados en `pages/AdminHomePage.test.jsx` (3 tests): estado/progreso/problemas, resumen/contadores/accesos directos, y configuración completa.
- Reglas preservadas: cero escrituras en el panel (sigue siendo solo lectura), rutas/API/estados/roles intactos; segregación ADMIN/escrutinio no modificada.
- RF cubiertos: RF-UX-01/02/07/10/11.
- Comandos: `node node_modules/vitest/vitest.mjs run` → 43 archivos / 273 tests en verde; `node node_modules/vite/bin/vite.js build` → 82 módulos OK; `git diff --check` limpio, sin secretos.
- Archivos modificados (alcance propio): `client/src/pages/AdminHomePage.jsx`, `client/src/pages/AdminHomePage.test.jsx`, `client/src/styles/admin.css`, `specs/027-admin-ux-redesign/{tasks,validation}.md`.
- Pendiente: G1 (validación manual 390/768/1440 + teclado/táctil).

### G2 — Refinamiento visual del Admin Home (2026-09-10)

- `AdminHomePage`: header compacto específico de la pantalla, próximo paso con copy y CTA según destino, problemas de readiness con copy accionable, resumen en métricas clickeables y acciones rápidas contextuales por estado. No se modificaron condiciones, cálculos ni contratos API.
- `ConfigurationProgress`: cada etapa es una fila completa navegable, con `aria-label`, `aria-current="step"`, foco visible, icono + estado textual + detalle; el resumen muestra `N de 7 etapas completadas` además del porcentaje existente.
- `AppNavigation`: agrupación visual ADMIN en Operación, Configuración, En vivo y Cierre. Las rutas y condiciones de rol se conservaron; VEEDOR, COMISARIO y JUDGE siguen viendo únicamente sus enlaces autorizados.
- RF cubiertos: RF-UX-01/02/07/10/11.
- Tests específicos: `src/pages/AdminHomePage.test.jsx`, `src/components/AdminUxInteraction.test.jsx`, `src/tests/AppNavigation.test.jsx` → 18 tests en verde.
- Comandos obligatorios: `npm.cmd test` → 44 archivos / 282 tests en verde; `npm.cmd run build` → 83 módulos transformados, build exitoso; `git diff --check` sin errores de whitespace (solo advertencias de conversión LF/CRLF del working tree).
- Archivos modificados (alcance propio): `client/src/pages/AdminHomePage.jsx`, `client/src/pages/AdminHomePage.test.jsx`, `client/src/components/ConfigurationProgress.jsx`, `client/src/components/AppNavigation.jsx`, `client/src/components/AdminUxInteraction.test.jsx`, `client/src/tests/AppNavigation.test.jsx`, `client/src/styles/admin.css`, `specs/027-admin-ux-redesign/{tasks,validation}.md`.

### G3 — Eventos, evento activo y Competencia (2026-09-10)

- Nueva fuente única frontend `context/AdminEventContext.jsx`: carga `/api/v1/events` una vez por shell ADMIN, expone `events`, `activeEvent`, `activeEventId`, cambio/refresco y persiste únicamente el ID en `localStorage` (`carnavales.admin.activeEventId`). No agrega endpoints, DTOs ni persistencia de dominio.
- `App.jsx`: el shell ADMIN monta `AdminEventProvider`; `#/admin/competencia` consume directamente el evento activo y ya no muestra el selector/listado duplicado. Sin evento activo muestra empty state con link a `#/admin/events`.
- `AdminEventsPage.jsx`: catálogo con evento activo distinguido, estados humanos, selección/configuración contextual y creación mediante `Dialog` accesible. El endpoint existente de creación permanece igual.
- `AppNavigation.jsx`: selector global `Evento activo` para ADMIN y etiqueta de navegación `Eventos`; las rutas y guardas de roles se mantienen.
- Selectores locales de ADMIN en Asignaciones, Votación, Penalizaciones, Resultados y Acta se ocultan cuando existe contexto global; esas páginas consumen el mismo ID y limpian/reacondicionan sus datos dependientes al cambiar de evento. Las pruebas aisladas conservan fallback local sin shell.
- `EventCard`, `EventConfigurationPage` y `AdminCompetenciaPage` solo recibieron ajustes de contexto/estado humano y remount por evento; no se modificaron reglas, endpoints, DTOs ni operaciones internas.
- RF cubiertos: RF-UX-01/02/07/10/11.
- Tests agregados/actualizados: `AdminEventContext.test.jsx`, `AdminCompetenciaRoute.test.jsx`, `AdminHomePage.test.jsx`, `AdminEventsPage.test.jsx`, `AppNavigation.test.jsx`, `EventCard.test.jsx`.
- Comandos: `npm.cmd test` → 46 archivos / 287 tests en verde; `npm.cmd run build` → 84 módulos transformados, build exitoso; `git diff --check` sin errores de whitespace (solo advertencias LF/CRLF preexistentes del working tree).
- Deuda: la comprobación manual en navegador de persistencia al recargar y viewports operativos queda pendiente; la cobertura automatizada valida selección, empty state, shell y recarga de contexto.

### G4 — Catálogo visual de Administración de eventos (2026-09-10)

- `AdminEventsPage`: nueva jerarquía `Administración de eventos` → `Evento activo` → `Otros eventos` → `Usuarios y administradores`; se eliminó el copy repetitivo de selección y se mantuvo la funcionalidad de gestión de usuarios al final.
- Card activa: estado humano, marca `✓ Evento activo`, resumen de jornadas/comparsas/jurados/rubros, próximo paso y acciones `Continuar preparación` / `Ver detalle`.
- Cards secundarias: resumen compacto, situación contextual y acciones para `CONFIGURING`, `OPEN` y `CLOSED` (`Usar este evento`, supervisión o resultados).
- Resúmenes cargados con endpoints de lectura ya existentes (`nights`, `troupes`, `rubrics`, `judges`); fallos de lectura muestran `0` sin alterar reglas ni contratos. Creación conserva `POST /api/v1/events` y usa `Dialog` accesible.
- Responsive: grid de dos columnas en desktop, una columna en mobile y métricas 2×2 en pantallas estrechas; targets y foco conservan tokens del sistema.
- RF cubiertos: RF-UX-01/02/07/10/11.
- Tests: `src/tests/AdminEventsPage.test.jsx` → 5 tests; suite completa `npm.cmd test` → 45 archivos / 282 tests en verde.
- Build: `npm.cmd run build` → 83 módulos transformados, build exitoso; `git diff --check` sin errores de whitespace (solo advertencias LF/CRLF preexistentes).
- Deuda: comprobación manual visual en `390x844`, `768x1024` y `1440x900` sigue pendiente de navegador.
