# Spec 021 — Planilla del Jurado v3

## Estado

- **Fase SDD:** Especificación aprobada para desarrollo (Fase 3 del Plan Maestro).
- **Fuente:** `PLAN-maestro.md` §2.2 y Fase 3; Specs 004, 006, 007, 009, 012 y 020 (reemplaza y absorbe la propuesta preliminar de Spec 018).
- **Relación:** Evoluciona la interfaz de puntuación del jurado sobre la base de tokens y componentes de Spec 020. Mantiene intactas las reglas de negocio e inmutabilidad estricta (Specs 004, 006 y 007), la operación 100% online (Spec 012) y la idempotencia en persistencia (Spec 019).

---

## Objetivo

Eliminar la sobrecarga cognitiva en el momento de decisión del jurado en campo móvil (390×844), reduciendo las 11 opciones simultáneas a una sola decisión contextualizada por pantalla (flujo tarjeta a tarjeta), implementando confirmación por modal para puntajes 1–10 (Spec 007 RF-77), separando visualmente "No se presentó", gestionando guardado granular por fila con reintento sin bloquear la planilla, e incorporando color de comparsa como ayuda visual inmediata.

---

## Alcance

### Incluye:
1. **Persistencia y modelo de datos (Backend):**
   - Migración `069_troupe_brand_color.sql`: añadir columna `brand_color` (formato `#RRGGBB` o nulo) a `event_troupe`. Editable únicamente mientras el evento permanezca en `CONFIGURING`.
   - Endpoint optimizado: soportar parámetro de consulta `GET /api/v1/judge/ballots?include=progress` para devolver conteos agregados de progreso (`totalScores`, `resolvedScores`) por planilla, eliminando el problema de consultas N+1 en `JudgeHomePage`.
2. **Arquitectura visual e interacción táctil (Frontend):**
   - **Flujo móvil "tarjeta a tarjeta":** presentación enfocada en un único ítem puntuable a la vez, con cabecera fija mostrando Comparsa, Rubro e Ítem, y botón para alternar a la vista completa tradicional.
   - **Grilla 1–10 con solo números:** botones de 2×5 con altura ≥ 56px, mostrando únicamente el número (sin palabra-ancla).
   - **Confirmación por modal (Spec 007 RF-77):** al presionar un dígito 1–10 se abre un `<Dialog>` de confirmación con el ítem y el puntaje seleccionado; confirmar dispara la persistencia inmutable hacia el backend.
   - **Acción "No se presentó" separada:** región propia bajo la grilla, con advertencia explícita y confirmación modal dedicada (preserva Spec 004 y 007).
   - **Guardado granular por fila:** cada ítem maneja su ciclo de vida (`idle`, `saving`, `saved`, `error`). Si falla la red, solo ese ítem muestra estado de error y botón "Reintentar"; ningún otro ítem se congela.
   - **Barra inferior fija de navegación:** control fijo con progreso "X / Y", botones `← Anterior` y `Siguiente →`, y botón "Faltantes" que despliega un diálogo accesible con los ítems pendientes y salto directo.
   - **Adaptabilidad por viewport:**
     - Móvil (390×844): tarjeta a tarjeta con barra fija.
     - Tablet (768×1024): dos columnas (lista a la izquierda, tarjeta de decisión a la derecha).
     - Desktop (1440×900): tres columnas (sidebar comparsas con `brand_color`, lista de ítems, panel de decisión, atajos 1-0 y Enter).

### Excluye:
- Modificar el cálculo de resultados, penalizaciones o actas notariales.
- Reversión o corrección de votos confirmados post-inmutabilidad (requiere definición reglamentaria formal en Spec 025).
- Persistencia local duradera offline (módulo diferido).

---

## Requisitos Funcionales

- **RF-182 — Color de identidad por comparsa (`event_troupe.brand_color`):**
  La base de datos DEBE almacenar una columna opcional `brand_color VARCHAR(32)` en `event_troupe`, restringida a formato hexadecimal (`^#[0-9A-Fa-f]{6}$`). Su modificación DEBE estar bloqueada si el evento no está en `CONFIGURING`. La UI de la planilla DEBE renderizar esta banda de color en las tarjetas de comparsa y en la barra lateral como ayuda de reconocimiento visual inmediato.
