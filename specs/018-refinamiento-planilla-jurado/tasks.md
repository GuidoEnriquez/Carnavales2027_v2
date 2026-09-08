# Tareas — Spec 018

## T01 — Nombre de ítem visible (RF-160)

- [x] Añadir `score.itemName` como texto visible en filas pendientes y bloqueadas
- [x] Añadir caption de estado (`puntuado <valor>` / `No se presentó`) en filas bloqueadas
- [x] Conservar `aria-label` existente como respaldo accesible
- [x] Verificar que pruebas existentes pasan

## T02 — Separación de "No se presentó" (RF-161)

- [x] Separar `No se presentó` en región visual distinta de la grilla 1–10
- [x] Añadir fondo, borde e ícono de advertencia propios
- [x] Mantener min-height ≥ 48px en el botón
- [x] Verificar distancia visual ≥ 1 row de gap

## T03 — Palabra-ancla (RF-162)

- [x] Definir mapeo 1–10 → palabra descriptiva como constante local
- [x] Renderizar `N · PALABRA` en la grilla de puntaje
- [x] Renderizar `N · PALABRA` en la chip bloqueada
- [x] Renderizar `N · PALABRA` en el modal de confirmación

## T04 — Indicador de guardado (RF-163)

- [x] Eliminar el punto verde fijo "● Guardado local"
- [x] Añadir estado de guardado transitorio (feedback de éxito/error)
- [x] Feedback de éxito desaparece tras 2–3 s
- [x] Feedback de error persiste hasta el próximo intento

## T05 — Navegación por ítems (RF-164)

- [x] Añadir controles `← Anterior` / `Siguiente →` por ítem
- [x] Implementar scroll suave al ítem correspondiente
- [x] Añadir sidebar de comparsas para viewports ≥70rem
- [x] Sidebar resalta comparsa actual y permite saltar
- [x] Ocultar sidebar en mobile/tablet

## T06 — Focus y a11y en diálogos (RF-165)

- [x] Restaurar foco al elemento disparador al cerrar diálogos de confirmación y cierre
- [x] Añadir `aria-describedby` en diálogos de confirmación y cierre
- [x] Añadir `:focus-visible` con contraste suficiente en la grilla de puntaje
- [x] Verificar Esc funciona en los 3 diálogos

## T07 — Validación manual responsive

- [ ] Revisar en 390x844 (móvil): grilla 2-col, `No se presentó` separado, sin sidebar, prev/next
- [ ] Revisar en 768x1024 (tablet): sin sidebar, layout adaptado
- [ ] Revisar en 1440x900 (escritorio): sidebar visible, grilla 5-col
- [ ] Verificar navegación por teclado: focus visible, Esc cierra diálogos
- [ ] Verificar targets táctiles ≥ 48px
- [x] Ejecutar pruebas de cliente existentes (138/138 pasan)
- [x] Ejecutar build de producción (exitoso)