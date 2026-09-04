# Plan de UX por Rol — Carnavales2027_v2

> **Estado:** EN IMPLEMENTACIÓN (iniciado 2026-09-04). Fases 0–3 corresponden a la capacidad nueva de supervisión VEEDOR, formalizada en `specs/016-supervision-veedor/`. Fases 1, 2, 4, 5 y 6 son composición de UI sobre endpoints ya autorizados (precedente: PLAN-UI-UX.md).

## Diagnóstico

| Rol | Aterrizaje post-login | Problema |
|---|---|---|
| ADMIN | `#/admin/events` | 7 secciones sin visión global del ciclo de vida del evento |
| JUDGE | `#/judge` | ✅ Pulido (Spec 009 + PLAN-UI-UX); solo pulido transversal |
| COMISARIO | `#/home` sin enlace propio | Home roto; escapa solo si descubre «Penalizaciones» en la barra |
| SCRUTINEER / ESCRIBANO | `#/home` con un solo enlace | Flujo de 4 pasos sin guía (revisar → liberar → sorteo → acta) |
| VEEDOR | `#/home` sin ningún enlace | Callejón sin salida total; sin pantalla en todo el cliente |

Hallazgos transversales: sin onboarding ni guías de flujo; `goToRoleHome` solo conoce ADMIN y JUDGE; sección de COMISARIO etiquetada «Administración»; falta `prefers-reduced-motion`; `GET /api/v1/events` es ADMIN-only (VEEDOR no puede descubrir eventos → endpoint nuevo bajo Spec 016).

## Fases

### Fase 0 — Artefactos SDD Spec 016
- `specs/016-supervision-veedor/`: spec.md, clarifications.md, plan.md, tasks.md, validation.md.
- Fuente: Jira SVC2-41 + guarda existente `requireVotingObserver`.

### Fase 1 — Home consciente del rol (`#/home`)
- Reconstruir `HomePage.jsx` como hub con tarjetas descriptivas por rol (título + qué hacés + acción).
- Tarjetas: ADMIN (Evento, Personas, Asignaciones, Votación, Penalizaciones, Escrutinio, Acta) · JUDGE (Mi panel) · COMISARIO (Penalizaciones) · SCRUTINEER/ESCRIBANO (Escrutinio, Acta) · VEEDOR (Supervisión).

### Fase 2 — Redirección post-login
- `goToRoleHome` en `LoginPage.jsx`: rol único → destino directo:
  `ADMIN→#/admin/events` · `JUDGE→#/judge` · `COMISARIO→#/admin/penalties` · `SCRUTINEER|ESCRIBANO→#/admin/results` · `VEEDOR→#/veedor` · multi-rol→`#/home`.

### Fase 3 — Vista VEEDOR (Spec 016)
- API: `GET /api/v1/monitor/events` (sesión+2FA+`requireVotingObserver`; solo agregados).
- Cliente: `VeedorMonitorPage.jsx` en `#/veedor`, guard `RequireVotingObserverRole`, polling 15 s con pausa en pestaña oculta, enlace «Supervisión» en nav.

### Fase 4 — Flujo guiado de escrutinio (SCRUTINEER/ESCRIBANO)
- Stepper de 4 pasos en `AdminResultsPage.jsx`, derivado del estado real de la API (sin endpoints nuevos):
  1. Revisar consolidación · 2. Liberar resultados (exclusivo SCRUTINEER/ESCRIBANO) · 3. Sorteo ceremonial (condicional si hay empate) · 4. Emitir acta oficial (enlace a `#/admin/record`).
- Cada paso muestra estado (completado/actual/bloqueado) y su acción primaria.

### Fase 5 — Panel Resumen operativo (ADMIN)
- Panel al tope de `AdminEventsPage.jsx` con endpoints existentes:
  - Estado del evento (`CONFIGURING`/`OPEN`) + noches con estado de votación (% planillas confirmadas).
  - «Próximo paso sugerido» (configurar → asignar → abrir votación → cerrar → escrutinio).

### Fase 6 — Pulido transversal
- Línea «qué hacés acá» estandarizada en páginas admin.
- `AppNavigation`: etiqueta «Comisariato» para la sección de COMISARIO.
- `@media (prefers-reduced-motion: reduce)` en `index.css`.
- JUDGE: sin cambios funcionales (solo se beneficia del pulido transversal).

### Fase 7 — Validación
- Tests Vitest por fase + suites completas (cliente/API/DB) + `npm run build`.
- Comprobación manual: 390×844, 768×1024, 1440×900, teclado y emulación táctil.
- Actualizar `validation.md` (Spec 016), `docs/sdd-status.md`, `docs/source-map.md` y `README.md` con evidencia real.

## Archivos a crear / modificar

| Archivo | Cambio |
|---|---|
| `specs/016-supervision-veedor/*` | Crear artefactos SDD |
| `api/src/routes/monitor.routes.js` + `app.js` | Endpoint de supervisión |
| `client/src/pages/HomePage.jsx` | Hub por rol |
| `client/src/pages/LoginPage.jsx` | Redirects por rol |
| `client/src/pages/VeedorMonitorPage.jsx` | Crear vista |
| `client/src/auth/RequireVotingObserverRole.jsx` | Crear guard |
| `client/src/components/AppNavigation.jsx` | Enlace Supervisión + etiqueta Comisariato |
| `client/src/pages/AdminResultsPage.jsx` | Stepper guiado |
| `client/src/pages/OfficialRecordPage.jsx` | Banner de contexto del flujo |
| `client/src/pages/AdminEventsPage.jsx` | Panel Resumen operativo |
| `client/src/App.jsx` | Ruta `#/veedor` |
| `client/src/index.css` | Estilos nuevos + `prefers-reduced-motion` |
| Tests cliente/API | Crear/actualizar |

## Dependencias
- Fase 0 → Fase 3. Fases 1, 2, 4, 5, 6 independientes entre sí; pueden avanzar en paralelo a Fase 0.
