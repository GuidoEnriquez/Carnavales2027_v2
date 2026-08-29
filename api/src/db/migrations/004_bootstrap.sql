CREATE TABLE bootstrap_state (
  singleton BOOLEAN PRIMARY KEY DEFAULT true CHECK (singleton),
  initial_admin_user_id TEXT NOT NULL REFERENCES "user"(id),
  completed_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE FUNCTION prevent_bootstrap_state_mutation()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'BOOTSTRAP_STATE_IMMUTABLE';
END;
$$;

CREATE TRIGGER bootstrap_state_append_only
BEFORE UPDATE OR DELETE ON bootstrap_state
FOR EACH ROW
EXECUTE FUNCTION prevent_bootstrap_state_mutation();
