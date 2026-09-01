ALTER TABLE role_invitation
  ADD COLUMN token_hash CHAR(64),
  ADD COLUMN status TEXT NOT NULL DEFAULT 'PENDING'
    CHECK (status IN ('PENDING', 'USED', 'REVOKED')),
  ADD COLUMN used_at TIMESTAMPTZ,
  ADD COLUMN revoked_at TIMESTAMPTZ,
  ADD COLUMN acceptance_claim_id UUID,
  ADD COLUMN acceptance_claimed_at TIMESTAMPTZ;

-- Existing links are intentionally revoked before removing their recoverable values.
UPDATE role_invitation
   SET token_hash = encode(digest(token, 'sha256'), 'hex'),
       status = 'REVOKED',
       revoked_at = CURRENT_TIMESTAMP;

ALTER TABLE role_invitation
  ALTER COLUMN token_hash SET NOT NULL,
  ADD CONSTRAINT role_invitation_expiry_ck CHECK (expires_at > created_at),
  ADD CONSTRAINT role_invitation_used_ck CHECK (status <> 'USED' OR used_at IS NOT NULL),
  ADD CONSTRAINT role_invitation_revoked_ck CHECK (status <> 'REVOKED' OR revoked_at IS NOT NULL),
  ADD CONSTRAINT role_invitation_claim_pair_ck CHECK (
    (acceptance_claim_id IS NULL) = (acceptance_claimed_at IS NULL)
  );

DROP INDEX role_invitation_token_idx;
ALTER TABLE role_invitation DROP COLUMN token;
CREATE UNIQUE INDEX role_invitation_token_hash_uq ON role_invitation(token_hash);
