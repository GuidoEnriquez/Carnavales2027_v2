INSERT INTO app_role (code, description)
VALUES ('COMISARIO', 'Control de reglamento, horarios y carga de penalizaciones')
ON CONFLICT (code) DO NOTHING;
