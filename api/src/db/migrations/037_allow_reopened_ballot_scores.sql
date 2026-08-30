CREATE OR REPLACE FUNCTION protect_ballot_score()
RETURNS trigger AS $$
DECLARE
  ballot_status TEXT;
  item_specialty UUID;
  item_active BOOLEAN;
  item_rubric UUID;
  schedule_night UUID;
  schedule_event UUID;
  score_ballot_event UUID;
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'BALLOT_SCORE_DELETE_FORBIDDEN';
  END IF;

  IF TG_OP = 'UPDATE' THEN
    IF NEW.ballot_id IS DISTINCT FROM OLD.ballot_id
       OR NEW.evaluation_item_id IS DISTINCT FROM OLD.evaluation_item_id
       OR NEW.event_id IS DISTINCT FROM OLD.event_id
       OR NEW.created_at IS DISTINCT FROM OLD.created_at THEN
      RAISE EXCEPTION 'BALLOT_SCORE_HISTORY_IMMUTABLE';
    END IF;

    IF OLD.status = 'LOCKED' THEN
      SELECT status INTO ballot_status FROM ballot WHERE id = NEW.ballot_id;
      IF ballot_status IS DISTINCT FROM 'REOPENED'
         OR NEW.status IS DISTINCT FROM 'DRAFT'
         OR NEW.locked_at IS NOT NULL
         OR NEW.score IS DISTINCT FROM OLD.score
         OR NEW.requires_subsanation IS DISTINCT FROM OLD.requires_subsanation
         OR NEW.subsidized_score IS DISTINCT FROM OLD.subsidized_score
         OR NEW.rubric_id IS DISTINCT FROM OLD.rubric_id
         OR NEW.night_schedule_id IS DISTINCT FROM OLD.night_schedule_id THEN
        RAISE EXCEPTION 'BALLOT_SCORE_IMMUTABLE';
      END IF;
    ELSIF NEW.status = 'LOCKED' THEN
      NEW.locked_at = CURRENT_TIMESTAMP;
    END IF;
  END IF;

  IF TG_OP = 'INSERT' THEN
    SELECT b.event_id, b.status
      INTO score_ballot_event, ballot_status
      FROM ballot b
     WHERE b.id = NEW.ballot_id;
    IF score_ballot_event IS NULL THEN
      RAISE EXCEPTION 'INVALID_BALLOT_REFERENCE';
    END IF;
    IF ballot_status = 'SUBMITTED' THEN
      RAISE EXCEPTION 'BALLOT_ALREADY_SUBMITTED';
    END IF;
    IF NEW.event_id IS DISTINCT FROM score_ballot_event THEN
      RAISE EXCEPTION 'BALLOT_SCORE_EVENT_MISMATCH';
    END IF;

    SELECT ei.specialty_id, ei.active, ei.rubric_id
      INTO item_specialty, item_active, item_rubric
      FROM evaluation_item ei
     WHERE ei.id = NEW.evaluation_item_id AND ei.event_id = NEW.event_id;
    IF item_specialty IS NULL THEN
      RAISE EXCEPTION 'INVALID_EVALUATION_ITEM';
    END IF;
    IF item_active = false THEN
      RAISE EXCEPTION 'EVALUATION_ITEM_INACTIVE';
    END IF;
    IF item_rubric IS DISTINCT FROM NEW.rubric_id THEN
      RAISE EXCEPTION 'BALLOT_SCORE_RUBRIC_MISMATCH';
    END IF;

    SELECT nts.event_id, nts.id INTO schedule_event, schedule_night
      FROM night_troupe_schedule nts
     WHERE nts.id = NEW.night_schedule_id AND nts.event_id = NEW.event_id;
    IF schedule_event IS NULL THEN
      RAISE EXCEPTION 'INVALID_SCHEDULE_REFERENCE';
    END IF;
  END IF;

  IF NEW.score IS NOT NULL AND (NEW.score < 0 OR NEW.score > 10) THEN
    RAISE EXCEPTION 'BALLOT_SCORE_OUT_OF_RANGE';
  END IF;

  IF NEW.score IS NOT NULL AND NEW.requires_subsanation = true THEN
    NEW.requires_subsanation = false;
    NEW.subsidized_score = NULL;
  END IF;

  IF NEW.score IS NULL AND NEW.requires_subsanation = true THEN
    NEW.subsidized_score = 5;
  END IF;

  IF NEW.score IS NULL AND NEW.requires_subsanation = false THEN
    NEW.subsidized_score = NULL;
  END IF;

  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
