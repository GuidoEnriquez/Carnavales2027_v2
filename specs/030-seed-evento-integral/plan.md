# Plan — Spec 030

1. Migración 076 nullable de horarios sobre schedule y trigger de zona válida,
   pareja timestamp/zona y bloqueo de cambios temporales tras OPEN. Lectura
   en schedule-service y texto semántico de fecha/zona en lista Competencia.
2. Fixture puro centraliza evento/noches/comparsas/jurados/rotación/horarios,
   importa catálogo real existente y conserva su alcance de testing.
3. Extraer `seedFixtureUsers` parametrizado dentro del módulo de seeds de
   Spec029, preservando wrapper original y sus tests. Reutilizar altas reales,
   actor ADMIN determinado por entorno, ESCRIBANO ya existente y nuevo VEEDOR.
4. Orquestar con lock dedicado y transacción sobre esa conexión: preflight
   con FOR UPDATE de evento propio/estado antes de procesar identidades,
   transacción de evento/configuración/asignaciones/schedule/auditoría. En
   replay validar estructura antes de tocar usuarios; mantener el bloqueo
   del evento durante identidades para serializar con ediciones/apertura;
   no sobrescribir deriva.
   Identidades usan sus transacciones existentes; no fingir atomicidad global
   con Better Auth. Configuración se confirma completa o hace rollback.
5. CLI `seed:event:full` y resumen real con diferencias de modelo; README.
6. Test con BD nueva vía helper de Spec029: configuración vacía, replay,
   concurrencia, ajenos intactos, deriva, fechas, apertura/visibilidad/pendientes.
    Test frontend focal horario. Suite API/DB y cliente/build; revisión de código.

## T04 — Consolidar un único seed

1. Eliminar CLI anteriores y aliases npm; conservar seed-full-event.js y
   bootstrap de producción. Retirar fixtures Goya básico, eventos de demo,
   rubros con comparsas TEST y seed ADMIN independiente.
2. Renombrar catálogo/auxiliares a full-event.*; mover datos ESCRIBANO a la
   definición integral. Integrar la creación ADMIN con account-service y
   grantRole en el auxiliar de usuarios. Sin modificar Better Auth ni roles.
3. Migrar tests de login/OTP/recuperación al integral (12 cuentas), retirar
   tests de fixtures borrados y agregar prueba de único comando/CLI.
4. Simplificar README/.env.example y trazabilidad vigente; preservar specs
   históricas como evidencia de versiones anteriores.
5. Probar BD vacía y replay local, suites/build, sintaxis/imports y diff.
