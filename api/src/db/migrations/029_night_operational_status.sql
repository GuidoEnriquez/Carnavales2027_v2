CREATE OR REPLACE FUNCTION require_night_change()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  event_status TEXT;
BEGIN
  IF TG_OP = 'DELETE' THEN
    SELECT status INTO event_status FROM carnival_event WHERE id = OLD.event_id FOR UPDATE;
    IF event_status IS DISTINCT FROM 'CONFIGURING' THEN
      RAISE EXCEPTION 'EVENT_LOCKED';
    END IF;
    RETURN OLD;
  END IF;

  SELECT status INTO event_status FROM carnival_event WHERE id = NEW.event_id FOR UPDATE;
  IF event_status IS NULL THEN
    RAISE EXCEPTION 'EVENT_NOT_FOUND';
  END IF;
  IF TG_OP = 'INSERT' THEN
    IF event_status IS DISTINCT FROM 'CONFIGURING' THEN
      RAISE EXCEPTION 'EVENT_LOCKED';
    END IF;
    RETURN NEW;
  END IF;

  IF OLD.event_id IS DISTINCT FROM NEW.event_id THEN
    RAISE EXCEPTION 'EVENT_REASSIGNMENT_FORBIDDEN';
  END IF;
  IF OLD.status = 'CLOSED' THEN
    RAISE EXCEPTION 'NIGHT_CLOSED';
  END IF;
  IF event_status = 'CONFIGURING' THEN
    IF NEW.status NOT IN ('DRAFT', 'OPEN', 'CLOSED') THEN
      RAISE EXCEPTION 'INVALID_NIGHT_STATUS';
    END IF;
    RETURN NEW;
  END IF;
  IF event_status = 'OPEN'
     AND NEW.name = OLD.name
     AND NEW.display_order = OLD.display_order
     AND NEW.event_date IS NOT DISTINCT FROM OLD.event_date
     AND NEW.kind = OLD.kind
     AND ((OLD.status = 'DRAFT' AND NEW.status = 'OPEN')
       OR (OLD.status = 'OPEN' AND NEW.status = 'CLOSED')) THEN
    RETURN NEW;
  END IF;
  RAISE EXCEPTION 'EVENT_LOCKED';
END;
$$;

DROP TRIGGER night_requires_configuring_event ON night;
CREATE TRIGGER night_requires_operational_change
BEFORE INSERT OR UPDATE OR DELETE ON night
FOR EACH ROW EXECUTE FUNCTION require_night_change();
