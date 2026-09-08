# Plan de Implementación — Spec 025: Votación Secuencial por Orden de Pasada

## Estrategia de Ejecución en Unidades Atómicas

El desarrollo se organiza en 4 fases secuenciales respetando la constitución de `AGENTS.md`:

---

### Fase 1: Motor de Secuencialidad y Estado en `JudgeHomePage.jsx` (Frontend Base)

1. Enriquecer el cálculo de estado de comparsas en `JudgeHomePage.jsx`:
   - Ordenar comparsas estrictamente por `presentationOrder`.
   - Iterar secuencialmente: la comparsa $N$ solo está habilitada si todas las comparsas precedentes ($1 \dots N-1$) tienen `resolved === total`.
   - Si una comparsa no está habilitada, asignarle estado `is-locked` con metadata `lockedReason: "Esperando finalización de comparsa anterior"`.
2. Actualizar el renderizado visual de la tarjeta (`.judge-ballot-card`):
   - Iconografía de candado 🔒 y pill de estado neutral/bloqueado.
   - Reemplazar botón de enlace por elemento deshabilitado con `aria-disabled="true"`.
3. Pruebas automatizadas en `JudgeHomePage.test.jsx`:
   - Comparsa 1: activa / botón habilitado.
   - Comparsa 2: bloqueada si comparsa 1 tiene pendientes.
   - Comparsa 2: se desbloquea cuando comparsa 1 alcanza `resolved === total`.

---

### Fase 2: Guardia de Resguardo y Continuidad en `JudgeBallotPage.jsx`

1. Incorporar guardia de acceso en `JudgeBallotPage.jsx`:
   - Al recibir `troupeId`, comprobar si dicha comparsa está habilitada para votación.
   - Si el jurado entra por URL a una comparsa futura bloqueada, renderizar vista de advertencia: *"Comparsa en espera de pasada — Debes calificar primero a [Comparsa Actual]"* con botón *"Ir a comparsa actual"*.
2. Implementar diálogo/banner de continuidad de pasada:
   - Al confirmar el último ítem de una comparsa, mostrar banner accesible: *"¡Completaste la evaluación de [Comparsa]! Siguiente comparsa en pista: [Siguiente Comparsa]"* con botón directo *"Comenzar siguiente pasada →"*.
3. Pruebas automatizadas en `JudgeBallotPage.test.jsx`:
   - Verificación de rechazo de acceso directo a comparsas bloqueadas.
   - Verificación de aparición del banner de continuidad al completar todos los rubros.

---

### Fase 3: Validación Defensiva en Backend (`ballot-service.js`)

1. En `saveScoreLocked` de `api/src/modules/ballots/ballot-service.js`:
   - Validar que no existan registros con `evaluation_state = 'PENDING'` en comparsas con `presentation_order` menor al de la comparsa del score actual en la misma planilla.
   - Devolver excepción `TROUPE_PRECEDENCE_REQUIRED` si se intenta saltar la secuencia.
2. Pruebas en `api/src/tests/ballots.test.js` o prueba de integración dedicada.

---

### Fase 4: Habilitación en Vivo por Mesa de Control / Admin (Extensión Opcional)

1. En `AdminVotingPage.jsx`:
   - Agregar selector o botón "Comparsa activa en pista" para que la mesa de control marque formalmente el desfile en curso.
2. Sincronización en tiempo real vía eventos SSE (Spec 022) o polling de estado de noche.
