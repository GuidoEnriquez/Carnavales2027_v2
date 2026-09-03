# Spec 015 — Actas Oficiales y Certificación de Escrutinio

## Estado

- **Fase SDD:** especificación y plan aprobados (2026-09-03).
- **Fuentes normativas:** Reglamento Goya 2027; Confluence C2 «Escrutinio Definitivo y Actas Notariales»; Spec 001; Spec 008 (roles `SCRUTINEER` y `ESCRIBANO`); Spec 010 (consolidación y liberación de resultados); Spec 011 (sorteo ceremonial); Spec 014 (penalizaciones y segregación de funciones).
- **Dependencias:** autenticación 2FA (Spec 008); liberación previa de resultados (Spec 010/014); cálculo de penalizaciones (Spec 014).

## Objetivo

Proveer el módulo formal de **Certificación de Escrutinio y Emisión de Actas Oficiales**, permitiendo a las autoridades de fe pública (`ESCRIBANO` y `SCRUTINEER`) generar, firmar digitalmente mediante hash criptográfico (JCS/SHA-256) y registrar de forma inmutable el Acta Oficial de Cierre del Carnaval, con formato imprimible notarial, detalle integral de ganadores por rubro, ranking general de Mejor Comparsa con desglose de penalizaciones, y trazabilidad completa de desempates.

## Alcance

### Incluye:
- Modelo persistente para actas oficiales (`official_scrutiny_record`), asociado unívocamente a un evento de carnaval.
- Precondición estricta: los resultados deben estar previamente liberados (`results_release`) y cualquier empate en Mejor Comparsa debe estar resuelto reglamentariamente (incluyendo sorteo ceremonial si aplicó).
- Segregación estricta de funciones: la emisión y certificación del acta corresponde **exclusivamente a `ESCRIBANO` y `SCRUTINEER`** con sesión 2FA activa. El rol `ADMIN` solo tiene acceso de consulta e impresión, impidiéndole emitir o certificar el acta (`OFFICIAL_RECORD_EMISSION_FORBIDDEN_FOR_ADMIN`).
- Estructura canónica del Acta Oficial:
  - Metadatos: evento, lugar, fecha y hora de cierre oficial, número correlativo de acta.
  - Autoridades intervinientes: escribano / escrutadores actuantes, administración organizadora.
  - Nómina de jurados que completaron planillas y noches evaluadas.
  - Nómina de comparsas y categorías participantes.
  - Ganadores definitivos por cada rubro artístico con puntajes brutos consolidados.
  - Ranking general definitivo de Mejor Comparsa con triple columna (Puntaje bruto acumulado, Total de penalizaciones deducidas y Puntaje final neto).
  - Constatación de desempates aplicados (Criterio 1: rubros ganados; Criterio 2: Mejor Batería; Criterio 3: sorteo ceremonial con registro de su nonce y hash JCS).
- Sello de integridad criptográfica: cálculo de hash SHA-256 normalizado mediante RFC 8785 (JSON Canonicalization Scheme - JCS) sobre el contenido del acta, persistido de forma inmutable.
- Inmutabilidad estricta: la base de datos prohíbe modificaciones (`UPDATE`) y borrados físicos (`DELETE`) sobre el acta emitida mediante triggers de protección.
- Vista web de Acta Notarial con estilos optimizados de impresión (`@media print`), foliado, encabezados formales y áreas para firmas hológrafas de delegados de comparsas y autoridades.
- Endpoint de verificación pública / auditoría de autenticidad del acta contra su hash criptográfico.

### Excluye:
- Firma digital criptográfica PKI X.509 con tokens de hardware externos (se implementa el hash criptográfico canonicalizado estándar del sistema compatible con firma notarial posterior).
- Publicación externa en portal de noticias abierto (queda para módulo de difusión).

## Requisitos Funcionales

