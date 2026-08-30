CREATE TABLE judge_invitation (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  judge_profile_id UUID NOT NULL REFERENCES judge_profile(id) ON DELETE RESTRICT,
  secret_hash CHAR(64) NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'PENDING'
    CHECK (status IN ('PENDING', 'USED', 'REVOKED')),
  expires_at TIMESTAMPTZ NOT NULL,
  created_by TEXT NOT NULL REFERENCES "user"(id) ON DELETE RESTRICT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  used_at TIMESTAMPTZ,
  revoked_at TIMESTAMPTZ,
  revoked_by TEXT REFERENCES "user"(id) ON DELETE RESTRICT,
  delivery_status TEXT NOT NULL DEFAULT 'PENDING'
    CHECK (delivery_status IN ('PENDING', 'SENT', 'FAILED')),
  sent_at TIMESTAMPTZ,
  CHECK (expires_at > created_at),
  CHECK (status <> 'USED' OR used_at IS NOT NULL),
  CHECK (status <> 'REVOKED' OR revoked_at IS NOT NULL),
  CHECK (delivery_status <> 'SENT' OR sent_at IS NOT NULL)
);

CREATE UNIQUE INDEX judge_invitation_pending_uq
  ON judge_invitation (judge_profile_id)
  WHERE status = 'PENDING';

CREATE INDEX judge_invitation_profile_created_idx
  ON judge_invitation (judge_profile_id, created_at DESC);

CREATE OR REPLACE FUNCTION prevent_judge_invitation_delete()
RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'JUDGE_INVITATION_DELETE_FORBIDDEN';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER judge_invitation_delete_guard
BEFORE DELETE ON judge_invitation
FOR EACH ROW EXECUTE FUNCTION prevent_judge_invitation_delete();
