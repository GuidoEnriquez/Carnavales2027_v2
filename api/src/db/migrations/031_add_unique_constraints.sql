DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'judge_assignment_id_event_unique') THEN
    ALTER TABLE judge_assignment ADD CONSTRAINT judge_assignment_id_event_unique UNIQUE (id, event_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'evaluation_item_id_event_unique') THEN
    ALTER TABLE evaluation_item ADD CONSTRAINT evaluation_item_id_event_unique UNIQUE (id, event_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'night_troupe_schedule_id_event_unique') THEN
    ALTER TABLE night_troupe_schedule ADD CONSTRAINT night_troupe_schedule_id_event_unique UNIQUE (id, event_id);
  END IF;
END $$;
