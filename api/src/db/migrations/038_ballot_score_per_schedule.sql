ALTER TABLE ballot_score
  DROP CONSTRAINT ballot_score_one_per_item;

ALTER TABLE ballot_score
  ADD CONSTRAINT ballot_score_one_per_item_schedule
  UNIQUE (ballot_id, evaluation_item_id, night_schedule_id);
