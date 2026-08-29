ALTER TABLE night ADD CONSTRAINT night_id_event_unique UNIQUE (id, event_id);

CREATE TABLE night_troupe_schedule (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES carnival_event(id) ON DELETE RESTRICT,
  night_id UUID NOT NULL,
  event_troupe_id UUID NOT NULL,
  presentation_order INTEGER NOT NULL CHECK (presentation_order > 0),
  status TEXT NOT NULL DEFAULT 'SCHEDULED' CHECK (status IN ('SCHEDULED','CANCELLED')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT schedule_night_event_fk FOREIGN KEY(night_id,event_id) REFERENCES night(id,event_id) ON DELETE RESTRICT,
  CONSTRAINT schedule_troupe_event_fk FOREIGN KEY(event_troupe_id,event_id) REFERENCES event_troupe(id,event_id) ON DELETE RESTRICT,
  CONSTRAINT schedule_night_troupe_unique UNIQUE(night_id,event_troupe_id),
  CONSTRAINT schedule_night_order_unique UNIQUE(night_id,presentation_order)
);
