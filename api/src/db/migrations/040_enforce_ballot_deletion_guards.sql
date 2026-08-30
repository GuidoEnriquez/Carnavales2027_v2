DROP TRIGGER IF EXISTS ballot_guard ON ballot;
CREATE TRIGGER ballot_guard
BEFORE INSERT OR UPDATE OR DELETE ON ballot
FOR EACH ROW EXECUTE FUNCTION protect_ballot();

DROP TRIGGER IF EXISTS ballot_score_guard ON ballot_score;
CREATE TRIGGER ballot_score_guard
BEFORE INSERT OR UPDATE OR DELETE ON ballot_score
FOR EACH ROW EXECUTE FUNCTION protect_ballot_score();
