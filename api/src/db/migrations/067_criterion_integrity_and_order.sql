-- Spec 017 / T08: preserve historical orphans without permitting new ones.
CREATE FUNCTION guard_criterion_scoring_item()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.scoring_item_id IS NULL THEN
    IF TG_OP = 'INSERT' THEN
      RAISE EXCEPTION 'CRITERION_REASSIGNMENT_REQUIRED' USING ERRCODE = '23514';
    END IF;
    IF OLD.scoring_item_id IS NOT NULL
       OR NEW.id IS DISTINCT FROM OLD.id
       OR NEW.rubric_id IS DISTINCT FROM OLD.rubric_id
       OR NEW.event_id IS DISTINCT FROM OLD.event_id THEN
      RAISE EXCEPTION 'CRITERION_REASSIGNMENT_REQUIRED' USING ERRCODE = '23514';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

-- Preserve EVENT_LOCKED precedence by running after the configuration guard.
CREATE TRIGGER zz_rubric_criterion_scoring_item_guard
BEFORE INSERT OR UPDATE ON rubric_criterion
FOR EACH ROW EXECUTE FUNCTION guard_criterion_scoring_item();

-- Only order constraints are deferred; the composite FK target stays immediate.
ALTER TABLE evaluation_item
  DROP CONSTRAINT evaluation_item_rubric_display_order_unique,
  ADD CONSTRAINT evaluation_item_rubric_display_order_unique
    UNIQUE (rubric_id, display_order) DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE rubric_criterion
  DROP CONSTRAINT rubric_criterion_rubric_order_unique,
  ADD CONSTRAINT rubric_criterion_rubric_order_unique
    UNIQUE (rubric_id, display_order) DEFERRABLE INITIALLY IMMEDIATE;