- **RF-183 — Endpoint optimizado de planillas de jurado con progreso:**
  El endpoint `GET /api/v1/judge/ballots` DEBE admitir `include=progress`, retornando para cada planilla `totalScores` (número total de ítems puntuables) y `resolvedScores` (número de ítems en estado `SCORED` o `NOT_PRESENTED`). `JudgeHomePage` DEBE utilizar estos campos para renderizar el progreso real sin realizar peticiones individuales por planilla.
- **RF-184 — Flujo móvil tarjeta a tarjeta y vista alternativa:**
  En pantallas móviles (ancho < 768px), la planilla DEBE presentar por defecto una vista de tarjeta enfocada en un único ítem de evaluación. La tarjeta DEBE mostrar en todo momento la comparsa actual, el rubro y el nombre del ítem. La interfaz DEBE permitir al jurado alternar entre el modo "Tarjeta enfocada" y el modo "Lista completa".
- **RF-185 — Grilla 1–10 y confirmación por modal (doble tap derogado; alineado con Spec 007 RF-77):**
  La escala 1–10 DEBE implementarse como una grilla de 2×5 con controles táctiles de al menos 56px de alto, mostrando únicamente el número (sin palabra-ancla). Al tocar un puntaje, DEBE abrirse un modal de confirmación que indique el ítem y el puntaje seleccionado. Confirmar DEBE emitir la mutación inmutable al servidor; cancelar no guarda. (Nota 2026-09-11: la confirmación in situ de doble tap original quedó derogada por la confirmación modal exigida por Spec 007 RF-77.)
- **RF-186 — Región segregada y advertencia para "No se presentó":**
  La acción `No se presentó` DEBE ubicarse en una sección visualmente diferenciada y separada de la grilla numérica, con fondo y borde de advertencia (`--warning-bg`, `--warning-border`). Su confirmación DEBE exigir la confirmación explícita en un modal `<Dialog>` accesible que informe que el puntaje computado será 0 (cero).
- **RF-187 — Estado de persistencia granular por ítem:**
  Cada fila o ítem de evaluación DEBE mantener su propio estado de red (`idle`, `saving`, `saved`, `error`). Ante fallos de conexión en un guardado, la interfaz DEBE mostrar un mensaje de error y un botón "Reintentar" únicamente en el ítem afectado, sin inhabilitar ni bloquear la interacción del jurado con los demás ítems de la planilla.
- **RF-188 — Barra de navegación fija y acceso a faltantes:**
  La planilla en modo móvil DEBE fijar una barra inferior persistente que contenga:
  1. Contador de avance (ej. "Ítem 4 de 12").
  2. Botones accesibles `← Anterior` y `Siguiente →`.
  3. Botón "Faltantes" que abra un diálogo accesible (`<Dialog>`) listando los ítems pendientes con salto directo al ítem seleccionado.
- **RF-189 — Diseño responsivo y accesibilidad en tablet y desktop:**
  La planilla DEBE adaptarse según el viewport:
  - En tablet (768×1024): división en dos columnas (lista de ítems y panel de decisión activo).
  - En desktop (≥1100px): panel lateral de comparsas con banda de color, lista central de rubros e ítems, y panel de decisión con atajos de teclado numérico (1–9, 0 para 10, y tecla Enter para confirmar).

---

## Criterios de Aceptación

1. Migración 069 aplicada sin errores y verificada en suite `migrate.test.js`.
2. Endpoint `GET /api/v1/judge/ballots?include=progress` probado y libre de regresiones.
3. El jurado puede navegar ítem por ítem en móvil (390×844) con comparsa, rubro e ítem siempre visibles.
4. Tocar un puntaje 1–10 abre un modal de confirmación (Spec 007 RF-77); confirmar guarda inmutablemente en el servidor.
5. "No se presentó" está segregado bajo la grilla y abre modal de confirmación antes de guardar.
6. Un fallo de red en un ítem muestra "Reintentar" localizado sin bloquear los demás ítems ni congelar la pantalla.
7. La barra inferior muestra progreso y el modal de faltantes permite saltar directamente al ítem pendiente.
8. En desktop (1440×900), los números 1-0 abren el modal de confirmación mediante teclado.
9. 100% de tests unitarios y de integración de cliente y API aprobados.
