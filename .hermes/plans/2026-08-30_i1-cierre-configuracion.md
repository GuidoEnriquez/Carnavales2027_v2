# Carnavales2027_v2 — I1-C: Cierre de configuración operativa

## Objetivo

Cerrar I1 con una superficie administrativa corregible, contratos de error estables, bloqueo completo tras `OPEN` y evidencia real actualizada, sin adelantar módulos competitivos.

## Cambios

1. Agregar criterios descriptivos por rubro mediante migración incremental.
2. Completar listados y actualizaciones con soft-disable para categorías, comparsas, rubros e ítems.
3. Extender las guardas de evento a criterios, nominaciones y programación.
4. Normalizar errores de API y conservar sus detalles en el cliente.
5. Exponer promoción y revocación auditada de ADMIN para usuarios existentes.
6. Cargar y editar la configuración existente desde el panel.
7. Mostrar ítems y especialidades derivadas por rubro.
8. Confirmar explícitamente la apertura y evitar dobles envíos.
9. Probar migraciones, servicios, API, UI y bloqueo posterior.

## Límites

No se crean rutas ni UI de nominaciones, programación operativa, alta/invitación de jurados, votación, offline/sync, penalizaciones, escrutinio, resultados, actas o reportes. La administración de `ADMIN` se limita a usuarios ya existentes.

## Validación

- API: `npm test` y `npm run db:test` con `TEST_DATABASE_URL` aislada.
- Persistencia: migraciones idempotentes y estado sin pendientes.
- Seeds: ADMIN y Goya reejecutables fuera de producción.
- Cliente: `npm test` y `npm run build`.
- Revisión: diff, rutas ausentes de módulos diferidos y matriz RF actualizada.
