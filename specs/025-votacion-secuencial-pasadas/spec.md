# Spec 025 — Votación Secuencial por Orden de Pasada (Parade Flow Control)

## Estado

- **Fase SDD:** Especificación propuesta / Plan a implementar (pendiente de aprobación de desarrollo).
- **Fuente:** Solicitud directa de usuario (2026-09-08); Specs 003, 004, 007, 009, 013, 020 y 021.
- **Relación:** Complementa la Planilla de Jurado v3 (Spec 021) y el Control de Votación de Administración (Spec 003 y 020). Garantiza que los jurados no elijan arbitrariamente qué comparsa puntuar, sino que sigan rigurosamente el orden cronológico de salida a pista (`presentation_order`).

---

## Objetivo

Eliminar el riesgo de error humano en la mesa de jurados durante el desfile en vivo, asegurando que un jurado solo pueda calificar la comparsa que se encuentra desfilando en pista (según su orden de pasada oficial). Las comparsas posteriores permanecen bloqueadas hasta que:
1. El jurado concluya y confirme el 100% de los ítems de la comparsa actual (**Modo Progresión Autónoma del Jurado**), o
2. La Mesa de Control / Administrador active formalmente la comparsa en pista (**Modo Mesa de Control en Vivo**).

---

## Alcance

### Incluye:
1. **Regla de Secuencialidad Estricta en Jurados:**
   - Comparsa en orden 1 (`presentation_order = 1`): Habilitada de inmediato al abrirse la ventana de votación.
   - Comparsas en orden $N > 1$: Bloqueadas por defecto con indicador de candado (🔒) y estado "En espera de pasada".
   - Desbloqueo automático: La comparsa $N$ se desbloquea únicamente cuando la comparsa $N - 1$ alcanza el 100% de ítems resueltos (`resolved === total`, ya sea con puntaje o "No se presentó").
2. **Guardia de Protección en la Planilla (`JudgeBallotPage.jsx`):**
   - Bloqueo de acceso directo por URL (`#/judge/ballot?ballotId=...&troupeId=...`) si la comparsa solicitada aún no está habilitada.
   - Mensaje de guardia accesible con botón de redirección inmediata a la comparsa que actualmente le corresponde calificar.
3. **Flujo de Transición Continua (Continuity Prompt):**
   - Al emitir el último voto de la comparsa $N$, la interfaz presenta una notificación de felicitación y un botón de acción principal para avanzar a la comparsa $N + 1$.
4. **Validación de Integridad en Backend (`ballot-service.js`):**
   - Endpoint `POST /api/v1/judge/ballots/:id/scores/:scoreId`: valida que la comparsa del puntaje pertenezca a la comparsa actualmente autorizada según la secuencia de la noche para ese jurado.
5. **Opción de Habilitación Centralizada por Admin (Live Runway Control):**
   - Capacidad en `AdminVotingPage.jsx` para que la Mesa de Control pueda declarar en vivo cuál es la "Comparsa en pista", desbloqueando selectivamente a los jurados o forzando la sincronización en vivo.

### Excluye:
- Alterar el cálculo de notas, coeficientes, descartes olímpicos o empates (Specs 010 y 011).
- Modificar la estructura de penalizaciones o actas notariales (Specs 014 y 015).
- Permitir reabrir una comparsa previa ya confirmada (violación de inmutabilidad estricta de Spec 006 y 007).

---

## Requisitos Funcionales

- **RF-189 — Orden de Pasada Mandatorio:**
  La lista de comparsas asignadas al jurado DEBE ordenarse estrictamente por `presentation_order` ascendente (`night_troupe_schedule.presentation_order`). No se permite orden alfabético ni reordenamiento manual por parte del jurado.
- **RF-190 — Estado Bloqueado en Home de Jurado:**
  En `JudgeHomePage.jsx`, toda comparsa con `presentation_order > 1` cuya comparsa precedente no tenga todos sus ítems evaluados (`resolved < total`) DEBE renderizarse en estado visual y funcional `is-locked`:
  - Tarjeta con borde y superficie atenuada (`--surface-raised`, `--border-subtle`).
  - Badge de estado con ícono de candado: `🔒 En espera`.
  - Botón de acceso deshabilitado (`disabled`, `aria-disabled="true"`), impidiendo la interacción.
  - Mensaje explicativo: *"Se habilitará al completar la comparsa anterior"*.
- **RF-191 — Guardia de Navegación en Planilla de Votación:**
  En `JudgeBallotPage.jsx`, si el jurado accede mediante enlace directo a una comparsa cuyo orden de pasada aún no está habilitado, la página DEBE impedir la visualización de la grilla de puntuación y mostrar una pantalla de resguardo con:
  - Título: *"Comparsa en espera de pasada"*.
  - Descripción: *"Debes calificar y confirmar los rubros de [Nombre de Comparsa Activa] antes de acceder a esta planilla"*.
  - Botón de navegación directa: *"Ir a comparsa actual →"*.
- **RF-192 — Banner de Pase de Comparsa al Completar:**
  Al guardar el último ítem pendiente de la comparsa en curso, la planilla DEBE desplegar un banner o modal accesible de continuidad que confirme el cierre de la pasada actual y ofrezca el botón de navegación hacia la siguiente comparsa habilitada.
- **RF-193 — Validación de Regla en API (Backend Defense):**
  La API DEBE rechazar con error `HTTP 409 Conflict` (código `TROUPE_PRECEDENCE_REQUIRED`) cualquier intento de registrar un puntaje (`POST /api/v1/judge/ballots/:id/scores/:scoreId`) para una comparsa $N$ si existen ítems pendientes en comparsas con `presentation_order < N` para la misma planilla.
- **RF-194 — Modo de Mesa de Control en Vivo (Opcional por Noche):**
  En el panel administrativo de votación (`AdminVotingPage.jsx`), el Administrador DEBE poder visualizar qué comparsa está actualmente en pista y, si la política de la noche es `ADMIN_DISPATCHED`, emitir la orden de habilitación que active la comparsa correspondiente para todos los jurados en tiempo real.
