CREATE OR REPLACE FUNCTION protect_ballot_score_subsanation()
RETURNS trigger AS $$
DECLARE
  ballot_status TEXT;
  original_score INTEGER;
  omission_marked BOOLEAN;
BEGIN
  IF TG_OP <> 'INSERT' THEN
    RAISE EXCEPTION 'BALLOT_SCORE_SUBSANATION_IMMUTABLE';
  END IF;

  SELECT b.status, bs.score, bs.requires_subsanation
    INTO ballot_status, original_score, omission_marked
    FROM ballot_score bs
    JOIN ballot b ON b.id = bs.ballot_id
   WHERE bs.id = NEW.ballot_score_id
     AND bs.ballot_id = NEW.ballot_id
     AND bs.event_id = NEW.event_id;
  IF ballot_status IS NULL THEN
    RAISE EXCEPTION 'INVALID_BALLOT_SCORE_SUBSANATION_REFERENCE';
  END IF;
  IF ballot_status IS DISTINCT FROM 'SUBMITTED'
     OR original_score IS NOT NULL
     OR omission_marked IS NOT TRUE THEN
    RAISE EXCEPTION 'BALLOT_SCORE_SUBSANATION_REQUIRES_OMISSION';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
