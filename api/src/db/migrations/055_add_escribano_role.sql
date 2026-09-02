-- 055_add_escribano_role.sql
-- Spec 011 — El rol ESCRIBANO participa del escrutinio y del sorteo ceremonial.

INSERT INTO app_role (code, description)
VALUES ('ESCRIBANO', 'Opera escrutinio y registra sorteos ceremoniales')
ON CONFLICT (code) DO NOTHING;
