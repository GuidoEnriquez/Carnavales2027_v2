ALTER TABLE event_troupe ADD CONSTRAINT event_troupe_id_event_unique UNIQUE (id, event_id);

CREATE TABLE troupe_nomination (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES carnival_event(id) ON DELETE RESTRICT,
  event_troupe_id UUID NOT NULL,
  rubric_id UUID NOT NULL,
  subject_type TEXT NOT NULL,
  display_name TEXT NOT NULL,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT troupe_nomination_troupe_event_fk FOREIGN KEY(event_troupe_id,event_id) REFERENCES event_troupe(id,event_id) ON DELETE RESTRICT,
  CONSTRAINT troupe_nomination_rubric_event_fk FOREIGN KEY(rubric_id,event_id) REFERENCES rubric(id,event_id) ON DELETE RESTRICT
);
