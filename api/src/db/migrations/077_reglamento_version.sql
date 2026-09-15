-- SVC2-89: versionar el reglamento aplicado a cada evento y acta.
-- Columnas aditivas y anulables: no alteran datos ni comportamiento existente.
ALTER TABLE carnival_event ADD COLUMN IF NOT EXISTS reglamento_version TEXT;
ALTER TABLE official_scrutiny_record ADD COLUMN IF NOT EXISTS reglamento_version TEXT;

COMMENT ON COLUMN carnival_event.reglamento_version IS
  'Versión del reglamento vigente para el evento (p. ej. v1). NULL = anterior a SVC2-89.';
COMMENT ON COLUMN official_scrutiny_record.reglamento_version IS
  'Versión del reglamento con la que se certificó el acta; copia de carnival_event al emitir.';
