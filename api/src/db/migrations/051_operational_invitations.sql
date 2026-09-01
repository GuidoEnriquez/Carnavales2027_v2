CREATE TABLE role_invitation (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL,
  role_code TEXT NOT NULL REFERENCES app_role(code),
  token TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_by TEXT NOT NULL REFERENCES "user"(id)
);
CREATE INDEX role_invitation_token_idx ON role_invitation(token);
