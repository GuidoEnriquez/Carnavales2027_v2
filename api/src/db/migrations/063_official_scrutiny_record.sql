-- Spec 015: Actas Oficiales y Certificación de Escrutinio
-- Modelo persistente para el almacenamiento inmutable y sellado con hash del Acta Oficial.

CREATE TABLE official_scrutiny_record (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES carnival_event(id) ON DELETE RESTRICT,
  record_number TEXT NOT NULL,
  certified_by TEXT NOT NULL REFERENCES "user"(id) ON DELETE RESTRICT,
  certified_role TEXT NOT NULL CHECK (certified_role IN ('SCRUTINEER', 'ESCRIBANO')),
  record_hash CHAR(64) NOT NULL CHECK (length(record_hash) = 64),
  payload JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT uq_official_scrutiny_event UNIQUE (event_id)
);

COMMENT ON TABLE official_scrutiny_record IS
  'Actas oficiales de escrutinio certificadas por Escribanía o Escrutinio con sello criptográfico JCS/SHA-256.';

CREATE INDEX official_scrutiny_record_event_idx ON official_scrutiny_record (event_id);

-- Guard de inmutabilidad estricta: prohíbe cualquier UPDATE o DELETE
CREATE OR REPLACE FUNCTION protect_official_scrutiny_record_mutation()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'OFFICIAL_RECORD_IMMUTABLE';
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS official_scrutiny_record_mutation_guard ON official_scrutiny_record;
CREATE TRIGGER official_scrutiny_record_mutation_guard
  BEFORE UPDATE OR DELETE ON official_scrutiny_record
  FOR EACH ROW EXECUTE FUNCTION protect_official_scrutiny_record_mutation();

-- Guard de precondición: los resultados deben estar previamente liberados
CREATE OR REPLACE FUNCTION check_official_scrutiny_record_preconditions()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  v_released BOOLEAN;
BEGIN
  SELECT EXISTS(
    SELECT 1 FROM results_release WHERE event_id = NEW.event_id
  ) INTO v_released;

  IF NOT v_released THEN
    RAISE EXCEPTION 'RESULTS_NOT_RELEASED';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS official_scrutiny_record_precondition_guard ON official_scrutiny_record;
CREATE TRIGGER official_scrutiny_record_precondition_guard
  BEFORE INSERT ON official_scrutiny_record
  FOR EACH ROW EXECUTE FUNCTION check_official_scrutiny_record_preconditions();
