CREATE OR REPLACE FUNCTION require_configuring_event()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  target_event_id UUID;
  current_status TEXT;
BEGIN
  IF TG_OP = 'DELETE' THEN
    target_event_id := OLD.event_id;
  ELSE
    target_event_id := NEW.event_id;
  END IF;

  IF TG_OP = 'UPDATE' AND OLD.event_id IS DISTINCT FROM NEW.event_id THEN
    RAISE EXCEPTION 'EVENT_REASSIGNMENT_FORBIDDEN';
  END IF;

  SELECT status
    INTO current_status
    FROM carnival_event
   WHERE id = target_event_id
   FOR UPDATE;

  IF current_status IS DISTINCT FROM 'CONFIGURING' THEN
    RAISE EXCEPTION 'EVENT_LOCKED';
  END IF;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER night_requires_configuring_event ON night;
CREATE TRIGGER night_requires_configuring_event
BEFORE INSERT OR UPDATE OR DELETE ON night
FOR EACH ROW EXECUTE FUNCTION require_configuring_event();

DROP TRIGGER category_requires_configuring_event ON event_category;
CREATE TRIGGER category_requires_configuring_event
BEFORE INSERT OR UPDATE OR DELETE ON event_category
FOR EACH ROW EXECUTE FUNCTION require_configuring_event();

DROP TRIGGER troupe_requires_configuring_event ON event_troupe;
CREATE TRIGGER troupe_requires_configuring_event
BEFORE INSERT OR UPDATE OR DELETE ON event_troupe
FOR EACH ROW EXECUTE FUNCTION require_configuring_event();

DROP TRIGGER specialty_requires_configuring_event ON event_specialty;
CREATE TRIGGER specialty_requires_configuring_event
BEFORE INSERT OR UPDATE OR DELETE ON event_specialty
FOR EACH ROW EXECUTE FUNCTION require_configuring_event();

DROP TRIGGER rubric_requires_configuring_event ON rubric;
CREATE TRIGGER rubric_requires_configuring_event
BEFORE INSERT OR UPDATE OR DELETE ON rubric
FOR EACH ROW EXECUTE FUNCTION require_configuring_event();

DROP TRIGGER evaluation_item_requires_configuring_event ON evaluation_item;
CREATE TRIGGER evaluation_item_requires_configuring_event
BEFORE INSERT OR UPDATE OR DELETE ON evaluation_item
FOR EACH ROW EXECUTE FUNCTION require_configuring_event();

CREATE FUNCTION guard_carnival_event_update()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF OLD.status = 'OPEN' THEN
    RAISE EXCEPTION 'EVENT_LOCKED';
  END IF;

  IF NEW.status = 'OPEN' AND OLD.status = 'CONFIGURING' AND (
    NOT EXISTS (
      SELECT 1 FROM night
       WHERE event_id = OLD.id AND kind = 'COMPETITION'
    )
    OR NOT EXISTS (
      SELECT 1 FROM event_troupe
       WHERE event_id = OLD.id AND active
    )
    OR NOT EXISTS (
      SELECT 1 FROM event_specialty
       WHERE event_id = OLD.id AND active
    )
    OR NOT EXISTS (
      SELECT 1 FROM rubric
       WHERE event_id = OLD.id AND active
    )
    OR EXISTS (
      SELECT 1
        FROM event_troupe t
        LEFT JOIN event_category c ON c.id = t.category_id
       WHERE t.event_id = OLD.id
         AND t.active
         AND (c.id IS NULL OR NOT c.active)
    )
    OR EXISTS (
      SELECT 1
        FROM rubric r
       WHERE r.event_id = OLD.id
         AND r.active
         AND (
           NOT EXISTS (
             SELECT 1 FROM evaluation_item i
              WHERE i.rubric_id = r.id AND i.active
           )
           OR EXISTS (
             SELECT 1
               FROM evaluation_item i
               JOIN event_specialty s ON s.id = i.specialty_id
              WHERE i.rubric_id = r.id
                AND i.active
                AND NOT s.active
           )
         )
    )
  ) THEN
    RAISE EXCEPTION 'EVENT_CONFIGURATION_INCOMPLETE';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER carnival_event_update_guard
BEFORE UPDATE ON carnival_event
FOR EACH ROW EXECUTE FUNCTION guard_carnival_event_update();

CREATE FUNCTION prevent_carnival_event_delete()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'EVENT_DELETE_FORBIDDEN';
END;
$$;

CREATE TRIGGER carnival_event_no_delete
BEFORE DELETE ON carnival_event
FOR EACH ROW EXECUTE FUNCTION prevent_carnival_event_delete();
