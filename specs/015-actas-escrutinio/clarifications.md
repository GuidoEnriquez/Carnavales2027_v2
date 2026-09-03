# Clarifications — Spec 015: Actas Oficiales y Certificación de Escrutinio

## Registro de Decisiones de Arquitectura y Negocio

### 1. Segregación Estricta de Funciones (Segregation of Duties)
- **Pregunta:** ¿El Administrador puede emitir o firmar el Acta Oficial de Escrutinio?
- **Decisión:** **NO.** Por mandato normativo del Reglamento y del producto, el rol `ADMIN` organiza, configura y asigna, pero la fe pública y certificación definitiva del escrutinio corresponde con exclusividad a los roles `SCRUTINEER` (Escrutador) y `ESCRIBANO` (Escribano Público).
- **Implementación:** El endpoint `POST /api/v1/events/:eventId/scrutiny-record` exige `requireScrutinyCertificationAccess`. Si el usuario tiene rol `ADMIN`, responde 403 con código explícito `OFFICIAL_RECORD_EMISSION_FORBIDDEN_FOR_ADMIN`.

### 2. Estándar Criptográfico de Integridad (Sello Digital)
- **Pregunta:** ¿Cómo se garantiza que el contenido del acta no pueda ser alterado a posteriori sin detección?
- **Decisión:** Se utiliza canonicalización canónica JSON (RFC 8785 / JCS) idéntica a la aplicada en el Sorteo Ceremonial (Spec 011), seguida de hash criptográfico `SHA-256` en formato hexadecimal de 64 caracteres.
- **Implementación:** La función `computeRecordHash(payload)` canonicaliza claves y genera `sha256(canonicalPayload)`. El hash se guarda en la columna `record_hash`.

### 3. Inmutabilidad en Base de Datos
- **Pregunta:** ¿Qué ocurre si se intenta modificar o eliminar un acta certificada?
- **Decisión:** La tabla `official_scrutiny_record` cuenta con un trigger en PostgreSQL que rechaza cualquier operación `UPDATE` o `DELETE` (`OFFICIAL_RECORD_IMMUTABLE`). No existe borrado lógico ni físico de un acta emitida.

### 4. Formato de Impresión Legal y Foliado
- **Pregunta:** ¿Cómo se genera el documento para archivo notarial físico y firmas de delegados?
- **Decisión:** En lugar de depender de librerías de generación de binarios PDF en el backend (que añaden dependencias pesadas y fuentes variables), el sistema provee una vista web notarial con hoja de estilos `@media print` rigurosamente tipografiada:
  - Foliado automático y fecha en letra legal.
  - Ocultamiento de cabeceras de navegación, botones y badges de conectividad.
  - Tabla de ganadores de rubros y tabla general de Mejor Comparsa con desglose (Bruto, Penalizaciones, Neto).
  - Casilleros formales para firma de Escribano actuante y delegados de cada comparsa participante.
  - El navegador genera el PDF idéntico mediante la función estándar `window.print()` / Guardar como PDF.

### 5. Idempotencia y Reutilización
- **Pregunta:** ¿Qué sucede si el Escribano o Escrutador vuelve a llamar a la emisión sobre un evento ya certificado?
- **Decisión:** La operación es idempotente: devuelve el acta existente con código HTTP 200 y la indicación `alreadyCertified: true`, conservando el hash y timestamp originales.
