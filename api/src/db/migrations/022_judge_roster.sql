INSERT INTO app_role (code, description)
VALUES ('JUDGE', 'Jurado incorporado al padrón')
ON CONFLICT (code) DO NOTHING;

CREATE TABLE judge_profile (
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

CREATE UNIQUE INDEX judge_profile_email_uq ON judge_profile (lower(email));
CREATE UNIQUE INDEX judge_profile_document_uq ON judge_profile (document_number);

CREATE OR REPLACE FUNCTION protect_judge_profile_history()
RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'JUDGE_PROFILE_DELETE_FORBIDDEN';
  END IF;

  IF NEW.registration_status <> OLD.registration_status AND NOT (
    (OLD.registration_status = 'INVITED' AND NEW.registration_status = 'REGISTERED')
    OR (OLD.registration_status = 'REGISTERED' AND NEW.registration_status = 'SUSPENDED')
    OR (OLD.registration_status = 'SUSPENDED' AND NEW.registration_status = 'REGISTERED')
  ) THEN
    RAISE EXCEPTION 'INVALID_JUDGE_STATUS';
  END IF;

  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER judge_profile_history_guard
BEFORE UPDATE OR DELETE ON judge_profile
FOR EACH ROW EXECUTE FUNCTION protect_judge_profile_history();
