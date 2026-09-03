-- Spec 014: Gestión de Penalizaciones (Comisariato)
-- Modelo dedicado para sanciones reglamentarias por comparsa y jornada competitiva.

CREATE TABLE troupe_penalty (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES carnival_event(id) ON DELETE RESTRICT,
  night_id UUID NOT NULL,
  event_troupe_id UUID NOT NULL,
  reason TEXT NOT NULL,
  penalty_points INTEGER NOT NULL CHECK (penalty_points > 0),
  status TEXT NOT NULL DEFAULT 'APPLIED' CHECK (status IN ('APPLIED', 'REVOKED')),
  applied_by_user_id TEXT NOT NULL REFERENCES "user"(id) ON DELETE RESTRICT,
  revoked_by_user_id TEXT REFERENCES "user"(id) ON DELETE RESTRICT,
  revocation_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT troupe_penalty_night_event_fk
    FOREIGN KEY (night_id, event_id) REFERENCES night(id, event_id) ON DELETE RESTRICT,
  CONSTRAINT troupe_penalty_troupe_event_fk
    FOREIGN KEY (event_troupe_id, event_id) REFERENCES event_troupe(id, event_id) ON DELETE RESTRICT,
  CONSTRAINT troupe_penalty_revocation_consistency CHECK (
    (status = 'APPLIED' AND revoked_by_user_id IS NULL AND revocation_reason IS NULL)
    OR
    (status = 'REVOKED' AND revoked_by_user_id IS NOT NULL AND revocation_reason IS NOT NULL AND length(trim(revocation_reason)) > 0)
  )
);

COMMENT ON TABLE troupe_penalty IS
  'Penalizaciones reglamentarias cargadas por Comisariato o Administración por jornada y comparsa.';

CREATE INDEX troupe_penalty_event_troupe_idx ON troupe_penalty (event_id, event_troupe_id);
CREATE INDEX troupe_penalty_night_idx ON troupe_penalty (night_id);

-- Guard contra eliminación física: historia estricta
CREATE OR REPLACE FUNCTION protect_troupe_penalty_delete()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'CANNOT_DELETE_PENALTY';
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS troupe_penalty_delete_guard ON troupe_penalty;
CREATE TRIGGER troupe_penalty_delete_guard
  BEFORE DELETE ON troupe_penalty
  FOR EACH ROW EXECUTE FUNCTION protect_troupe_penalty_delete();

-- Guard de tipo de noche: solo jornadas competitivas
CREATE OR REPLACE FUNCTION check_troupe_penalty_night_competition()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  v_kind TEXT;
BEGIN
  SELECT kind INTO v_kind FROM night WHERE id = NEW.night_id;
  IF v_kind <> 'COMPETITION' THEN
    RAISE EXCEPTION 'PENALTY_REQUIRES_COMPETITION_NIGHT';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS troupe_penalty_night_competition_guard ON troupe_penalty;
CREATE TRIGGER troupe_penalty_night_competition_guard
  BEFORE INSERT OR UPDATE OF night_id ON troupe_penalty
  FOR EACH ROW EXECUTE FUNCTION check_troupe_penalty_night_competition();

-- Guard post-liberación de resultados y mutaciones
CREATE OR REPLACE FUNCTION protect_troupe_penalty_mutation()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  v_released BOOLEAN;
BEGIN
  SELECT EXISTS(
    SELECT 1 FROM results_release WHERE event_id = NEW.event_id
  ) INTO v_released;

  IF v_released THEN
    RAISE EXCEPTION 'RESULTS_ALREADY_RELEASED';
  END IF;

  IF TG_OP = 'UPDATE' THEN
    IF OLD.status = 'REVOKED' THEN
      RAISE EXCEPTION 'CANNOT_MUTATE_REVOKED_PENALTY';
    END IF;

    IF NEW.event_id <> OLD.event_id
       OR NEW.night_id <> OLD.night_id
       OR NEW.event_troupe_id <> OLD.event_troupe_id
       OR NEW.penalty_points <> OLD.penalty_points
       OR NEW.applied_by_user_id <> OLD.applied_by_user_id THEN
      RAISE EXCEPTION 'PENALTY_FIELDS_IMMUTABLE';
    END IF;

    NEW.updated_at = CURRENT_TIMESTAMP;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS troupe_penalty_mutation_guard ON troupe_penalty;
CREATE TRIGGER troupe_penalty_mutation_guard
  BEFORE INSERT OR UPDATE ON troupe_penalty
  FOR EACH ROW EXECUTE FUNCTION protect_troupe_penalty_mutation();
