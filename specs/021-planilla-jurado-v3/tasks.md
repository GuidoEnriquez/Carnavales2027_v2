# Tareas — Spec 021: Planilla del Jurado v3

## T01 — Migración de color de identidad y consulta de progreso en API (RF-182, RF-183)

- [x] Crear migración `069_troupe_brand_color.sql` añadiendo `brand_color VARCHAR(32)` a `event_troupe` con check de formato hexadecimal.
- [x] Actualizar whitelist de migraciones en `api/src/db/tests/migrate.test.js`.
- [x] Aplicar migración en bases de datos `carnavales2027_v2` y `carnavales2027_v2_test`.
- [x] Modificar `ballot-service.js` y `voting.routes.js` para admitir `include=progress` retornando `totalScores` y `resolvedScores`.
- [x] Crear prueba automatizada en `api/src/tests/` verificando `include=progress` y la restricción de `brand_color`.

## T02 — Flujo móvil tarjeta a tarjeta y barra de navegación inferior fija (RF-184, RF-188)

- [x] Modificar `JudgeBallotPage.jsx` para soportar vista enfocada por ítem en móvil con Comparsa, Rubro e Ítem visibles.
- [x] Implementar interruptor de vista (Tarjeta única vs Lista completa).
- [x] Implementar barra de navegación inferior fija con avance "X / Y", `← Anterior`, `Siguiente →` y botón "Faltantes".
- [x] Implementar diálogo modal accesible (`<Dialog>`) para "Faltantes" con salto directo al ítem pendiente.

## T03 — Grilla 1–10 con confirmación in situ de doble tap (RF-185)

- [x] Implementar grilla `radiogroup` accesible 2×5 con altura ≥ 56px por botón.
- [x] Añadir palabra-ancla visible (≥ 0.85rem) en cada celda.
- [x] Implementar estado `stagedScore` (primer toque preselecciona "N · Ancla ✓ Confirmar", segundo toque en el mismo lugar emite `saveScore`).
- [x] Manejar atajos de teclado en desktop (1–9, 0 para 10, Enter para confirmar el stagedScore).

## T04 — Segregación de "No se presentó" y persistencia granular por fila (RF-186, RF-187)

- [x] Mover acción "No se presentó" a sección propia bajo la grilla con estilo de advertencia.
- [x] Integrar modal accesible `<Dialog>` para confirmación de "No se presentó" advirtiendo el cómputo de 0 puntos.
- [x] Implementar estado granular por fila (`idle`, `saving`, `saved`, `error`) con botón "Reintentar" aislado, eliminando el congelamiento global `busy`.

## T05 — Color de comparsa e integración en JudgeHomePage (RF-182, RF-183, RF-189)

- [x] Mostrar banda de color (`troupe.brandColor`) en las tarjetas y en la barra lateral de comparsas.
- [x] Actualizar `JudgeHomePage.jsx` para consumir `include=progress` mostrando `<ProgressBar>` y `<StatusPill>` sin peticiones N+1.
- [x] Adaptar layouts responsive en `components.css`: móvil (tarjeta), tablet (2 columnas), desktop (3 columnas con sidebar).

## T06 — Pruebas, validación integral y reporte

- [x] Crear pruebas automatizadas en `client/src/tests/` para `JudgeBallotPage` v3 (tarjeta a tarjeta, doble tap, reintento aislado, faltantes).
- [x] Ejecutar suites completas de tests: `npm test` en `api/`, `npm run db:test` en `api/`, `npm test` en `client/`.
- [x] Ejecutar build de producción del cliente (`npm run build`).
- [x] Documentar evidencias en `specs/021-planilla-jurado-v3/validation.md`.
- [x] Actualizar `docs/sdd-status.md` y `docs/source-map.md`.
