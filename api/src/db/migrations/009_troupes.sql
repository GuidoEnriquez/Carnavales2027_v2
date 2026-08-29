ALTER TABLE event_category
  ADD CONSTRAINT event_category_id_event_unique UNIQUE (id, event_id);

CREATE TABLE event_troupe (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES carnival_event(id) ON DELETE RESTRICT,
  category_id UUID NOT NULL,
  name TEXT NOT NULL,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT event_troupe_category_same_event_fk
    FOREIGN KEY (category_id, event_id)
    REFERENCES event_category(id, event_id)
    ON DELETE RESTRICT
);

CREATE FUNCTION require_active_troupe_category()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  category_active BOOLEAN;
BEGIN
  SELECT active INTO category_active
  FROM event_category
  WHERE id = NEW.category_id;

  IF FOUND AND category_active = false THEN
    RAISE EXCEPTION 'CATEGORY_INACTIVE';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER event_troupe_requires_active_category
BEFORE INSERT OR UPDATE OF category_id ON event_troupe
FOR EACH ROW
EXECUTE FUNCTION require_active_troupe_category();
