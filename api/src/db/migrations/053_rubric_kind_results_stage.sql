-- Spec 010: Resultados — clasificación nominativo/aleatorio y etapa de publicación.
-- No modifica votos ni planillas. Las columnas nuevas son configuración de evento.

ALTER TABLE rubric
  ADD COLUMN rubric_kind TEXT NOT NULL DEFAULT 'NOMINATIVE'
    CHECK (rubric_kind IN ('NOMINATIVE', 'RANDOM'));

COMMENT ON COLUMN rubric.rubric_kind IS
  'NOMINATIVE: ingresa al cómputo de Mejor Comparsa. RANDOM: tiene ganador de rubro pero no suma a Mejor Comparsa.';

CREATE TABLE results_release (
  event_id UUID PRIMARY KEY REFERENCES carnival_event(id) ON DELETE RESTRICT,
  released_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  released_by TEXT NOT NULL REFERENCES "user"(id) ON DELETE RESTRICT
);

COMMENT ON TABLE results_release IS
  'Marca la etapa autorizada de escrutinio/resultados. Registro append-only; no se permite UPDATE ni DELETE.';

CREATE OR REPLACE FUNCTION protect_results_release()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'RESULTS_RELEASE_IMMUTABLE';
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS results_release_guard ON results_release;
CREATE TRIGGER results_release_guard
  BEFORE UPDATE OR DELETE ON results_release
  FOR EACH ROW EXECUTE FUNCTION protect_results_release();
