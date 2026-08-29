CREATE TABLE event_specialty (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES carnival_event(id) ON DELETE RESTRICT,
  name TEXT NOT NULL,
  code TEXT NOT NULL,
  display_order INTEGER NOT NULL CHECK (display_order > 0),
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT event_specialty_event_code_unique UNIQUE (event_id, code),
  CONSTRAINT event_specialty_event_display_order_unique UNIQUE (event_id, display_order)
);

CREATE FUNCTION prevent_event_specialty_delete()
RETURNS TRIGGER LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'SPECIALTY_DELETE_FORBIDDEN'; END; $$;
CREATE TRIGGER event_specialty_no_delete BEFORE DELETE ON event_specialty FOR EACH ROW EXECUTE FUNCTION prevent_event_specialty_delete();
