CREATE TABLE carnival_event (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'CONFIGURING'
    CHECK (status IN ('CONFIGURING', 'OPEN')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE night (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES carnival_event(id) ON DELETE RESTRICT,
  name TEXT NOT NULL,
  display_order INTEGER NOT NULL CHECK (display_order > 0),
  event_date DATE,
  kind TEXT NOT NULL CHECK (kind IN ('COMPETITION', 'AWARDS')),
  status TEXT NOT NULL DEFAULT 'DRAFT'
    CHECK (status IN ('DRAFT', 'OPEN', 'CLOSED')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT night_event_display_order_unique UNIQUE (event_id, display_order)
);

CREATE INDEX night_event_id_idx ON night (event_id);
