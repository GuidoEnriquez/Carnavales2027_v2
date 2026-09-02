ALTER TABLE judge_assignment
  ADD COLUMN standby_for_assignment_id UUID REFERENCES judge_assignment(id) ON DELETE RESTRICT;

CREATE UNIQUE INDEX judge_assignment_active_standby_for_uq
  ON judge_assignment (standby_for_assignment_id)
  WHERE status = 'ACTIVE' AND standby_for_assignment_id IS NOT NULL;

CREATE OR REPLACE FUNCTION protect_prioritized_standby_assignment()
RETURNS trigger AS $$
DECLARE
  primary_assignment judge_assignment%ROWTYPE;
BEGIN
  IF NEW.assignment_type = 'SUBSTITUTE' AND NEW.status = 'ACTIVE' THEN
    IF NEW.standby_for_assignment_id IS NULL THEN
      RAISE EXCEPTION 'SUBSTITUTE_PRIMARY_REQUIRED';
    END IF;
    SELECT * INTO primary_assignment
      FROM judge_assignment
     WHERE id = NEW.standby_for_assignment_id
       AND status = 'ACTIVE'
       AND assignment_type = 'PRIMARY';
    IF NOT FOUND
       OR primary_assignment.event_id <> NEW.event_id
       OR primary_assignment.night_id <> NEW.night_id
       OR primary_assignment.specialty_id <> NEW.specialty_id THEN
      RAISE EXCEPTION 'INVALID_STANDBY_PRIMARY';
    END IF;
  ELSIF NEW.standby_for_assignment_id IS NOT NULL THEN
    RAISE EXCEPTION 'STANDBY_LINK_REQUIRES_SUBSTITUTE';
  END IF;

  IF TG_OP = 'UPDATE'
     AND OLD.assignment_type = 'PRIMARY'
     AND OLD.status = 'ACTIVE'
     AND NEW.status = 'REVOKED'
     AND EXISTS (
       SELECT 1 FROM judge_assignment
        WHERE standby_for_assignment_id = OLD.id AND status = 'ACTIVE'
     ) THEN
    RAISE EXCEPTION 'STANDBY_REVOKE_REQUIRED';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER judge_assignment_prioritized_standby_guard
BEFORE INSERT OR UPDATE ON judge_assignment
FOR EACH ROW EXECUTE FUNCTION protect_prioritized_standby_assignment();

ALTER TABLE ballot
  ADD COLUMN replaced_at TIMESTAMPTZ,
  ADD COLUMN replaced_by TEXT REFERENCES "user"(id) ON DELETE RESTRICT,
  ADD COLUMN replacement_reason TEXT;

ALTER TABLE ballot DROP CONSTRAINT ballot_one_per_judge_night;
CREATE UNIQUE INDEX ballot_one_active_per_judge_night_uq
  ON ballot (judge_profile_id, night_id)
  WHERE status <> 'REPLACED';

ALTER TABLE ballot DROP CONSTRAINT ballot_status_check;
ALTER TABLE ballot ADD CONSTRAINT ballot_status_check
  CHECK (status IN ('OPEN', 'SUBMITTED', 'REOPENED', 'REPLACED'));
