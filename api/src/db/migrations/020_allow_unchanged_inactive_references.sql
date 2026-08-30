CREATE OR REPLACE FUNCTION require_active_troupe_category()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  category_active BOOLEAN;
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.category_id IS NOT DISTINCT FROM OLD.category_id THEN
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

CREATE OR REPLACE FUNCTION require_active_item_specialty()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  specialty_active BOOLEAN;
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.specialty_id IS NOT DISTINCT FROM OLD.specialty_id THEN
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
