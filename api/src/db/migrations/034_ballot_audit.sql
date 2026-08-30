CREATE TABLE ballot_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ballot_id UUID NOT NULL,
  event_id UUID NOT NULL,
  action TEXT NOT NULL,
  actor_id TEXT NOT NULL,
  reason TEXT,
  details JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT ballot_audit_ballot_fk
    FOREIGN KEY (ballot_id, event_id)
    REFERENCES ballot(id, event_id) ON DELETE RESTRICT
);

CREATE INDEX ballot_audit_ballot_idx ON ballot_audit_log (ballot_id);