ALTER TABLE ballot ADD CONSTRAINT ballot_replaced_fields_check
  CHECK (
    (status = 'REPLACED' AND replaced_at IS NOT NULL AND length(trim(coalesce(replacement_reason, ''))) > 0)
    OR
    (status <> 'REPLACED' AND replaced_at IS NULL AND replaced_by IS NULL AND replacement_reason IS NULL)
  );

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
    SELECT n.status INTO night_status FROM night n
     WHERE n.id = NEW.night_id AND n.event_id = NEW.event_id;
    IF night_status IS NULL THEN RAISE EXCEPTION 'INVALID_BALLOT_REFERENCE'; END IF;
    SELECT ja.status INTO assignment_status FROM judge_assignment ja
     WHERE ja.id = NEW.judge_assignment_id AND ja.event_id = NEW.event_id
       AND ja.night_id = NEW.night_id AND ja.status = 'ACTIVE';
    IF assignment_status IS NULL THEN RAISE EXCEPTION 'BALLOT_REQUIRES_ACTIVE_ASSIGNMENT'; END IF;
  END IF;
  IF TG_OP = 'UPDATE' THEN
    IF OLD.status = 'REPLACED' THEN RAISE EXCEPTION 'BALLOT_REPLACED_FINAL'; END IF;
    IF NEW.status = 'REPLACED' AND OLD.status NOT IN ('OPEN', 'REOPENED') THEN RAISE EXCEPTION 'BALLOT_REPLACEMENT_INVALID'; END IF;
    IF NEW.status = 'REPLACED' AND (NEW.replaced_at IS NULL OR length(trim(coalesce(NEW.replacement_reason, ''))) = 0) THEN RAISE EXCEPTION 'BALLOT_REPLACEMENT_REASON_REQUIRED'; END IF;
    IF OLD.status = 'SUBMITTED' AND NEW.status = 'OPEN' THEN RAISE EXCEPTION 'BALLOT_IMMUTABLE_AFTER_SUBMIT'; END IF;
    IF OLD.status = 'REOPENED' AND NEW.status = 'OPEN' THEN RAISE EXCEPTION 'BALLOT_IMMUTABLE_AFTER_REOPEN'; END IF;
    IF OLD.status = 'SUBMITTED' AND NEW.status = 'REOPENED' THEN
      IF OLD.reopen_count >= OLD.max_reopens THEN RAISE EXCEPTION 'BALLOT_MAX_REOPENS_REACHED'; END IF;
      IF NEW.reopened_at IS NULL THEN RAISE EXCEPTION 'BALLOT_REOPEN_REASON_REQUIRED'; END IF;
      NEW.reopen_count = OLD.reopen_count + 1; NEW.status = 'REOPENED';
    END IF;
    IF OLD.status = 'REOPENED' AND NEW.status = 'SUBMITTED' THEN NEW.submitted_at = CURRENT_TIMESTAMP; END IF;
    IF OLD.status = 'OPEN' AND NEW.status = 'SUBMITTED' THEN NEW.submitted_at = CURRENT_TIMESTAMP; END IF;
    IF NEW.event_id IS DISTINCT FROM OLD.event_id OR NEW.night_id IS DISTINCT FROM OLD.night_id
       OR NEW.judge_assignment_id IS DISTINCT FROM OLD.judge_assignment_id
       OR NEW.judge_profile_id IS DISTINCT FROM OLD.judge_profile_id
       OR NEW.specialty_id IS DISTINCT FROM OLD.specialty_id OR NEW.created_at IS DISTINCT FROM OLD.created_at THEN
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
    IF assignment_matches IS DISTINCT FROM true THEN RAISE EXCEPTION 'BALLOT_ASSIGNMENT_MISMATCH'; END IF;
  END IF;
  IF TG_OP = 'UPDATE' THEN
    IF NEW.max_reopens IS DISTINCT FROM OLD.max_reopens THEN RAISE EXCEPTION 'BALLOT_HISTORY_IMMUTABLE'; END IF;
    IF NEW.status IS DISTINCT FROM OLD.status
       AND NOT (
         (OLD.status = 'OPEN' AND NEW.status IN ('SUBMITTED', 'REPLACED'))
         OR (OLD.status = 'REOPENED' AND NEW.status IN ('SUBMITTED', 'REPLACED'))
       ) THEN
      RAISE EXCEPTION 'INVALID_BALLOT_TRANSITION';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

UPDATE ballot b SET status = 'REPLACED', replaced_at = clock_timestamp(),
  replacement_reason = 'SUPPLENTE_STANDBY_POLICY_MIGRATION'
FROM judge_assignment a
WHERE a.id = b.judge_assignment_id AND a.assignment_type = 'SUBSTITUTE'
  AND b.status IN ('OPEN', 'REOPENED');
