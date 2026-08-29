CREATE OR REPLACE FUNCTION require_configuring_event()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  current_status TEXT;
BEGIN
  IF TG_OP = 'UPDATE' THEN
    IF OLD.event_id IS DISTINCT FROM NEW.event_id THEN
      RAISE EXCEPTION 'EVENT_REASSIGNMENT_FORBIDDEN';
    END IF;
  END IF;

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
