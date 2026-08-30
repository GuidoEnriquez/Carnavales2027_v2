CREATE TABLE ballot (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES carnival_event(id) ON DELETE RESTRICT,
  night_id UUID NOT NULL,
  judge_assignment_id UUID NOT NULL,
  judge_profile_id UUID NOT NULL REFERENCES judge_profile(id) ON DELETE RESTRICT,
  specialty_id UUID NOT NULL,
  status TEXT NOT NULL DEFAULT 'OPEN'
    CHECK (status IN ('OPEN', 'SUBMITTED', 'REOPENED')),
  opened_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  submitted_at TIMESTAMPTZ,
  reopened_at TIMESTAMPTZ,
  reopen_count INTEGER NOT NULL DEFAULT 0,
  max_reopens INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT ballot_assignment_fk
    FOREIGN KEY (judge_assignment_id, event_id)
    REFERENCES judge_assignment(id, event_id) ON DELETE RESTRICT,
  CONSTRAINT ballot_night_event_fk
    FOREIGN KEY (night_id, event_id)
    REFERENCES night(id, event_id) ON DELETE RESTRICT,
  CONSTRAINT ballot_specialty_event_fk
    FOREIGN KEY (specialty_id, event_id)
    REFERENCES event_specialty(id, event_id) ON DELETE RESTRICT,
  CONSTRAINT ballot_one_per_judge_night UNIQUE (judge_profile_id, night_id),
  CONSTRAINT ballot_id_event_unique UNIQUE (id, event_id)
);

CREATE INDEX ballot_event_night_idx ON ballot (event_id, night_id);
CREATE INDEX ballot_judge_idx ON ballot (judge_profile_id);
