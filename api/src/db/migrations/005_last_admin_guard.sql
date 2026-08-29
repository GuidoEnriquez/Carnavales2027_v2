CREATE FUNCTION prevent_last_admin_removal()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  remaining_admin_count INTEGER;
BEGIN
  IF OLD.role_code <> 'ADMIN' THEN
    RETURN OLD;
  END IF;

  PERFORM pg_advisory_xact_lock(hashtext('carnavales2027_v2_last_admin'));
  SELECT COUNT(*) INTO remaining_admin_count
  FROM user_role
  WHERE role_code = 'ADMIN'
    AND user_id <> OLD.user_id;

  IF remaining_admin_count = 0 THEN
    RAISE EXCEPTION 'LAST_ADMIN_REQUIRED';
  END IF;

  RETURN OLD;
END;
$$;

CREATE TRIGGER user_role_prevent_last_admin_removal
BEFORE DELETE ON user_role
FOR EACH ROW
EXECUTE FUNCTION prevent_last_admin_removal();
