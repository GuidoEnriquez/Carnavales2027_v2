# Plan — Spec 015: Actas Oficiales y Certificación de Escrutinio

## 1. Arquitectura y Modelo de Datos

### 1.1 Migración `063_official_scrutiny_record.sql`
Tabla dedicada para el almacenamiento definitivo e inmutable del acta:

```sql
CREATE TABLE official_scrutiny_record (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id UUID NOT NULL REFERENCES carnival_event(id) ON DELETE RESTRICT,
    record_number TEXT NOT NULL,
    certified_by UUID NOT NULL REFERENCES "user"(id) ON DELETE RESTRICT,
    certified_role TEXT NOT NULL,
    record_hash CHAR(64) NOT NULL,
    payload JSONB NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_official_scrutiny_event UNIQUE (event_id)
);

-- Trigger de inmutabilidad estricta: prohíbe UPDATE y DELETE
CREATE OR REPLACE FUNCTION trg_guard_official_scrutiny_record()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'UPDATE' THEN
        RAISE EXCEPTION 'OFFICIAL_RECORD_IMMUTABLE: No se puede modificar un acta oficial emitida.';
    ELSIF TG_OP = 'DELETE' THEN
        RAISE EXCEPTION 'OFFICIAL_RECORD_IMMUTABLE: No se puede eliminar un acta oficial emitida.';
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER tg_guard_official_scrutiny_record
BEFORE UPDATE OR DELETE ON official_scrutiny_record
FOR EACH ROW EXECUTE FUNCTION trg_guard_official_scrutiny_record();
```

---

## 2. Servicios de Dominio Backend

### 2.1 `scrutiny-record-service.js`
* **`computeRecordHash(payload)`**:
  Ordena las claves del objeto JSON de forma canónica determinística (RFC 8785) y calcula el hash `SHA-256` hexadecimal en mayúsculas/minúsculas normalizadas.
* **`verifyRecordIntegrity(record)`**:
  Recalcula el hash sobre `record.payload` y devuelve `true` si coincide exactamente con `record.record_hash`.
* **`certifyScrutinyRecord({ client, eventId, actorUserId })`**:
  1. Verifica que el evento exista y sus resultados estén liberados (`results_release`). Si no: lanza `RESULTS_NOT_RELEASED`.
  2. Obtiene el resultado consolidado del escrutinio (Mejor Comparsa con penalizaciones deducidas, ganadores por rubro y memoria de desempates). Si existe un empate pendiente de sorteo: lanza `TIE_BREAKER_PENDING`.
  3. Si ya existe un acta previa para `eventId`: devuelve el acta existente con `{ alreadyCertified: true }` (idempotencia).
  4. Recupera la lista de jurados participantes y comparsas del evento.
  5. Construye el payload canónico del acta notarial con foliado correlativo: `ACTA-2027-<EVENT_ID>-01`.
  6. Calcula el hash SHA-256.
  7. Inserta el registro en `official_scrutiny_record`.
  8. Registra evento de auditoría `OFFICIAL_SCRUTINY_RECORD_CERTIFIED`.
* **`getOfficialScrutinyRecord({ client, eventId })`**:
  Consulta el acta registrada y acompaña el booleano `integrityVerified: true/false`.

---

## 3. Seguridad y Autorización (Segregación de Funciones)

### 3.1 Middleware `requireScrutinyCertificationAccess`
* Exige sesión con 2FA activo.
* Verifica roles del usuario:
  * Si el usuario cuenta con `SCRUTINEER` o `ESCRIBANO`: permite la emisión.
  * Si el usuario cuenta únicamente con rol `ADMIN`: responde `403` con código `OFFICIAL_RECORD_EMISSION_FORBIDDEN_FOR_ADMIN`.
  * Otros roles (`JUDGE`, `VEEDOR`, etc.): responden `403` `RESULTS_ACCESS_DENIED`.

### 3.2 Endpoints HTTP (`scrutiny-records.routes.js`)
* `POST /api/v1/events/:eventId/scrutiny-record`: Emisión y certificación (exclusiva para `SCRUTINEER` y `ESCRIBANO`).
* `GET /api/v1/events/:eventId/scrutiny-record`: Consulta del acta y su hash (permitida para `ADMIN`, `SCRUTINEER`, `ESCRIBANO`, `COMISARIO` y `VEEDOR`).

---

## 4. Frontend e Interfaz Notarial Imprimible

### 4.1 Pantalla de Acta Notarial (`OfficialRecordPage.jsx`)
* Muestra el documento formal estructurado:
  1. Encabezado con número de acta, fecha y datos de la escribanía / secretaría electoral.
  2. Certificación notarial de apertura de urnas/planillas y cómputo informático.
  3. Nómina de jurados que evaluaron cada jornada.
  4. Ganadores por rubro artístico con sus puntajes.
  5. Tabla definitiva de Mejor Comparsa con las tres columnas: Puntaje bruto, Total de penalizaciones reglamentarias y Puntaje final neto.
  6. Indicación de desempate ceremonial aplicado (si existió).
  7. Bloque de Seguridad Digital: muestra el **Hash SHA-256** oficial con badge `✓ INTEGRIDAD VERIFICADA`.
  8. Cuadro de firmas hológrafas para Escribano Mayor, Delegado Comparsa 1, Delegado Comparsa 2, Delegado Comparsa 3 y Presidente de la Comisión.
* Si el acta no está emitida aún:
  * Si el usuario es `SCRUTINEER` o `ESCRIBANO`: se muestra el botón interactivo **"Certificar y emitir Acta Oficial"**.
  * Si el usuario es `ADMIN`: se muestra el aviso informativo *"El acta oficial debe ser emitida y firmada por Escrutinio o Escribanía"*.
* Botón de acción **"Imprimir / Exportar Acta Notarial (PDF)"** ejecutando `window.print()`.

### 4.2 Estilos Notariales `@media print` en `index.css`
* Al imprimir:
  * Oculta navegación (`nav`, `header`, botones de acción, footer de la app).
  * Fondo blanco (#fff), texto negro (#000), tipografía formal serif/sans legible legal.
  * Tablas limpias con bordes finos (#333), sin scrollbars.
  * Saltos de página inteligentes (`break-inside: avoid` en tablas y bloques de firmas).

---

## 5. Trazabilidad y Verificación

* Pruebas en Base de Datos: inserción, inmutabilidad (rechazo de UPDATE/DELETE), unicidad por evento.
* Pruebas en API: rechazo previo a liberación, rechazo a ADMIN, emisión exitosa por SCRUTINEER/ESCRIBANO, verificación de hash canónico.
* Pruebas en Cliente: renderizado de acta, visualización de firmas, protección de botón según rol.
