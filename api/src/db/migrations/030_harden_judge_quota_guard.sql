CREATE OR REPLACE FUNCTION protect_judge_quota()
RETURNS trigger AS $$
DECLARE
  event_status TEXT;
  night_kind TEXT;
  night_status TEXT;
  specialty_active BOOLEAN;
  active_assignments INTEGER;
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'JUDGE_QUOTA_DELETE_FORBIDDEN';
  END IF;

  IF TG_OP = 'UPDATE' AND (
    NEW.event_id IS DISTINCT FROM OLD.event_id
    OR NEW.night_id IS DISTINCT FROM OLD.night_id
    OR NEW.specialty_id IS DISTINCT FROM OLD.specialty_id
    OR NEW.created_at IS DISTINCT FROM OLD.created_at
  ) THEN
    RAISE EXCEPTION 'JUDGE_QUOTA_HISTORY_IMMUTABLE';
  END IF;

  SELECT e.status, n.kind, n.status, s.active
    INTO event_status, night_kind, night_status, specialty_active
    FROM carnival_event e
    JOIN night n ON n.id = NEW.night_id AND n.event_id = NEW.event_id
    JOIN event_specialty s ON s.id = NEW.specialty_id AND s.event_id = NEW.event_id
   WHERE e.id = NEW.event_id
   FOR UPDATE OF e, n, s;
  IF event_status IS NULL THEN
    RAISE EXCEPTION 'INVALID_ASSIGNMENT_REFERENCE';
  END IF;
  IF event_status IS DISTINCT FROM 'CONFIGURING' THEN
    RAISE EXCEPTION 'EVENT_LOCKED';
  END IF;
  IF night_kind <> 'COMPETITION' THEN
    RAISE EXCEPTION 'JUDGE_ASSIGNMENT_COMPETITION_ONLY';
  END IF;
  IF night_status = 'CLOSED' THEN
    RAISE EXCEPTION 'NIGHT_CLOSED';
  END IF;
  IF NOT specialty_active THEN
    RAISE EXCEPTION 'SPECIALTY_INACTIVE';
  END IF;

  SELECT count(*)::INTEGER INTO active_assignments
    FROM judge_assignment
   WHERE night_id = NEW.night_id
     AND specialty_id = NEW.specialty_id
     AND status = 'ACTIVE';
  IF active_assignments > NEW.max_assignments THEN
    RAISE EXCEPTION 'JUDGE_QUOTA_BELOW_ASSIGNMENTS';
  END IF;

  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
