# Plan - Cierre de votacion sin reapertura

> Implementado el 2026-08-31. La comprobacion manual con teclado, lista extensa y viewports permanece registrada en `specs/006-cierre-sin-reapertura/validation.md`.

## Objetivo

Eliminar las nuevas reaperturas y hacer visible, en el intento de cierre, cada voto pendiente que impide cerrar la noche.

## Diseno

1. Agregar una migracion incremental que reemplace el guard de `ballot`: permitir `OPEN -> SUBMITTED` y solo el cierre de una planilla historica ya `REOPENED`, pero rechazar `SUBMITTED -> REOPENED`.
2. Retirar `reopenBallot` y su ruta HTTP para que no haya una via de aplicacion para reabrir.
3. Actualizar pruebas DB y API para probar el bloqueo y la ausencia de la ruta.
4. Retirar el formulario de reapertura de `AdminVotingPage`.
5. Convertir el error de cierre incompleto en un `dialog` accesible que lista jurado, comparsa, rubro e item, reutilizando las reglas ya aplicadas al dialogo de pendientes del jurado.
6. Validar suites, build, migraciones y los viewports operativos.

## Limites

- No convertir pendientes en ausencias ni puntajes.
- No agregar resultados, escrutinio, penalizaciones ni actas.
- No alterar auditoria ni datos historicos.
