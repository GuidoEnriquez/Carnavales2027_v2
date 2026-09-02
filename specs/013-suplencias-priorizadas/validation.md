# Validacion - Spec 013

## Estado

Implementacion y validacion automatica completadas el 2026-09-02. La comprobacion manual de Asignaciones fue aprobada por producto para movil, tablet, desktop, teclado y tactil.

## Evidencia requerida

- Migraciones `059_prioritized_substitutes.sql`, `060_preserve_ballot_reopen_error.sql` y `061_allow_standby_history.sql`: aplicadas localmente y repetibles en la suite.
- `npm.cmd test` en `api/`: 80 passed, 0 failed. Incluye `prioritized-substitutes.test.js`: reserva sin planilla, activacion ante incompletitud, preservacion `REPLACED`, cierre y rechazo tras `SUBMITTED`.
- `npm.cmd run db:test` en `api/`: 38 passed, 0 failed.
- `npm.cmd test` en `client/`: 68 passed, 0 failed. Incluye activacion del suplente con motivo en `AdminAssignmentsPage`.
- `npm.cmd run build` en `client/`: exitoso.
- La prueba de suplencias confirma que el cierre y `releaseResults` ignoran la planilla `REPLACED`, sin alterar sus scores historicos.
- No hay scripts `lint` ni `typecheck` definidos en `api/package.json` ni `client/package.json`.
- Validacion manual aprobada por producto: panel de Asignaciones en movil, tablet y desktop, con teclado y tactil.
