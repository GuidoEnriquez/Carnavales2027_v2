ALTER TABLE judge_invitation
  ADD COLUMN acceptance_claim_id UUID,
  ADD COLUMN acceptance_claimed_at TIMESTAMPTZ,
  ADD CONSTRAINT judge_invitation_claim_pair_ck CHECK (
    (acceptance_claim_id IS NULL) = (acceptance_claimed_at IS NULL)
  );

CREATE OR REPLACE FUNCTION protect_judge_invitation_history()
RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'JUDGE_INVITATION_DELETE_FORBIDDEN';
  END IF;

  IF NEW.id IS DISTINCT FROM OLD.id
     OR NEW.judge_profile_id IS DISTINCT FROM OLD.judge_profile_id
     OR NEW.secret_hash IS DISTINCT FROM OLD.secret_hash
     OR NEW.expires_at IS DISTINCT FROM OLD.expires_at
     OR NEW.created_by IS DISTINCT FROM OLD.created_by
     OR NEW.created_at IS DISTINCT FROM OLD.created_at THEN
    RAISE EXCEPTION 'JUDGE_INVITATION_HISTORY_IMMUTABLE';
  END IF;

  IF OLD.status <> 'PENDING' THEN
    IF NEW.status IS DISTINCT FROM OLD.status
       OR NEW.used_at IS DISTINCT FROM OLD.used_at
       OR NEW.revoked_at IS DISTINCT FROM OLD.revoked_at
       OR NEW.revoked_by IS DISTINCT FROM OLD.revoked_by
       OR NEW.acceptance_claim_id IS DISTINCT FROM OLD.acceptance_claim_id
       OR NEW.acceptance_claimed_at IS DISTINCT FROM OLD.acceptance_claimed_at
       OR OLD.delivery_status <> 'PENDING'
       OR NEW.delivery_status NOT IN ('SENT', 'FAILED') THEN
      RAISE EXCEPTION 'JUDGE_INVITATION_FINAL';
    END IF;
    RETURN NEW;
  END IF;

  IF NEW.status NOT IN ('PENDING', 'USED', 'REVOKED') THEN
    RAISE EXCEPTION 'INVALID_JUDGE_INVITATION_STATUS';
  END IF;
  IF (NEW.acceptance_claim_id IS NULL) <> (NEW.acceptance_claimed_at IS NULL) THEN
    RAISE EXCEPTION 'INVALID_JUDGE_INVITATION_CLAIM';
  END IF;
  IF NEW.status = 'PENDING' AND (
    NEW.used_at IS NOT NULL OR NEW.revoked_at IS NOT NULL OR NEW.revoked_by IS NOT NULL
  ) THEN
    RAISE EXCEPTION 'INVALID_JUDGE_INVITATION_STATUS';
  END IF;
  IF NEW.status = 'USED' AND (
    NEW.used_at IS NULL OR NEW.revoked_at IS NOT NULL OR NEW.revoked_by IS NOT NULL
    OR NEW.acceptance_claim_id IS NULL
  ) THEN
    RAISE EXCEPTION 'INVALID_JUDGE_INVITATION_STATUS';
  END IF;
  IF NEW.status = 'REVOKED' AND (
    NEW.revoked_at IS NULL OR NEW.revoked_by IS NULL OR NEW.used_at IS NOT NULL
  ) THEN
    RAISE EXCEPTION 'INVALID_JUDGE_INVITATION_STATUS';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
