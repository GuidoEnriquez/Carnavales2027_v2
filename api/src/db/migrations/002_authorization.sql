CREATE TABLE app_role (
  code TEXT PRIMARY KEY,
  description TEXT NOT NULL
);

INSERT INTO app_role (code, description)
VALUES ('ADMIN', 'Administración de la configuración operativa')
ON CONFLICT (code) DO NOTHING;

CREATE TABLE user_role (
  user_id TEXT NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  role_code TEXT NOT NULL REFERENCES app_role(code),
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (user_id, role_code)
);

CREATE INDEX user_role_role_code_idx ON user_role (role_code);
