# Clarificaciones — Spec 023: Capa de Marca y Home por Rol

## 1. ¿Cómo se determina si una pantalla pertenece a la Capa de Marca o a la de Instrumento?

**Criterio:**
- **Capa de Marca (`data-layer="brand"`):** Pantallas ceremoniales, públicas, de bienvenida o de celebración:
  - `LoginPage.jsx`: Bienvenida institucional e identidad de los carnavales.
  - `HomePage.jsx`: Hub general de inicio por rol.
  - `AdminResultsPage.jsx`: Presentación ceremonial de resultados oficiales.
  - `OfficialRecordPage.jsx`: Acta notarial oficial y sellada.
- **Capa de Instrumento (`data-layer="instrument"`):** Pantallas de trabajo técnico y operativo donde prima la concentración, la velocidad y la ausencia de distracciones:
  - `JudgeBallotPage.jsx`: Planilla del jurado.
  - `AdminCompetenciaPage.jsx`: Configuración de categorías, rubros y criterios.
  - `AdminVotingPage.jsx`: Apertura y cierre de votación.
  - `AdminPenaltiesPage.jsx`: Comisariato y penalizaciones.
  - `VeedorMonitorPage.jsx`: Supervisión en vivo y modo pared.

## 2. ¿Qué ocurre si un usuario tiene roles combinados (ej. ADMIN y VEEDOR)?

Si el array `session.roles` contiene más de un rol, la función `goToRoleHome` lo redirige siempre a `#/home`, donde `HomePage.jsx` le despliega el abanico de tarjetas disponibles para cada uno de sus roles, permitiéndole elegir cuál estación de trabajo desea operar. Si tiene un único rol, va directamente a la página principal de su especialidad para minimizar clics.

## 3. ¿Cómo se representan las condiciones previas de liberación en el stepper de escrutinio?

En `AdminResultsPage.jsx`, cuando la votación no está lista para liberar (`releaseAvailable === false`), se presenta un panel informativo que detalla las guardas reglamentarias (RF-94a):
- Todas las jornadas competitivas deben estar cerradas.
- No deben quedar planillas en estado `OPEN` o borradores pendientes.
- Todos los ítems deben haber sido calificados o declarados como no presentados.
- La liberación es potestad exclusiva de `SCRUTINEER` y `ESCRIBANO` con 2FA.

## 4. ¿Qué impacto tiene `prefers-reduced-motion` en las animaciones de marca?

Si el sistema operativo del usuario tiene activada la reducción de movimiento:
- Los halos de órbita decorativos (`.login-orbit`) no rotan ni se desplazan.
- Las transiciones de apertura de modales y barras de progreso son instantáneas.
- Ningún elemento gráfico realiza animaciones continuas.

## 5. Divergencia del working tree sobre el hub por rol (2026-09-10)

**[NECESITA ACLARACIÓN]** La implementación actual del working tree elimina `client/src/pages/HomePage.jsx` y la ruta `#/home`; ADMIN y los roles auxiliares aterrizan directamente en sus estaciones operativas (`#/admin/home`, `#/admin/penalties`, `#/admin/results`, etc.).

Esto contradice el alcance histórico de RF-202/RF-203, que define `HomePage.jsx` como hub para múltiples roles y usuarios sin rol. Los cambios mantienen pruebas cliente y build verdes, pero no deben considerarse una modificación aprobada de Spec 023 hasta que producto confirme si el hub por rol se retira o se reemplaza por el panel ADMIN y rutas directas.
