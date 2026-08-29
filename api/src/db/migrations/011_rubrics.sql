ALTER TABLE event_specialty ADD CONSTRAINT event_specialty_id_event_unique UNIQUE (id, event_id);

CREATE TABLE rubric (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES carnival_event(id) ON DELETE RESTRICT,
  name TEXT NOT NULL,
  code TEXT NOT NULL,
  evaluation_target TEXT NOT NULL CHECK (evaluation_target IN ('TROUPE','NOMINATION')),
  expected_subject_type TEXT,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT rubric_target_subject_check CHECK ((evaluation_target='TROUPE' AND expected_subject_type IS NULL) OR (evaluation_target='NOMINATION' AND expected_subject_type IS NOT NULL)),
  CONSTRAINT rubric_event_code_unique UNIQUE(event_id,code),
  CONSTRAINT rubric_id_event_unique UNIQUE(id,event_id)
);
CREATE TABLE evaluation_item (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL,
  rubric_id UUID NOT NULL,
  specialty_id UUID NOT NULL,
  name TEXT NOT NULL,
  code TEXT NOT NULL,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT evaluation_item_rubric_event_fk FOREIGN KEY(rubric_id,event_id) REFERENCES rubric(id,event_id) ON DELETE RESTRICT,
  CONSTRAINT evaluation_item_specialty_event_fk FOREIGN KEY(specialty_id,event_id) REFERENCES event_specialty(id,event_id) ON DELETE RESTRICT,
  CONSTRAINT evaluation_item_rubric_code_unique UNIQUE(rubric_id,code)
);
CREATE FUNCTION require_active_item_specialty() RETURNS TRIGGER LANGUAGE plpgsql AS $$ DECLARE enabled BOOLEAN; BEGIN SELECT active INTO enabled FROM event_specialty WHERE id=NEW.specialty_id; IF FOUND AND enabled=false THEN RAISE EXCEPTION 'SPECIALTY_INACTIVE'; END IF; RETURN NEW; END; $$;
CREATE TRIGGER evaluation_item_requires_active_specialty BEFORE INSERT OR UPDATE OF specialty_id ON evaluation_item FOR EACH ROW EXECUTE FUNCTION require_active_item_specialty();
