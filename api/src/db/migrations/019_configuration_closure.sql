CREATE TABLE rubric_criterion (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL,
  rubric_id UUID NOT NULL,
  description TEXT NOT NULL,
  display_order INTEGER NOT NULL CHECK (display_order > 0),
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT rubric_criterion_rubric_event_fk
    FOREIGN KEY (rubric_id, event_id)
    REFERENCES rubric(id, event_id)
    ON DELETE RESTRICT,
  CONSTRAINT rubric_criterion_rubric_order_unique UNIQUE (rubric_id, display_order)
);

CREATE INDEX rubric_criterion_rubric_id_idx ON rubric_criterion (rubric_id);

CREATE TRIGGER rubric_criterion_requires_configuring_event
BEFORE INSERT OR UPDATE OR DELETE ON rubric_criterion
FOR EACH ROW EXECUTE FUNCTION require_configuring_event();

CREATE TRIGGER nomination_requires_configuring_event
BEFORE INSERT OR UPDATE OR DELETE ON troupe_nomination
FOR EACH ROW EXECUTE FUNCTION require_configuring_event();

CREATE TRIGGER schedule_requires_configuring_event
BEFORE INSERT OR UPDATE OR DELETE ON night_troupe_schedule
FOR EACH ROW EXECUTE FUNCTION require_configuring_event();
