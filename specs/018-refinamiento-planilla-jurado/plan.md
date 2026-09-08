# Plan — Spec 018: Refinamiento UX de la planilla del jurado

## Enfoque

Los cambios son **exclusivamente de presentación** en el cliente React/Vite. No se modifica el backend, la BD ni los contratos API. Cada tarea es una unidad acotada de trabajo frontend que puede validarse individualmente con pruebas de cliente y revisión visual manual.

## Dependencias

- **Spec 007** (inmutabilidad por ítem): se preserva intacta; solo se refinan elementos visuales del modal.
- **Spec 009** (experiencia operativa jurado): se corrigen desvíos de implementación (RF-84, RF-86) y se cumplen objeciones no atendidas por la versión original.
- **Spec 012** (planilla online): el indicador de guardado se alinea con el modelo 100% online.
- **client/AGENTS.md** (brief §17): la sidebar de escritorio se implementa según el diseño aprobado.

## Secuencia de tareas

### T01 — Nombre de ítem visible (RF-160)

**Objetivo:** Asegurar que cada fila de puntuación muestre el nombre del ítem como texto visible, no solo en `aria-label`.

**Archivos:**
- `client/src/pages/JudgeBallotPage.jsx` (línea ~230-234)
- `client/src/index.css`

**Criterio de aceptación:**
- Cada `.score-row` pendiente y bloqueada muestra `score.itemName` como texto visible.
- Las filas bloqueadas muestran additionally un caption (`puntuado <valor>` o `No se presentó`).
- El `aria-label` existente se conserva como respaldo accesible.
- Pruebas existentes siguen pasando.

### T02 — Separación de "No se presentó" (RF-161)

**Objetivo:** Separar la acción `No se presentó` del bloque de dígitos 1–10 con jerarquía visual propia.

**Archivos:**
- `client/src/pages/JudgeBallotPage.jsx` (línea ~232-233)
- `client/src/index.css`

**Criterio de aceptación:**
- `No se presentó` aparece en una región visual separada de la grilla de 1–10, con fondo, borde e ícono de advertencia distintos.
- La distancia mínima entre la grilla y la acción es ≥ 1 row de gap.
- El botón mantiene min-height ≥ 48px.
- No se oculta detrás de un menú o acordeón.

### T03 — Palabra-ancla (RF-162)

**Objetivo:** Asociar cada valor 1–10 a una palabra descriptiva visible en la grilla, la chip bloqueada y el modal de confirmación.

**Archivos:**
- `client/src/pages/JudgeBallotPage.jsx` (líneas ~232, ~281)
- `client/src/index.css`

**Criterio de aceptación:**
- La grilla muestra cada valor como `N · PALABRA` (p. ej. `8 · MUY BUENO`).
- La chip bloqueada muestra `8 · MUY BUENO`.
- El modal de confirmación muestra `Puntuación: 8 · MUY BUENO`.
- El mapeo está como constante local (no hardcodeada en lógica de negocio), facilitando su configuración futura.

### T04 — Indicador de guardado (RF-163)

**Objetivo:** Reemplazar el "● Guardado local" estático por un indicador ligado a la persistencia online real.

**Archivos:**
- `client/src/pages/JudgeBallotPage.jsx` (línea ~242)
- `client/src/index.css`

**Criterio de aceptación:**
- No hay punto verde fijo permanente.
- Tras confirmar un ítem exitosamente: feedback transitorio "✓ Guardado" (2–3 s), luego desaparece.
- Error de red: "Error de guardado — reintentá" persistente hasta el próximo intento.
- Sin mensajes de "local", "sync" o "offline".
- Consistente con Spec 012.

### T05 — Navegación por ítems (RF-164)

**Objetivo:** Añadir controles `← Anterior` / `Siguiente →` por ítem y sidebar de comparsas en escritorio.

**Archivos:**
- `client/src/pages/JudgeBallotPage.jsx`
- `client/src/index.css`

**Criterio de aceptación:**
- La planilla muestra controles de navegación por ítem (prev/next) que hacen scroll suave al ítem correspondiente.
- En viewports ≥70rem (≥1120px), se muestra una sidebar con la lista de comparsas y estado de cada una.
- La sidebar resalta la comparsa actual y permite saltar entre comparsas.
- La navegación no modifica decisiones ni el orden de presentación.
- Responsive: la sidebar se oculta en mobile/tablet.

### T06 — Focus y a11y en diálogos (RF-165)

**Objetivo:** Restaurar retorno de foco, `aria-describedby` y `:focus-visible` en diálogos y grilla.

**Archivos:**
- `client/src/pages/JudgeBallotPage.jsx` (líneas ~269-300)
- `client/src/index.css`

**Criterio de aceptación:**
- Los diálogos de confirmación y cierre restauran el foco al elemento disparador al cerrar.
- Los diálogos de confirmación y cierre tienen `aria-describedby` enlazado al contenido descriptivo.
- La grilla de puntaje muestra `:focus-visible` con contraste suficiente.
- Los 3 diálogos tienen focus-trap (nativo showModal, aceptable) y Esc funciona.

### T07 — Validación manual responsive

**Objetivo:** Verificar todos los cambios en los 3 viewports operativos con teclado y emulación táctil.

**Criterio de aceptación:**
- 390x844 (móvil): grilla 2-col, `No se presentó` separado, sin sidebar, prev/next visible.
- 768x1024 (tablet): sin sidebar, layout adaptado.
- 1440x900 (escritorio): sidebar visible, grilla 5-col.
- Teclado: navega todos los controles, focus visible, Esc cierra diálogos.
- Touch: targets ≥ 48px, sin dependencia de hover.

## Validación posterior

Tras completar T01–T07:
1. Ejecutar pruebas de cliente existentes.
2. Ejecutar build de producción.
3. Revisión visual manual en los 3 viewports.
4. Documentar hallazgos en `validation.md`.
5. Actualizar `sdd-status.md` con el cierre del incremento.