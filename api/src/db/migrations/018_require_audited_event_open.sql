CREATE FUNCTION require_event_open_service()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF OLD.status = 'CONFIGURING'
     AND NEW.status = 'OPEN'
     AND current_setting('app.allow_event_open', true) IS DISTINCT FROM 'true' THEN
    RAISE EXCEPTION 'EVENT_OPEN_REQUIRES_SERVICE';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER zz_carnival_event_open_service_guard
BEFORE UPDATE ON carnival_event
FOR EACH ROW EXECUTE FUNCTION require_event_open_service();
