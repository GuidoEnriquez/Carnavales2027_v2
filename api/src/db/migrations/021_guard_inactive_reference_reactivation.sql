CREATE OR REPLACE FUNCTION require_active_troupe_category()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  category_active BOOLEAN;
BEGIN
  IF TG_OP = 'UPDATE'
     AND NEW.category_id IS NOT DISTINCT FROM OLD.category_id
     AND NEW.active = false THEN
    RETURN NEW;
  END IF;

  SELECT active INTO category_active
  FROM event_category
  WHERE id = NEW.category_id;

  IF FOUND AND category_active = false THEN
    RAISE EXCEPTION 'CATEGORY_INACTIVE';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER event_troupe_requires_active_category ON event_troupe;
CREATE TRIGGER event_troupe_requires_active_category
BEFORE INSERT OR UPDATE OF category_id, active ON event_troupe
FOR EACH ROW
EXECUTE FUNCTION require_active_troupe_category();

CREATE OR REPLACE FUNCTION require_active_item_specialty()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  specialty_active BOOLEAN;
BEGIN
  IF TG_OP = 'UPDATE'
     AND NEW.specialty_id IS NOT DISTINCT FROM OLD.specialty_id
     AND NEW.active = false THEN
    RETURN NEW;
  END IF;

  SELECT active INTO specialty_active
  FROM event_specialty
  WHERE id = NEW.specialty_id;

  IF FOUND AND specialty_active = false THEN
    RAISE EXCEPTION 'SPECIALTY_INACTIVE';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER evaluation_item_requires_active_specialty ON evaluation_item;
CREATE TRIGGER evaluation_item_requires_active_specialty
BEFORE INSERT OR UPDATE OF specialty_id, active ON evaluation_item
FOR EACH ROW
EXECUTE FUNCTION require_active_item_specialty();
