-- ============================================================
-- 064_operational_profiles.sql
-- Perfiles operativos con nombre, DNI y ciclo de vida.
-- ============================================================

-- Tabla de perfil compartido para roles operativos
CREATE TABLE operational_profile (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT UNIQUE REFERENCES "user"(id) ON DELETE RESTRICT,
  name TEXT NOT NULL CHECK (length(trim(name)) > 0),
  email TEXT NOT NULL CHECK (length(trim(email)) > 0),
  document_number TEXT NOT NULL CHECK (length(trim(document_number)) > 0),
  registration_status TEXT NOT NULL DEFAULT 'INVITED'
    CHECK (registration_status IN ('INVITED', 'REGISTERED', 'SUSPENDED')),
  created_by TEXT NOT NULL REFERENCES "user"(id) ON DELETE RESTRICT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CHECK (registration_status = 'INVITED' OR user_id IS NOT NULL)
);

CREATE UNIQUE INDEX operational_profile_email_uq ON operational_profile (lower(email));
CREATE UNIQUE INDEX operational_profile_document_uq ON operational_profile (document_number);

-- Tabla de invitación para perfiles operativos
CREATE TABLE operational_invitation (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  operational_profile_id UUID NOT NULL REFERENCES operational_profile(id) ON DELETE RESTRICT,
  secret_hash CHAR(64) NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'PENDING'
    CHECK (status IN ('PENDING', 'USED', 'REVOKED')),
  expires_at TIMESTAMPTZ NOT NULL,
  created_by TEXT NOT NULL REFERENCES "user"(id) ON DELETE RESTRICT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  used_at TIMESTAMPTZ,
  revoked_at TIMESTAMPTZ,
  revoked_by TEXT REFERENCES "user"(id) ON DELETE RESTRICT,
  acceptance_claim_id UUID,
  acceptance_claimed_at TIMESTAMPTZ,
  CHECK (expires_at > created_at),
  CHECK (status <> 'USED' OR used_at IS NOT NULL),
  CHECK (status <> 'REVOKED' OR revoked_at IS NOT NULL),
  CHECK ((acceptance_claim_id IS NULL) = (acceptance_claimed_at IS NULL))
);

CREATE UNIQUE INDEX operational_invitation_pending_uq
  ON operational_invitation (operational_profile_id)
  WHERE status = 'PENDING';

-- Tabla puente: perfil → roles
CREATE TABLE operational_profile_role (
  operational_profile_id UUID NOT NULL REFERENCES operational_profile(id) ON DELETE RESTRICT,
  role_code TEXT NOT NULL REFERENCES app_role(code),
  granted_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (operational_profile_id, role_code)
);

-- ============================================================
-- Trigger: protect_operational_profile_history()
-- ============================================================
CREATE OR REPLACE FUNCTION protect_operational_profile_history()
RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'OPERATIONAL_PROFILE_DELETE_FORBIDDEN';
  END IF;

  IF OLD.user_id IS NOT NULL AND NEW.user_id IS DISTINCT FROM OLD.user_id THEN
    RAISE EXCEPTION 'OPERATIONAL_IDENTITY_REASSIGNMENT_FORBIDDEN';
  END IF;
  IF OLD.user_id IS NULL AND NEW.user_id IS NOT NULL
     AND NOT (OLD.registration_status = 'INVITED' AND NEW.registration_status = 'REGISTERED') THEN
    RAISE EXCEPTION 'OPERATIONAL_IDENTITY_LINK_REQUIRES_REGISTRATION';
  END IF;
  IF NEW.created_by IS DISTINCT FROM OLD.created_by
     OR NEW.created_at IS DISTINCT FROM OLD.created_at THEN
    RAISE EXCEPTION 'OPERATIONAL_PROFILE_HISTORY_IMMUTABLE';
  END IF;

  IF NEW.registration_status <> OLD.registration_status AND NOT (
    (OLD.registration_status = 'INVITED' AND NEW.registration_status = 'REGISTERED')
    OR (OLD.registration_status = 'REGISTERED' AND NEW.registration_status = 'SUSPENDED')
    OR (OLD.registration_status = 'SUSPENDED' AND NEW.registration_status = 'REGISTERED')
  ) THEN
    RAISE EXCEPTION 'INVALID_OPERATIONAL_STATUS';
  END IF;

  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER protect_operational_profile_history
  BEFORE UPDATE ON operational_profile
  FOR EACH ROW EXECUTE FUNCTION protect_operational_profile_history();

-- ============================================================
-- Trigger: protect_operational_invitation_history()
-- ============================================================
CREATE OR REPLACE FUNCTION protect_operational_invitation_history()
RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'OPERATIONAL_INVITATION_DELETE_FORBIDDEN';
  END IF;

  IF NEW.id IS DISTINCT FROM OLD.id
     OR NEW.operational_profile_id IS DISTINCT FROM OLD.operational_profile_id
     OR NEW.secret_hash IS DISTINCT FROM OLD.secret_hash
     OR NEW.expires_at IS DISTINCT FROM OLD.expires_at
     OR NEW.created_by IS DISTINCT FROM OLD.created_by
     OR NEW.created_at IS DISTINCT FROM OLD.created_at THEN
    RAISE EXCEPTION 'OPERATIONAL_INVITATION_HISTORY_IMMUTABLE';
  END IF;

  IF OLD.status <> 'PENDING' THEN
    IF NEW.status IS DISTINCT FROM OLD.status
       OR NEW.used_at IS DISTINCT FROM OLD.used_at
       OR NEW.revoked_at IS DISTINCT FROM OLD.revoked_at
       OR NEW.revoked_by IS DISTINCT FROM OLD.revoked_by
       OR NEW.acceptance_claim_id IS DISTINCT FROM OLD.acceptance_claim_id
       OR NEW.acceptance_claimed_at IS DISTINCT FROM OLD.acceptance_claimed_at THEN
      RAISE EXCEPTION 'OPERATIONAL_INVITATION_FINAL';
    END IF;
    RETURN NEW;
  END IF;

  IF NEW.status NOT IN ('PENDING', 'USED', 'REVOKED') THEN
    RAISE EXCEPTION 'INVALID_OPERATIONAL_INVITATION_STATUS';
  END IF;
  IF (NEW.acceptance_claim_id IS NULL) <> (NEW.acceptance_claimed_at IS NULL) THEN
    RAISE EXCEPTION 'INVALID_OPERATIONAL_INVITATION_CLAIM';
  END IF;
  IF NEW.status = 'PENDING' AND (
    NEW.used_at IS NOT NULL OR NEW.revoked_at IS NOT NULL OR NEW.revoked_by IS NOT NULL
  ) THEN
    RAISE EXCEPTION 'INVALID_OPERATIONAL_INVITATION_STATUS';
  END IF;
  IF NEW.status = 'USED' AND (
    NEW.used_at IS NULL OR NEW.revoked_at IS NOT NULL OR NEW.revoked_by IS NOT NULL
    OR NEW.acceptance_claim_id IS NULL
  ) THEN
    RAISE EXCEPTION 'INVALID_OPERATIONAL_INVITATION_STATUS';
  END IF;
  IF NEW.status = 'REVOKED' AND (
    NEW.revoked_at IS NULL OR NEW.revoked_by IS NULL OR NEW.used_at IS NOT NULL
  ) THEN
    RAISE EXCEPTION 'INVALID_OPERATIONAL_INVITATION_STATUS';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER protect_operational_invitation_history
  BEFORE UPDATE ON operational_invitation
  FOR EACH ROW EXECUTE FUNCTION protect_operational_invitation_history();
