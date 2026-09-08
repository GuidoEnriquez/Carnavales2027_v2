# Clarificaciones — Spec 025: Votación Secuencial por Orden de Pasada

### 1. Definición de "Comparsa Terminada" (2026-09-08)

Para que una comparsa $N$ se considere completamente evaluada y permita desbloquear la comparsa $N + 1$, el 100% de sus ítems asignados para ese jurado deben estar en estado resuelto:
- `evaluation_state IN ('SCORED', 'NOT_PRESENTED')`.
- Si la comparsa tiene 12 ítems puntuables, `resolvedScores` debe ser exactamente 12.
- Mientras exista al menos un ítem en estado `PENDING`, la comparsa $N + 1$ permanece bloqueada.

### 2. Tratamiento de "No se presentó" en la Secuencia (2026-09-08)

Conforme a Spec 004 y Spec 021, si una comparsa no desfila o un jurado declara "No se presentó" en todos sus ítems:
- La decisión `NOT_PRESENTED` computa puntaje 0 y cuenta formalmente como ítem resuelto.
- Una vez marcados todos los ítems como `NOT_PRESENTED`, la comparsa se considera terminada y se desbloquea la comparsa $N + 1$.

### 3. Modos de Operación: Autónomo vs. Administrado en Vivo (2026-09-08)

Se contemplan dos modalidades para la noche:
1. **Modo Autónomo (Default recomendado):** La UI del jurado desbloquea automáticamente la comparsa $N + 1$ en cuanto el jurado termina la comparsa $N$. Esto otorga autonomía al jurado en caso de desfase de conexión o ritmo personal de puntuación, garantizando siempre que no pueda votar comparsas futuras sin haber cerrado la anterior.
2. **Modo Administrado (Mesa de Control en Vivo):** La mesa de control define en tiempo real qué comparsa está en pista (`active_troupe_id`). Los jurados solo pueden votar la comparsa que el admin haya activado.

### 4. Resguardo ante URLs directas y Bookmarks (2026-09-08)

El router de la aplicación es hash-based (`#/judge/ballot?ballotId=...&troupeId=...`). Si un jurado intenta alterar el parámetro `troupeId` o ingresar por un enlace guardado:
- `JudgeBallotPage.jsx` evalúa la secuencia de comparsas de la planilla.
- Si la comparsa solicitada no es la primera comparsa con pendientes ni una comparsa ya completada (modo solo lectura), se bloquea la carga de la grilla de evaluación y se presenta la pantalla de guardia con redirección obligatoria.

### 5. Invariantes de Seguridad y Negocio (2026-09-08)

- **Inmutabilidad:** Las comparsas anteriores ($1 \dots N-1$) ya evaluadas permanecen en modo solo lectura (`status: SUBMITTED` o puntajes bloqueados con candado).
- **Consistencia API:** El backend verifica que el `night_schedule_id` del puntaje pertenezca a una comparsa habilitada para ese jurado.