- **RF-121 (Precondición de emisión de acta).** EL SISTEMA SOLO DEBE permitir emitir el Acta Oficial si el evento cuenta con resultados previamente liberados (`results_release`) y si el ranking general de Mejor Comparsa está resuelto sin empates pendientes de sorteo ceremonial (409 `RESULTS_NOT_RELEASED` o `TIE_BREAKER_PENDING`).
- **RF-122 (Segregación de roles para certificación).** Solo usuarios con rol `ESCRIBANO` o `SCRUTINEER` con sesión 2FA verificada PUEDEN emitir y certificar el Acta Oficial. Todo intento de emisión por parte de un usuario con rol `ADMIN` DEBE ser rechazado con código 403 `OFFICIAL_RECORD_EMISSION_FORBIDDEN_FOR_ADMIN`.
- **RF-123 (Contenido canónico del acta).** El acta oficial DEBE consolidar en una sola estructura inmutable:
  1. Identificación del evento, fecha/hora y número oficial de acta.
  2. Nómina de autoridades de escrutinio certificantes (`actorUserId`, nombre y rol).
  3. Lista de jurados que confirmaron planillas en el evento.
  4. Resultados por rubro individual (código de rubro, nombre de rubro, comparsa ganadora y puntaje consolidado).
  5. Ranking general de Mejor Comparsa con posición, comparsa, puntaje bruto, penalizaciones reglamentarias aplicadas y puntaje final neto.
  6. Memoria técnica de desempates aplicados (criterios 1, 2 o 3 con auditoría de sorteo ceremonial).
- **RF-124 (Sello de integridad JCS/SHA-256).** Al certificar el acta, EL SISTEMA DEBE canonicalizar el contenido JSON (RFC 8785) y generar su hash SHA-256 (`record_hash`). Cualquier alteración de un solo carácter invalidará la verificación criptográfica.
- **RF-125 (Persistencia inmutable).** El acta certificada DEBE persistir en la tabla `official_scrutiny_record`. Triggers en la base de datos DEBEN bloquear físicamente cualquier operación `UPDATE` o `DELETE` (`OFFICIAL_RECORD_IMMUTABLE`).
- **RF-126 (Idempotencia y unicidad).** Solo PUEDE existir un Acta Oficial definitiva por evento (`UNIQUE (event_id)`). Sucesivos llamados devuelven el acta certificada existente sin recalcular su hash ni crear registros duplicados.
- **RF-127 (Auditoría de certificación).** La emisión del acta DEBE registrar un evento de auditoría `OFFICIAL_SCRUTINY_RECORD_CERTIFIED` en `audit_event` con el ID del acta, el usuario certificante y el hash de integridad.
- **RF-128 (Consulta y verificación pública).** Usuarios con rol `ADMIN`, `SCRUTINEER`, `ESCRIBANO`, `COMISARIO` o `VEEDOR` PUEDEN consultar el acta y verificar que el hash almacenado coincide exactamente con el hash recalculado sobre el contenido JSON.
- **RF-129 (Formato notarial imprimible).** La interfaz de usuario DEBE proveer una vista de Acta Notarial formal apta para impresión física y PDF (`@media print`) con tipografía formal, foliado, desglose ordenado y espacios para rúbricas de delegados de comparsas y escribano.
- **RF-130 (Accesibilidad y responsive).** La vista del acta DEBE ser accesible en móvil (390×844), tablet (768×1024) y desktop (1440×900), con contraste WCAG AA, soporte de teclado y controles táctiles ≥ 48px.

## Criterios de Aceptación

1. Si los resultados no están liberados, la emisión del acta falla con 409 `RESULTS_NOT_RELEASED`.
2. Si un usuario `ADMIN` intenta emitir el acta, recibe 403 `OFFICIAL_RECORD_EMISSION_FORBIDDEN_FOR_ADMIN`.
3. Si un usuario `SCRUTINEER` o `ESCRIBANO` con 2FA emite el acta, se genera el registro 201 Created con su `recordHash` SHA-256.
4. El contenido del acta refleja fielmente las penalizaciones deducidas en Mejor Comparsa y los ganadores artísticos individuales.
5. Si un empate requería sorteo ceremonial y no se realizó, la emisión se bloquea con 409 `TIE_BREAKER_PENDING`. Si se realizó, el acta incluye los datos del sorteo ceremonial y su semilla.
6. La base de datos impide cualquier `UPDATE` o `DELETE` sobre `official_scrutiny_record`.
7. En la interfaz web, el usuario con rol de escrutinio/escribanía dispone del botón "Certificar y emitir Acta Oficial", mientras que el `ADMIN` visualiza el acta una vez emitida con opción de impresión, sin permiso de alteración.
8. La vista impresa (`@media print`) oculta barras de navegación, botones y elementos no pertinentes, mostrando el documento formal de actas.
