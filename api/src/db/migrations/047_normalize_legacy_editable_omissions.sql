CREATE OR REPLACE FUNCTION protect_ballot_score_evaluation_state()
RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'INSERT' AND NEW.requires_subsanation THEN
    RAISE EXCEPTION 'BALLOT_SCORE_SUBSANATION_WORKFLOW_RETIRED';
  END IF;
  IF TG_OP = 'UPDATE' AND NEW.requires_subsanation IS DISTINCT FROM OLD.requires_subsanation
     AND NOT (
       OLD.requires_subsanation = true
       AND NEW.requires_subsanation = false
       AND OLD.evaluation_state = 'PENDING'
       AND NEW.evaluation_state IN ('PENDING', 'SCORED', 'NOT_PRESENTED')
     ) THEN
    RAISE EXCEPTION 'BALLOT_SCORE_SUBSANATION_WORKFLOW_RETIRED';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

UPDATE ballot_score
   SET requires_subsanation = false,
       subsidized_score = NULL
 WHERE requires_subsanation = true
   AND status = 'DRAFT';
