-- 056_consolidate_escribano_into_scrutineer.sql
-- Spec 011 — Escrutador y Escribano son el mismo rol operativo.
-- Se conserva SCRUTINEER como identificador técnico canónico.

INSERT INTO user_role (user_id, role_code)
SELECT user_id, 'SCRUTINEER'
FROM user_role
WHERE role_code = 'ESCRIBANO'
ON CONFLICT (user_id, role_code) DO NOTHING;

DELETE FROM user_role
WHERE role_code = 'ESCRIBANO';

DELETE FROM app_role
WHERE code = 'ESCRIBANO';
