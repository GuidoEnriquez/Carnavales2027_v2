CREATE OR REPLACE FUNCTION protect_ballot()
RETURNS trigger AS $$
DECLARE
  night_status TEXT;
  assignment_status TEXT;
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'BALLOT_DELETE_FORBIDDEN';
  END IF;

  IF TG_OP = 'INSERT' THEN
    SELECT n.status INTO night_status
      FROM night n
     WHERE n.id = NEW.night_id AND n.event_id = NEW.event_id;
    IF night_status IS NULL THEN
      RAISE EXCEPTION 'INVALID_BALLOT_REFERENCE';
    END IF;
    SELECT ja.status INTO assignment_status
      FROM judge_assignment ja
     WHERE ja.id = NEW.judge_assignment_id
       AND ja.event_id = NEW.event_id
       AND ja.night_id = NEW.night_id
       AND ja.status = 'ACTIVE';
    IF assignment_status IS NULL THEN
      RAISE EXCEPTION 'BALLOT_REQUIRES_ACTIVE_ASSIGNMENT';
    END IF;
  END IF;

  IF TG_OP = 'UPDATE' THEN
    IF OLD.status = 'SUBMITTED' AND NEW.status = 'REOPENED' THEN
      RAISE EXCEPTION 'BALLOT_REOPEN_DISABLED';
    END IF;
    IF OLD.status = 'SUBMITTED' AND NEW.status = 'OPEN' THEN
      RAISE EXCEPTION 'BALLOT_IMMUTABLE_AFTER_SUBMIT';
    END IF;
    IF OLD.status = 'REOPENED' AND NEW.status = 'OPEN' THEN
      RAISE EXCEPTION 'BALLOT_IMMUTABLE_AFTER_REOPEN';
    END IF;
    IF OLD.status = 'REOPENED' AND NEW.status = 'SUBMITTED' THEN
      NEW.submitted_at = CURRENT_TIMESTAMP;
    END IF;
    IF OLD.status = 'OPEN' AND NEW.status = 'SUBMITTED' THEN
      NEW.submitted_at = CURRENT_TIMESTAMP;
    END IF;
    IF NEW.event_id IS DISTINCT FROM OLD.event_id
       OR NEW.night_id IS DISTINCT FROM OLD.night_id
       OR NEW.judge_assignment_id IS DISTINCT FROM OLD.judge_assignment_id
       OR NEW.judge_profile_id IS DISTINCT FROM OLD.judge_profile_id
       OR NEW.specialty_id IS DISTINCT FROM OLD.specialty_id
       OR NEW.created_at IS DISTINCT FROM OLD.created_at THEN
      RAISE EXCEPTION 'BALLOT_HISTORY_IMMUTABLE';
    END IF;
  END IF;

  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION validate_ballot_integrity()
RETURNS trigger AS $$
DECLARE
  assignment_matches BOOLEAN;
BEGIN
  IF TG_OP = 'INSERT' OR NEW.judge_assignment_id IS DISTINCT FROM OLD.judge_assignment_id
     OR NEW.judge_profile_id IS DISTINCT FROM OLD.judge_profile_id
     OR NEW.specialty_id IS DISTINCT FROM OLD.specialty_id
     OR NEW.event_id IS DISTINCT FROM OLD.event_id
     OR NEW.night_id IS DISTINCT FROM OLD.night_id THEN
    SELECT true INTO assignment_matches
      FROM judge_assignment ja
     WHERE ja.id = NEW.judge_assignment_id
       AND ja.event_id = NEW.event_id
       AND ja.night_id = NEW.night_id
       AND ja.judge_profile_id = NEW.judge_profile_id
       AND ja.specialty_id = NEW.specialty_id
       AND ja.status = 'ACTIVE';
    IF assignment_matches IS DISTINCT FROM true THEN
      RAISE EXCEPTION 'BALLOT_ASSIGNMENT_MISMATCH';
    END IF;
  END IF;

  IF TG_OP = 'UPDATE' THEN
    IF NEW.max_reopens IS DISTINCT FROM OLD.max_reopens THEN
      RAISE EXCEPTION 'BALLOT_HISTORY_IMMUTABLE';
    END IF;
    IF NEW.status IS DISTINCT FROM OLD.status
       AND NOT (
         (OLD.status = 'OPEN' AND NEW.status = 'SUBMITTED')
         OR (OLD.status = 'REOPENED' AND NEW.status = 'SUBMITTED')
       ) THEN
      RAISE EXCEPTION 'INVALID_BALLOT_TRANSITION';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
