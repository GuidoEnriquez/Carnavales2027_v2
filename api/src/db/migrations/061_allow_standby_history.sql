CREATE OR REPLACE FUNCTION protect_prioritized_standby_assignment()
RETURNS trigger AS $$
DECLARE
  primary_assignment judge_assignment%ROWTYPE;
BEGIN
  IF NEW.status = 'ACTIVE' THEN
    IF NEW.assignment_type = 'SUBSTITUTE' THEN
      IF NEW.standby_for_assignment_id IS NULL THEN RAISE EXCEPTION 'SUBSTITUTE_PRIMARY_REQUIRED'; END IF;
      SELECT * INTO primary_assignment FROM judge_assignment
       WHERE id = NEW.standby_for_assignment_id AND status = 'ACTIVE' AND assignment_type = 'PRIMARY';
      IF NOT FOUND
         OR primary_assignment.event_id <> NEW.event_id
         OR primary_assignment.night_id <> NEW.night_id
         OR primary_assignment.specialty_id <> NEW.specialty_id THEN
        RAISE EXCEPTION 'INVALID_STANDBY_PRIMARY';
      END IF;
    ELSIF NEW.standby_for_assignment_id IS NOT NULL THEN
      RAISE EXCEPTION 'STANDBY_LINK_REQUIRES_SUBSTITUTE';
    END IF;
  END IF;
  IF TG_OP = 'UPDATE' AND OLD.assignment_type = 'PRIMARY' AND OLD.status = 'ACTIVE'
     AND NEW.status = 'REVOKED'
     AND EXISTS (SELECT 1 FROM judge_assignment WHERE standby_for_assignment_id = OLD.id AND status = 'ACTIVE') THEN
    RAISE EXCEPTION 'STANDBY_REVOKE_REQUIRED';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
