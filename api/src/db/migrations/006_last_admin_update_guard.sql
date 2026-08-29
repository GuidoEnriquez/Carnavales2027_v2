CREATE OR REPLACE FUNCTION prevent_last_admin_removal()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  remaining_admin_count INTEGER;
BEGIN
  IF OLD.role_code = 'ADMIN' THEN
    IF TG_OP = 'DELETE' THEN
      PERFORM pg_advisory_xact_lock(hashtext('carnavales2027_v2_last_admin'));
      SELECT COUNT(*) INTO remaining_admin_count
      FROM user_role
      WHERE role_code = 'ADMIN'
        AND user_id <> OLD.user_id;

      IF remaining_admin_count = 0 THEN
        RAISE EXCEPTION 'LAST_ADMIN_REQUIRED';
      END IF;
    ELSIF NEW.role_code <> 'ADMIN' OR NEW.user_id <> OLD.user_id THEN
      PERFORM pg_advisory_xact_lock(hashtext('carnavales2027_v2_last_admin'));
      SELECT COUNT(*) INTO remaining_admin_count
      FROM user_role
      WHERE role_code = 'ADMIN'
        AND user_id <> OLD.user_id;

      IF remaining_admin_count = 0 THEN
        RAISE EXCEPTION 'LAST_ADMIN_REQUIRED';
      END IF;
    END IF;
  END IF;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER user_role_prevent_last_admin_removal ON user_role;

CREATE TRIGGER user_role_prevent_last_admin_removal
BEFORE DELETE OR UPDATE ON user_role
FOR EACH ROW
EXECUTE FUNCTION prevent_last_admin_removal();
