-- 073_event_delete_policy.sql
-- Borrado físico de eventos restringido: solo sin votación ni historial operativo.
-- Reemplaza el bloqueo total de prevent_carnival_event_delete() por guardas
-- específicas. Los hijos solo pueden borrarse en CONFIGURING (triggers
-- require_configuring_event) y quotas/assignments son inborrables por diseño,
-- por lo que el servicio debe verificar elegibilidad antes de intentar el DELETE.

CREATE OR REPLACE FUNCTION prevent_event_category_delete()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM ballot WHERE event_id = OLD.event_id) THEN
    RAISE EXCEPTION 'CATEGORY_DELETE_FORBIDDEN';
  END IF;
  IF EXISTS (SELECT 1 FROM judge_assignment WHERE event_id = OLD.event_id) THEN
    RAISE EXCEPTION 'CATEGORY_DELETE_FORBIDDEN';
  END IF;
  RETURN OLD;
END;
$$;

CREATE OR REPLACE FUNCTION prevent_event_specialty_delete()
RETURNS TRIGGER LANGUAGE plpgsql AS $$ BEGIN
  IF EXISTS (SELECT 1 FROM ballot WHERE event_id = OLD.event_id) THEN
    RAISE EXCEPTION 'SPECIALTY_DELETE_FORBIDDEN';
  END IF;
  IF EXISTS (SELECT 1 FROM judge_assignment WHERE event_id = OLD.event_id) THEN
    RAISE EXCEPTION 'SPECIALTY_DELETE_FORBIDDEN';
  END IF;
  RETURN OLD;
END; $$;
CREATE OR REPLACE FUNCTION prevent_carnival_event_delete()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM ballot WHERE event_id = OLD.id) THEN
    RAISE EXCEPTION 'EVENT_HAS_BALLOTS';
  END IF;
  IF EXISTS (SELECT 1 FROM judge_assignment WHERE event_id = OLD.id) THEN
    RAISE EXCEPTION 'EVENT_HAS_ASSIGNMENTS';
  END IF;
  IF EXISTS (SELECT 1 FROM judge_quota WHERE event_id = OLD.id) THEN
    RAISE EXCEPTION 'EVENT_HAS_QUOTAS';
  END IF;
  IF EXISTS (SELECT 1 FROM troupe_penalty WHERE event_id = OLD.id) THEN
    RAISE EXCEPTION 'EVENT_HAS_PENALTIES';
  END IF;
  IF EXISTS (SELECT 1 FROM official_scrutiny_record WHERE event_id = OLD.id) THEN
    RAISE EXCEPTION 'EVENT_HAS_SCRUTINY_RECORD';
  END IF;
  IF EXISTS (SELECT 1 FROM results_release WHERE event_id = OLD.id) THEN
    RAISE EXCEPTION 'EVENT_HAS_RESULTS';
  END IF;
  IF EXISTS (SELECT 1 FROM results_snapshot WHERE event_id = OLD.id) THEN
    RAISE EXCEPTION 'EVENT_HAS_RESULTS';
  END IF;
  RETURN OLD;
END;
$$;
