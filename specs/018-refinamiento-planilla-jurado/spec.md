# Spec 018 — Refinamiento UX de la planilla del jurado

## Estado

- **Fase SDD:** Propuesta para aprobación (no implementada). Artefactos preparados a partir de la crítica de diseño de la planilla (impeccable `critique`, 2026-09-07).
- **Fuente:** Critique de diseño sobre `client/src/pages/JudgeBallotPage.jsx`; el brief de producto en `client/AGENTS.md`; Specs 004, 006, 007, 009 y 012.
- **Relación:** corrige desvíos de la implementación actual respecto a la Spec 009 ya aprobada y del brief, y refina la presentación de la planilla sin alterar autorización, API, persistencia ni invariantes de inmutabilidad, completitud o modelo online.

## Objetivo

Reducir la carga cognitiva en el momento de decisión del jurado y corregir elementos engañosos o genéricos de la planilla, de modo que cada fila de puntuación presente una única decisión clara (ítem nombrado, valor con ancla verbal, `No se presentó` separado) y que el estado de guardado refleje la realidad online.

## Alcance

Incluye, sobre la planilla del jurado (`client/src/pages/JudgeBallotPage.jsx` y sus estilos en `client/src/index.css`):

- Mostrar el nombre del ítem (y caption de valor) como texto visible en filas pendientes y bloqueadas, no solo en `aria-label`.
- Separar visualmente la acción `No se presentó` del bloque de dígitos 1–10, con región y jerarquía propias para reducir el punto de decisión.
- Añadir palabra-ancla descriptiva junto a cada valor (mapeo 1–10), en la grilla, la chip bloqueada y el modal de confirmación.
- Reemplazar el indicador estático "● Guardado local" por un estado ligado a la persistencia online real (Spec 012), con feedback transitorio sobre el guardado.
- Añadir navegación por ítem (`← Anterior` / `Siguiente →`) y, en viewports de escritorio, una navegación lateral de comparsas según el brief §17.
- Restaurar el retorno de foco y `aria-describedby` en los diálogos de confirmación y cierre, y `:focus-visible` en la grilla de puntaje.

Excluye:

- Cambios a rutas, contratos API, roles, 2FA, persistencia, auditoría, resultados, actas o penalizaciones.
- Hacer editable una decisión `SCORED` o `NOT_PRESENTED` (Spec 007) o reabrir planillas (Spec 006).
- Cambios al modelo de puntuación (1–10, `NOT_PRESENTED` = 0), al cálculo de puntajes o al backend.
- Cambios a la pantalla de cierre de noche, resultados o administración.
- Activar Offline-First o indicadores de conexión como capacidad operativa (Spec 005/012).

## Requisitos funcionales

- **RF-160.** Cada fila de puntuación DEBE mostrar el nombre del ítem como texto visible y un caption que comunique el estado (`PENDING`, `puntuado <valor>` o `No se presentó`). El `aria-label` existente DEBE conservarse como respaldo accesible, no como única vía.
- **RF-161.** La escala ordinaria DEBE exponer solo 1 a 10 como controles táctiles de al menos 48px, y la acción `No se presentó` DEBE presentarse en una región visual separada y con advertencia propia, distinta de un puntaje (refuerza RF-84 de Spec 009).
- **RF-162.** Cada valor 1–10 DEBE asociarse a una palabra-ancla descriptiva (p. ej. "Muy bueno") mostrada junto al dígito en la grilla, en la chip bloqueada y en el modal de confirmación, de modo que el significado quede verificable de un vistazo. La escala-ancla exacta se define por configuración de producto, no hardcodeada.
- **RF-163.** El indicador de guardado NO DEBE afirmar persistencia local ("Guardado local") en un sistema 100% online. DEBE reflejar el resultado real del guardado online: estado neutro inicial, feedback transitorio de éxito o error, sin afirmar un almacén local que Spec 012 retiró (refuerza RF-108 de Spec 012).
- **RF-164.** La planilla DEBE permitir navegar entre ítems con controles `← Anterior` / `Siguiente →` y, en escritorio, exponer una navegación lateral de comparsas (brief §17). La navegación NO DEBE modificar decisiones ni el orden de presentación.
- **RF-165.** Los diálogos de confirmación, pendientes y cierre DEBEN conservar contratos de foco: retorno de foco al elemento disparador al cerrar, `aria-describedby` al contenido descriptivo, y `:focus-visible` visible en la grilla de puntaje (refuerza RF-86 de Spec 009).

## Criterios de aceptación

- El cliente mantiene la API y los flujos existentes: `SCORE_IMMUTABLE`, `BALLOT_INCOMPLETE`, confirmación por ítem (Spec 007) y cierre sin reapertura (Spec 006).
- Las pruebas existentes de planilla, pendientes e inmutabilidad siguen pasando.
- Pruebas de cliente verifican: nombre de ítem visible, separación de `No se presentó`, palabra-ancla, indicador de guardado ligado al resultado online y navegación por ítem.
- No se modifica el backend ni la BD (cero migraciones).
- El build de producción termina correctamente.
- La interfaz se revisa manualmente en 390x844, 768x1024 y 1440x900, con teclado y emulación táctil.
- La escala-ancla y la terminología quedan como configuración, no constantes globales (invariante de configuración dinámica de AGENTS.md).