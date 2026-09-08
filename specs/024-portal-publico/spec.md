# Spec 024 — Portal Público de Resultados

## Estado

- **Fase SDD:** Especificación aprobada para desarrollo (Fase 6 del Plan Maestro).
- **Fuente:** `PLAN-maestro.md` §3.4 y Fase 6; Specs 010, 011, 014, 015, 020 y 023.
- **Relación:** Materializa el módulo previamente diferido de publicación externa. Expone resultados oficiales y verificación criptográfica exclusivamente post-liberación mediante snapshots inmutables (`results_snapshot`), preservando aislamiento absoluto de las tablas transaccionales de votación (`ballot`, `ballot_score`), con soporte de caché HTTP (ETag, stale-while-revalidate), SSE público de notificación y vista ciudadana accesible bajo la Capa de Marca.

---

## Objetivo

Proveer a la ciudadanía, comparsas y medios de comunicación un portal web de alta disponibilidad, estático y cacheable para consultar los resultados oficiales de la competencia, ganador de Mejor Comparsa, rankings por rubro, desglose de penalizaciones netas y comprobación matemática del Acta Notarial Oficial mediante su sello criptográfico (JCS/SHA-256), protegiendo la infraestructura operativa contra picos de concurrencia y preservando el secreto absoluto del voto individual de los jurados.

---

## Alcance

### Incluye:
1. **Persistencia de Snapshots Inmutables (`results_snapshot`):**
   - Tabla versionada e inmutable `results_snapshot` (`event_id`, `version`, `snapshot_hash`, `payload JSONB`, `created_at`).
   - Trigger que impide `UPDATE` y `DELETE` sobre snapshots persistidos.
   - Materialización automática al ejecutar:
     - Liberación de resultados (`releaseResults`).
     - Registro de desempate ceremonial (`recordCeremonialDraw`).
     - Emisión y certificación de acta oficial (`certifyScrutinyRecord`).
2. **Endpoints Públicos de Alto Rendimiento (`/api/v1/public`):**
   - `GET /api/v1/public/events`: Lista eventos con resultados oficiales liberados.
   - `GET /api/v1/public/events/:eventId/results`: Retorna el payload del snapshot más reciente.
     - Cabeceras de caché: `ETag: "<snapshot_hash>"`, `Cache-Control: public, max-age=30, stale-while-revalidate=60`.
     - Soporte condicional HTTP 304 Not Modified ante `If-None-Match`.
     - Sin sesión, sin 2FA, sin `requireTrustedOrigin` (abierto a consumo web y móvil).
   - `GET /api/v1/public/stream`: Canal SSE público que emite notificaciones livianas (`event: results_updated`, payload `{ eventId, version }`) ante nuevas materializaciones.
3. **Garantía Inviolable de Secreto y Aislamiento:**
   - Cero consultas a `ballot_score` o `ballot` desde los endpoints públicos.
   - El payload del snapshot contiene únicamente: ganadores, totales agregados (bruto, penalizaciones, neto), puestos, acta oficial con hash, y metadatos del evento.
   - NUNCA contiene votos de jurados, notas discriminadas ni identidades de evaluadores.
4. **Página Pública Ciudadana (`PublicResultsPage.jsx`):**
   - Ruta pública accesible `#/resultados`.
   - Capa de Marca festiva (`data-layer="brand"`): hero "Resultados Oficiales — Carnavales Goya 2027", tarjeta de ganadora de Mejor Comparsa, tabla de ranking general con notas netas, ganadores de rubros y tarjeta notarial con verificación de hash del acta.
   - Conexión reactiva a SSE público con fallback a polling de 30s.

### Excluye:
- Consulta o visualización de resultados antes de la liberación oficial (`RESULTS_NOT_RELEASED`).
- Votación popular (descartada formalmente en Plan Maestro).
- Modificar el algoritmo de cómputo de resultados (Specs 010, 014, 015).

---

## Requisitos Funcionales

- **RF-210 — Tabla Inmutable `results_snapshot`:**
  El sistema almacenará cada versión del resultado público en una tabla inmutable `results_snapshot` con hash JCS/SHA-256 bit a bit, garantizando que el portal público lea exclusivamente datos pre-computados sin tocar tablas de votación.
- **RF-211 — Materialización Automática de Snapshots:**
  Tras la liberación de resultados, la resolución de un desempate o la certificación del acta oficial, el servicio de dominio materializará una nueva versión del snapshot con auditoría.
- **RF-212 — API Pública con ETag y HTTP 304:**
  `GET /api/v1/public/events/:eventId/results` servirá el snapshot más reciente con cabeceras `ETag` y `Cache-Control`, respondiendo HTTP 304 Not Modified cuando la cabecera `If-None-Match` coincida con el hash del snapshot.
- **RF-213 — Notificación Push SSE Pública:**
  `GET /api/v1/public/stream` proveerá un stream SSE abierto que notificará a los navegadores cuando un evento libere o actualice sus resultados oficiales, permitiendo refresco reactivo.
- **RF-214 — Secreto Absoluto de Voto en el Portal Público:**
  El payload del snapshot y la página pública bajo ninguna circunstancia expondrán puntajes emitidos por jurados individuales ni su desglose por planilla.
- **RF-215 — Verificación Pública del Hash del Acta:**
  La página pública exhibirá el número de acta oficial y su sello criptográfico SHA-256 canonicalizado, con indicador de integridad verificada.
- **RF-216 — Navegación y Accesibilidad Ciudadana:**
  `PublicResultsPage.jsx` será accesible en `#/resultados` sin requerir inicio de sesión, con contraste WCAG 2.2 AA, tabla semántica responsive y modo `prefers-reduced-motion`.

---

## Criterios de Aceptación

1. La migración `070_results_snapshot.sql` crea la tabla `results_snapshot` con triggers de inmutabilidad estricta (`NO UPDATE`, `NO DELETE`).
2. Al liberar resultados o certificar acta, se genera e inserta un snapshot con hash SHA-256 consistente.
3. `GET /api/v1/public/events/:eventId/results` responde 200 con ETag y 304 Not Modified ante `If-None-Match` coincidente; responde 404 si los resultados no han sido liberados.
4. Las pruebas automatizadas verifican que el snapshot y la API pública jamás incluyen campos de notas individuales (`score`, `scores`, `judgeName`, etc.).
5. `PublicResultsPage.jsx` es navegable públicamente en `#/resultados`, muestra el ranking general, la comparsa ganadora y el sello notarial.
6. 100% de tests unitarios, de base de datos y de cliente aprobados.
