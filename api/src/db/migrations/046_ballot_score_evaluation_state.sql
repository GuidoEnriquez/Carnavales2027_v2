ALTER TABLE ballot_score ADD COLUMN evaluation_state TEXT;

ALTER TABLE ballot_score DISABLE TRIGGER USER;

UPDATE ballot_score
   SET evaluation_state = CASE
     WHEN score IS NULL THEN 'PENDING'
     WHEN score = 0 THEN 'NOT_PRESENTED'
     ELSE 'SCORED'
   END;

ALTER TABLE ballot_score ENABLE TRIGGER USER;

ALTER TABLE ballot_score
  ALTER COLUMN evaluation_state SET DEFAULT 'PENDING',
  ALTER COLUMN evaluation_state SET NOT NULL,
  ADD CONSTRAINT ballot_score_evaluation_state_ck CHECK (
    (evaluation_state = 'PENDING' AND score IS NULL)
    OR (evaluation_state = 'SCORED' AND score BETWEEN 1 AND 10)
    OR (evaluation_state = 'NOT_PRESENTED' AND score = 0)
  );

CREATE OR REPLACE FUNCTION protect_ballot_score_evaluation_state()
RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'INSERT' AND NEW.requires_subsanation THEN
    RAISE EXCEPTION 'BALLOT_SCORE_SUBSANATION_WORKFLOW_RETIRED';
  END IF;
  IF TG_OP = 'UPDATE' AND NEW.requires_subsanation IS DISTINCT FROM OLD.requires_subsanation THEN
    RAISE EXCEPTION 'BALLOT_SCORE_SUBSANATION_WORKFLOW_RETIRED';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER ballot_score_evaluation_state_guard
BEFORE INSERT OR UPDATE ON ballot_score
FOR EACH ROW EXECUTE FUNCTION protect_ballot_score_evaluation_state();
