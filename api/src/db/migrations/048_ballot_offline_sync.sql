ALTER TABLE ballot
  ADD COLUMN revision BIGINT NOT NULL DEFAULT 0 CHECK (revision >= 0);

CREATE TABLE ballot_sync_operation (
  actor_user_id TEXT NOT NULL,
  ballot_id UUID NOT NULL REFERENCES ballot(id) ON DELETE RESTRICT,
  operation_id UUID NOT NULL,
  operation_type TEXT NOT NULL CHECK (operation_type IN ('SAVE_SCORE', 'SUBMIT_BALLOT')),
  content_hash TEXT NOT NULL CHECK (length(content_hash) = 64),
  applied_revision BIGINT NOT NULL CHECK (applied_revision >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (actor_user_id, ballot_id, operation_id)
);

CREATE INDEX ballot_sync_operation_ballot_idx
  ON ballot_sync_operation (ballot_id, created_at);

CREATE OR REPLACE FUNCTION protect_ballot_sync_operation()
RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'BALLOT_SYNC_OPERATION_IMMUTABLE';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER ballot_sync_operation_guard
BEFORE UPDATE OR DELETE ON ballot_sync_operation
FOR EACH ROW EXECUTE FUNCTION protect_ballot_sync_operation();
