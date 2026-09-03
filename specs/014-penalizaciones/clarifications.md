# Clarificaciones — Spec 014: Gestión de Penalizaciones

## Dudas y Decisiones Funcionales

| Tema | Pregunta / Situación | Decisión reglamentaria / Técnica |
|---|---|---|
| **Alcance de la deducción** | ¿Las penalizaciones descuentan puntos de rubros específicos (ej. Batería) o solo de la Comparsa general? | Descuentan exclusivamente del cómputo general de **Mejor Comparsa**. Los rubros individuales reflejan únicamente la evaluación artística de los jurados. |
| **Tipo de puntos** | ¿Los puntos de penalización pueden tener decimales? | Se definen como números enteros positivos (`INTEGER > 0`), alineado con la escala de puntos reglamentaria y la consistencia de base de datos. Si en el futuro se requiriese fracciones, se usará `NUMERIC`, pero por defecto son valores enteros. |
| **Ventana temporal de carga** | ¿Cuándo puede un comisario cargar penalizaciones? | Desde que la jornada competitiva es creada hasta el momento previo a la **liberación oficial de resultados** (`results_release`). No se exige que la noche esté abierta para registrar una infracción ya tipificada en el acta física de comisaría. |
| **Inmutabilidad y bloqueo** | ¿Qué sucede con las penalizaciones al liberar resultados? | Quedan bloqueadas tanto en la API como mediante trigger de PostgreSQL (`CHECK`/guard) impidiendo `INSERT`, `UPDATE` o `DELETE` sobre eventos cuyos resultados ya fueron liberados. |
| **Revocación vs Borrado** | ¿Se permite eliminar una penalización? | Prohibido el borrado físico (`DELETE`). Se implementa revocación lógica (`status = 'REVOKED'`) exigiendo motivo obligatorio y registrando evento de auditoría `TROUPE_PENALTY_REVOKED`. |
| **Roles con acceso** | ¿Quién puede acceder a la interfaz de comisariato? | Roles `COMISARIO` y `ADMIN`, ambos con 2FA verificado. Los jurados (`JUDGE`) y veedores (`VEEDOR`) no tienen acceso de escritura ni visualización antes de resultados. |
| **Empate tras penalizaciones** | ¿Qué ocurre si dos comparsas empatan en puntaje neto final? | Se aplica la misma secuencia de desempate de Spec 010 y 011: (1) mayor cantidad de rubros nominativos ganados, (2) Mejor Batería, (3) sorteo ceremonial. |
