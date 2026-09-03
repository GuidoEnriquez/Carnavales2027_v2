# Plan — Spec 014: Gestión de Penalizaciones

1. **Persistencia y modelo de datos:**
   - Crear migración incremental `062_troupe_penalties.sql` con la tabla `troupe_penalty`, claves foráneas, restricciones de puntos positivos, estado (`APPLIED`, `REVOKED`) y guard de base de datos que bloquee mutaciones tras la liberación de resultados (`results_release`).
   - Guardar auditoría append-only en `audit_event` para alta y revocación.

2. **Servicios y contratos de API:**
   - Implementar `penalty-service.js` para crear, listar y revocar penalizaciones de forma transaccional.
   - Exponer endpoints bajo `/api/v1/events/:eventId/penalties`:
     - `GET`: lista de penalizaciones del evento.
     - `POST`: alta de penalización con motivo y puntos.
     - `POST /:penaltyId/revoke`: revocación con motivo obligatorio.
   - Aplicar middleware de autorización estricta: solo `COMISARIO` o `ADMIN` con sesión 2FA activa.

3. **Integración con el motor de resultados:**
   - Actualizar `results-service.js` para cargar penalizaciones aplicadas por comparsa al consolidar resultados.
   - Ajustar `computeOverallRanking` para calcular `grossScore`, `penaltyPoints` y `totalScore = max(0, grossScore - penaltyPoints)`.
   - Exponer el desglose en el payload de resultados autorizados (`/api/v1/events/:eventId/results`).

4. **Interfaz de usuario:**
   - Crear ruta y página de gestión de comisariato (`ComisarioPenaltiesPage` / `AdminPenaltiesPage`) accesible para `COMISARIO` y `ADMIN`.
   - Permitir seleccionar noche competitiva, comparsa, tipificar motivo y definir puntos a descontar.
   - Modal de confirmación para revocación con motivo.
   - Actualizar la tabla de Mejor Comparsa en `AdminResultsPage` para mostrar columnas de puntaje bruto, descuento por penalizaciones y puntaje neto final.

5. **Pruebas y validación:**
   - Tests de base de datos (`troupe_penalty`, inmutabilidad post-liberación, unicidad de contexto).
   - Tests de API (permisos con y sin 2FA, rechazo a jurados/veedores, ciclo de vida de penalizaciones, impacto exacto en ranking).
   - Tests unitarios y de integración en cliente React.
   - Comprobación manual en 390×844, 768×1024 y 1440×900 con teclado y emulación táctil.
