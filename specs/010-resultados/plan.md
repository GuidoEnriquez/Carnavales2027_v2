# Plan — Spec 010: Resultados

> Reabierto el 2026-09-02 para cerrar la integridad de liberación. No amplía penalizaciones, actas ni Offline-First.

## Decisiones de diseño

- **Cálculo puro y determinístico:** la consolidación es una función pura sobre las puntuaciones confirmadas e inmutables (Specs 004/007). No escribe ni recalcula voto/planilla (cubre RF-89, RF-93).
- **Solo lectura de la etapa autorizada:** la exposición de resultados se controla por rol y una liberación transaccional. Antes de insertar `results_release`, la transacción bloquea el evento y rechaza jornadas competitivas con ventana abierta, planillas no `SUBMITTED` o scores `PENDING`. (RF-94, RF-94a).
- **Desempate desacoplado:** se implementa la secuencia reglamentaria solo para Mejor Comparsa, con el criterio 1 marcado `[NECESITA ACLARACIÓN]` (RF-95, RF-96).
- **Auditoría:** cada consolidación/ranking/resultado/desempate emite eventos de auditoría append-only (RF-97).

## Capas propuestas (sin prescribir ruta ni esquema)

1. **Servicio de consolidación** (RF-89, RF-90): agrega puntajes por rubro/comparsa sobre votos confirmados.
2. **Servicio de resultados generales** (RF-91, RF-92): Mejor Comparsa (nominativos) + ranking por rubro y general.
3. **Servicio de desempate** (RF-95, RF-96): secuencia reglamentaria; criterio 1 sujeto a aclaración.
4. **Exposición controlada** (RF-94): endpoints/lecturas según rol y estado de noche.
5. **Auditoría** (RF-97).
6. **Guardia de liberación** (RF-94a): consulta de precondiciones sin puntajes, prueba de integración y rechazo estable `RESULTS_NOT_READY`.

## Términos de aceptación

- Resultados reproducibles (misma entrada → misma salida).
- No muta voto/planilla.
- Sin exposición pre-escrutinio.
- Desempate solo Mejor Comparsa.
- Auditoría íntegra.

## Alternativas descartadas

- **Cache persistente de resultados:** se descarta en esta iteración; se prefiere calcular sobre los datos inmutables para garantizar determinismo, salvo que la validación sugiera lo contrario.
- **Firma/acta en esta spec:** se difiere a la spec de actas.
