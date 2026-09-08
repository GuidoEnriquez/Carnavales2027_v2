# Validación — Spec 018

## Estado

- **Fase SDD:** Implementación completada. Tareas T01–T06 con evidencia automatizada. T07 (validación manual responsive) pendiente de comprobación en los 3 viewports operativos.

## Evidencia

### Automatizada

- **Build de producción:** exitoso (vite build, sin errores de TypeScript ni JSX).
- **Pruebas de cliente:** 138/138 pasan (31 archivos, 0 fallos).
- **Prueba modificada:** `JudgeBallotPage.test.jsx` — actualizada la coincidencia del nombre del botón para reflejar el anchor (`8 · Muy bueno` en vez de `8`).

### Cambios realizados

| Archivo | Cambio |
|---|---|
| `client/src/pages/JudgeBallotPage.jsx` | Añadido `SCORE_ANCHOR` mapping, nombre de ítem visible, separación de "No se presentó", palabra-ancla en grilla/chip/modal, indicador de guardado online, sidebar de comparsas, navegación prev/next por ítem, focus return en diálogos, `aria-describedby` en diálogos. |
| `client/src/index.css` | Actualizado grid `.score-row` a 2 columnas, añadido `.score-copy`, `.score-anchor`, `.not-presented-separator`, sidebar (≥70rem), item navigation, `:focus-visible` en botones de grilla. |
| `client/src/tests/JudgeBallotPage.test.jsx` | Actualizada query del botón de puntaje para incluir anchor. |

### Manual (pendiente)

- Revisión en 390x844 (móvil): grilla 2-col, "No se presentó" separado, sin sidebar, prev/next visible.
- Revisión en 768x1024 (tablet): sin sidebar, layout adaptado.
- Revisión en 1440x900 (escritorio): sidebar visible, grilla 5-col.
- Verificación de navegación por teclado: focus visible, Esc cierra diálogos.
- Verificación de targets táctiles ≥ 48px.

## Invariantes preservados

- **Spec 007 (inmutabilidad):** intacta. El modal de confirmación por ítem sigue intacto; solo se añadió palabra-ancla al display.
- **Spec 012 (online):** el indicador de guardado refleja persistencia online, no local.
- **Spec 006 (sin reapertura):** sin cambios al comportamiento de cierre.
- **Cero migraciones:** no se modificó el backend ni la BD.

## Pendientes

- Comprobación manual en los 3 viewports operativos.
- Actualizar `sdd-status.md` con el cierre del incremento tras validación manual.
