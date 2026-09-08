# Clarificaciones — Spec 018

> Registro de decisiones de producto, dudas resueltas y supuestos asumidos durante la preparación de los artefactos SDD. Cualquier punto marcado `[NECESITA ACLARACIÓN]` requiere confirmación del responsable de producto antes de la implementación.

## Decisiones de producto registradas

### 1. Escala-ancla verbal (RF-162)

**Pregunta:** ¿Cuáles son las palabras exactas para cada valor de 1 a 10?

**Supuesto registrado:** El brief de producto (`client/AGENTS.md`, §7) muestra el ejemplo `8 · MUY BUENO`. Se infiere un mapeo tipo:

| Valor | Palabra |
|---|---|
| 1 | Muy malo |
| 2 | Malo |
| 3 | Regular |
| 4 | Aceptable |
| 5 | Correcto |
| 6 | Muy correcto |
| 7 | Bueno |
| 8 | Muy bueno |
| 9 | Excelente |
| 10 | Excelente |

**Pendiente:** Confirmar si este mapeo es el definitivo o si corresponde a la escala reglamentaria del carnaval. **[NECESITA ACLARACIÓN]**

### 2. Separación de "No se presentó" (RF-161)

**Pregunta:** ¿Cuál es la distancia visual mínima deseada entre la grilla de 1–10 y la acción `No se presentó`?

**Supuesto registrado:** `No se presentó` se renderiza en una región visual separada con al menos 1 row de separación (gap explícito), fondo propio y label/ícono de advertencia. No se oculta detrás de un menú o acordeón; sigue visible sin scroll adicional. Esto cumple con RF-84 de Spec 009 y con el brief §8.

### 3. Navegación lateral de comparsas en escritorio (RF-164)

**Pregunta:** ¿La sidebar se muestra solo en viewports ≥70rem o también en tablet landscape?

**Supuesto registrado:** La sidebar se muestra en desktop ≥70rem (≥1120px) y se oculta en mobile y tablet. En tablet (768x1024) se usa navegación por ítems sin sidebar, consistente con Spec 009 §17. **[NECESITA ACLARACIÓN]** sobre el breakpoint exacto.

### 4. Indicador de guardado (RF-163)

**Pregunta:** ¿Qué comportamiento exacto tiene el indicador de guardado transitorio?

**Supuesto registrado:** El indicador muestra:
- Estado inicial: sin indicador (no se afirma nada antes de la primera acción).
- Tras confirmar un ítem: "✓ Guardado" transitorio (2–3 segundos), luego desaparece.
- Error de red: "Error de guardado — reintentá" persistente hasta el próximo intento.
- No hay punto verde fijo permanente.

Esto es consistente con Spec 012 (sin persistencia local) y con RF-108.

### 5. Mapeo de dígitos vs. palabra-ancla

**Pregunta:** ¿La palabra-ancla se muestra como `8 · MUY BUENO` o como `MUY BUENO` solo?

**Supuesto registrado:** Se muestra `8 · MUY BUENO` (dígito + separador + palabra) tanto en la grilla, como en la chip bloqueada y el modal. El brief §7 usa este formato.

### 6. Alcance de la revisión por ítem

**Pregunta:** ¿Se muestran todos los ítems de una comparsa a la vez o se usa visor de un ítem a la vez (stepper)?

**Supuesto registrado:** La planilla mantiene la vista de lista completa (todos los ítems visibles) para que el jurado pueda saltar libremente. La navegación `← Anterior` / `Siguiente →` es un complemento de scroll, no un reemplazo de vista. Esto preserva RF-83 de Spec 009 (comparsa, especialidad, progreso siempre visibles).

## Supuestos y restricciones confirmadas

1. **Cero migraciones.** No se modifica el backend ni la BD. Todos los cambios son de presentación (`client/`).
2. **Spec 007 se mantiene intacta.** El modal de confirmación por ítem y la inmutabilidad post-confirmación no cambian. Solo se refinan los elementos visuales del modal (añadir palabra-ancla).
3. **Spec 012 se mantiene.** El indicador de guardado refleja persistencia online, no local. No se reactiva Offline-First.
4. **Spec 006 se mantiene.** No se permite reapertura de planillas.
5. **brief §17 es la referencia** para la sidebar de escritorio.
6. **Sin控件 nuevos de edición.** La navegación por ítems no implica capacidad de modificar decisiones ya confirmadas.