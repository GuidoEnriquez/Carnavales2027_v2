-- Spec 030: optional descriptive timestamps. No automatic voting windows.
ALTER TABLE night_troupe_schedule
  ADD COLUMN scheduled_at TIMESTAMPTZ,
  ADD COLUMN scheduled_timezone TEXT,
  ADD COLUMN order_source TEXT,
  ADD CONSTRAINT schedule_timestamp_zone_pair CHECK (
    (scheduled_at IS NULL AND scheduled_timezone IS NULL)
    OR (scheduled_at IS NOT NULL AND scheduled_timezone IS NOT NULL)
  ),
  ADD CONSTRAINT schedule_order_source_nonempty CHECK (order_source IS NULL OR length(trim(order_source)) > 0);

CREATE FUNCTION guard_schedule_timestamp() RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE event_status TEXT;
BEGIN
  IF NEW.scheduled_timezone IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM pg_timezone_names WHERE name=NEW.scheduled_timezone
  ) THEN
    RAISE EXCEPTION 'SCHEDULE_TIMEZONE_INVALID';
  END IF;
  IF TG_OP = 'UPDATE' AND (
    NEW.scheduled_at IS DISTINCT FROM OLD.scheduled_at
    OR NEW.scheduled_timezone IS DISTINCT FROM OLD.scheduled_timezone
    OR NEW.order_source IS DISTINCT FROM OLD.order_source
  ) THEN
    SELECT status INTO event_status FROM carnival_event WHERE id=NEW.event_id FOR UPDATE;
    IF event_status IS DISTINCT FROM 'CONFIGURING' THEN RAISE EXCEPTION 'EVENT_LOCKED'; END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER zz_schedule_timestamp_guard
BEFORE INSERT OR UPDATE ON night_troupe_schedule
FOR EACH ROW EXECUTE FUNCTION guard_schedule_timestamp();
