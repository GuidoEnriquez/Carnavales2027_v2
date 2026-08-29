CREATE OR REPLACE FUNCTION require_configuring_event()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  current_status TEXT;
BEGIN
  SELECT status
    INTO current_status
    FROM carnival_event
   WHERE id = NEW.event_id
   FOR UPDATE;

  IF current_status IS DISTINCT FROM 'CONFIGURING' THEN
    RAISE EXCEPTION 'EVENT_LOCKED';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER night_requires_configuring_event
BEFORE INSERT OR UPDATE ON night
FOR EACH ROW EXECUTE FUNCTION require_configuring_event();

CREATE TRIGGER category_requires_configuring_event
BEFORE INSERT OR UPDATE ON event_category
FOR EACH ROW EXECUTE FUNCTION require_configuring_event();

CREATE TRIGGER troupe_requires_configuring_event
BEFORE INSERT OR UPDATE ON event_troupe
FOR EACH ROW EXECUTE FUNCTION require_configuring_event();

CREATE TRIGGER specialty_requires_configuring_event
BEFORE INSERT OR UPDATE ON event_specialty
FOR EACH ROW EXECUTE FUNCTION require_configuring_event();

CREATE TRIGGER rubric_requires_configuring_event
BEFORE INSERT OR UPDATE ON rubric
FOR EACH ROW EXECUTE FUNCTION require_configuring_event();

CREATE TRIGGER evaluation_item_requires_configuring_event
BEFORE INSERT OR UPDATE ON evaluation_item
FOR EACH ROW EXECUTE FUNCTION require_configuring_event();
