-- Preserva ESCRIBANO para instalaciones donde una revisión local anterior lo
-- hubiera consolidado erróneamente dentro de SCRUTINEER.
INSERT INTO app_role (code, description)
VALUES ('ESCRIBANO', 'Opera escrutinio y registra sorteos ceremoniales')
ON CONFLICT (code) DO NOTHING;
