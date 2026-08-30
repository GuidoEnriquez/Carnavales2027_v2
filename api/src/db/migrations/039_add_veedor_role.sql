INSERT INTO app_role (code, description)
VALUES ('VEEDOR', 'Supervisión operativa de planillas sin acceso a puntajes')
ON CONFLICT (code) DO NOTHING;
