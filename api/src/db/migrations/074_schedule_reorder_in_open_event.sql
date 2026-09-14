-- 074_schedule_reorder_in_open_event.sql
-- El orden de pasada debe poder corregirse el día del evento (evento OPEN).
-- Reemplaza el veto total de schedule_requires_configuring_event por uno
-- quirúrgico: INSERT/DELETE siguen exigiendo CONFIGURING; UPDATE en OPEN solo
-- puede tocar presentation_order (+ updated_at). Las guardas de negocio
-- (motivo, jornada sin votos, ADMIN+2FA) viven en el servicio, no aquí.
CREATE OR REPLACE FUNCTION schedule_reorder_guard()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  current_status TEXT;
BEGIN
  SELECT status INTO current_status
    FROM carnival_event
   WHERE id = COALESCE(NEW.event_id, OLD.event_id)
     FOR UPDATE;

  IF current_status IS DISTINCT FROM 'CONFIGURING' AND current_status IS DISTINCT FROM 'OPEN' THEN
    RAISE EXCEPTION 'EVENT_LOCKED';
  END IF;

  IF TG_OP = 'UPDATE'
     AND current_status = 'OPEN'
     AND (OLD.event_id IS DISTINCT FROM NEW.event_id
       OR OLD.night_id IS DISTINCT FROM NEW.night_id
       OR OLD.event_troupe_id IS DISTINCT FROM NEW.event_troupe_id
       OR OLD.status IS DISTINCT FROM NEW.status) THEN
    RAISE EXCEPTION 'EVENT_LOCKED';
  END IF;

  IF TG_OP <> 'UPDATE' AND current_status IS DISTINCT FROM 'CONFIGURING' THEN
    RAISE EXCEPTION 'EVENT_LOCKED';
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS schedule_requires_configuring_event ON night_troupe_schedule;
CREATE TRIGGER schedule_reorder_guard
BEFORE INSERT OR UPDATE OR DELETE ON night_troupe_schedule
FOR EACH ROW EXECUTE FUNCTION schedule_reorder_guard();
