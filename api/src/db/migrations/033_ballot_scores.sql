CREATE TABLE ballot_score (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ballot_id UUID NOT NULL,
  event_id UUID NOT NULL,
  evaluation_item_id UUID NOT NULL,
  rubric_id UUID NOT NULL,
  night_schedule_id UUID NOT NULL,
  score INTEGER CHECK (score BETWEEN 0 AND 10),
  requires_subsanation BOOLEAN NOT NULL DEFAULT false,
  subsidized_score INTEGER,
  status TEXT NOT NULL DEFAULT 'DRAFT'
    CHECK (status IN ('DRAFT', 'LOCKED')),
  locked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT ballot_score_ballot_fk
    FOREIGN KEY (ballot_id, event_id)
    REFERENCES ballot(id, event_id) ON DELETE RESTRICT,
  CONSTRAINT ballot_score_item_event_fk
    FOREIGN KEY (evaluation_item_id, event_id)
    REFERENCES evaluation_item(id, event_id) ON DELETE RESTRICT,
  CONSTRAINT ballot_score_rubric_event_fk
    FOREIGN KEY (rubric_id, event_id)
    REFERENCES rubric(id, event_id) ON DELETE RESTRICT,
  CONSTRAINT ballot_score_schedule_event_fk
    FOREIGN KEY (night_schedule_id, event_id)
    REFERENCES night_troupe_schedule(id, event_id) ON DELETE RESTRICT,
  CONSTRAINT ballot_score_one_per_item UNIQUE (ballot_id, evaluation_item_id),
  CONSTRAINT ballot_score_subsanation_ck CHECK (
    (requires_subsanation = false AND subsidized_score IS NULL)
    OR (requires_subsanation = true AND subsidized_score IS NOT NULL)
  )
);

CREATE INDEX ballot_score_ballot_idx ON ballot_score (ballot_id);
