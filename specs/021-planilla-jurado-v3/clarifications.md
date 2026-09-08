# Clarificaciones — Spec 021

## Preguntas y Decisiones de Arquitectura

### 1. ¿Por qué doble tap in situ en vez de una ventana de deshacer de 5 segundos con toast?
**Decisión:**
La ventana de deshacer de 5 segundos requeriría que el servidor permita modificar una puntuación durante esos 5 segundos, lo cual viola la Constitución actual y el contrato de inmutabilidad estricta por ítem de Spec 007 ("cada guardado es inmutable"). Cambiar las reglas de inmutabilidad del servidor requiere una definición reglamentaria formal sobre corrección de voto.
El doble tap in situ:
1. Resuelve al 100% el problema de mis-tap (un toque accidental no guarda, solo pre-selecciona; se requiere un segundo toque deliberado en el mismo lugar exacto).
2. Elimina la molestia de abrir y cerrar un diálogo modal emergente para cada uno de los 10 dígitos.
3. No requiere modificar el backend ni el contrato de inmutabilidad estricta de Spec 007.

### 2. ¿Cómo interactúa el parámetro `include=progress` con las consultas de `ballot`?
**Decisión:**
En `judge-service.js` (o módulo correspondiente que sirve `GET /api/v1/judge/ballots`), cuando `include === "progress"`, se ejecutará una consulta agregada con `COUNT(*)` y `COUNT(*) FILTER (WHERE evaluation_state != 'PENDING')` agrupada por `ballot_id`. Esto inyecta `totalScores` y `resolvedScores` directamente en el array de planillas devuelto al jurado, reduciendo las llamadas HTTP de N+1 a 1 sola.

### 3. ¿Cómo se valida el formato de `brand_color` en PostgreSQL?
**Decisión:**
En la tabla `event_troupe`:
```sql
ALTER TABLE event_troupe
  ADD COLUMN brand_color VARCHAR(32),
  ADD CONSTRAINT event_troupe_brand_color_format
    CHECK (brand_color IS NULL OR brand_color ~ '^#[0-9A-Fa-f]{6}$');
```
Si es NULL, el frontend usará un color por defecto de la paleta semántica.

### 4. ¿Cómo funciona la alternancia entre "Tarjeta enfocada" y "Lista completa"?
**Decisión:**
Se proveerá un botón en la cabecera de la planilla (ej. "Modo Lista" / "Modo Tarjeta"). En móvil, el modo inicial será "Tarjeta", optimizado para pantallas pequeñas. En desktop y tablet, el modo predeterminado muestra la lista y la tarjeta en paralelo.
