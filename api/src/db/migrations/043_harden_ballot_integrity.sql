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
         OR (OLD.status = 'SUBMITTED' AND NEW.status = 'REOPENED')
         OR (OLD.status = 'REOPENED' AND NEW.status = 'SUBMITTED')
       ) THEN
      RAISE EXCEPTION 'INVALID_BALLOT_TRANSITION';
    END IF;
    IF OLD.status = 'SUBMITTED' AND NEW.status = 'REOPENED'
       AND EXISTS (SELECT 1 FROM ballot_score_subsanation WHERE ballot_id = OLD.id) THEN
      RAISE EXCEPTION 'BALLOT_SUBSANATION_FINAL';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER ballot_integrity_guard
BEFORE INSERT OR UPDATE ON ballot
FOR EACH ROW EXECUTE FUNCTION validate_ballot_integrity();

CREATE OR REPLACE FUNCTION validate_ballot_score_integrity()
RETURNS trigger AS $$
DECLARE
  ballot_status TEXT;
  ballot_specialty UUID;
  ballot_night UUID;
  item_specialty UUID;
  schedule_night UUID;
BEGIN
  SELECT b.status, b.specialty_id, b.night_id
    INTO ballot_status, ballot_specialty, ballot_night
    FROM ballot b
   WHERE b.id = NEW.ballot_id AND b.event_id = NEW.event_id;
  IF ballot_status IS NULL THEN
    RAISE EXCEPTION 'INVALID_BALLOT_REFERENCE';
  END IF;

  SELECT specialty_id INTO item_specialty
    FROM evaluation_item
   WHERE id = NEW.evaluation_item_id AND event_id = NEW.event_id;
  IF item_specialty IS DISTINCT FROM ballot_specialty THEN
    RAISE EXCEPTION 'BALLOT_SCORE_SPECIALTY_MISMATCH';
  END IF;

  SELECT night_id INTO schedule_night
    FROM night_troupe_schedule
   WHERE id = NEW.night_schedule_id AND event_id = NEW.event_id;
  IF schedule_night IS DISTINCT FROM ballot_night THEN
    RAISE EXCEPTION 'BALLOT_SCORE_NIGHT_MISMATCH';
  END IF;

  IF TG_OP = 'UPDATE' AND OLD.status = 'DRAFT' AND ballot_status = 'SUBMITTED'
     AND (NEW.status IS DISTINCT FROM 'LOCKED'
       OR NEW.score IS DISTINCT FROM OLD.score
       OR NEW.requires_subsanation IS DISTINCT FROM OLD.requires_subsanation
       OR NEW.subsidized_score IS DISTINCT FROM OLD.subsidized_score) THEN
    RAISE EXCEPTION 'BALLOT_SCORE_IMMUTABLE';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER ballot_score_integrity_guard
BEFORE INSERT OR UPDATE ON ballot_score
FOR EACH ROW EXECUTE FUNCTION validate_ballot_score_integrity();

CREATE OR REPLACE FUNCTION protect_ballot_audit_log()
RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'BALLOT_AUDIT_IMMUTABLE';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER ballot_audit_log_guard
BEFORE UPDATE OR DELETE ON ballot_audit_log
FOR EACH ROW EXECUTE FUNCTION protect_ballot_audit_log();
