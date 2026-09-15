# Clarificaciones — Spec 028

## Corrección del home aprobada el 2026-09-15

- "Evaluada" describe completitud de los ítems de la comparsa; `SUBMITTED`
  corresponde a la planilla del jurado por noche, compartida por sus comparsas.
- Se preservan API, inmutabilidad por ítem, cierre y bloqueo secuencial.
  La clasificación visual no cambia permisos ni persiste estados nuevos.
- Al completar todas las comparsas, el home conserva enlaces de consulta y
  muestra acceso de revisión por cada planilla completa aún no confirmada.
  La confirmación sigue ocurriendo en la pantalla de planilla y su modal.
- El ajuste sustituye el contador ambiguo "comparsas confirmadas" por
  "comparsas evaluadas" y corrige el falso anuncio de confirmación al 100%.
- La captura también evidencia compresión del progreso por el grid heredado.
  Se corrige únicamente `.judge-progress-card` en la hoja productiva `index.css`.
- Estos artefactos complementan la ratificación histórica de la spec; no
  atribuyen aprobación manual previa a esta corrección nueva.
