-- Spec 011: la cadena comienza aquí sin reescribir auditoría histórica.
ALTER TABLE audit_event
  ADD COLUMN hash_chain_version SMALLINT,
  ADD COLUMN previous_hash CHAR(64),
  ADD COLUMN event_hash CHAR(64),
  ADD CONSTRAINT audit_event_ceremonial_hash_fields
    CHECK (
      (action <> 'RESULTS_TIE_BREAKER_CEREMONIAL_DRAW'
        AND hash_chain_version IS NULL
        AND previous_hash IS NULL
        AND event_hash IS NULL)
      OR
      (action = 'RESULTS_TIE_BREAKER_CEREMONIAL_DRAW'
        AND hash_chain_version = 1
        AND previous_hash ~ '^[0-9a-f]{64}$'
        AND event_hash ~ '^[0-9a-f]{64}$')
    );

CREATE TABLE ceremonial_draw_hash_chain_head (
  singleton BOOLEAN PRIMARY KEY DEFAULT TRUE CHECK (singleton),
  last_audit_event_id UUID,
  last_hash CHAR(64) NOT NULL DEFAULT repeat('0', 64),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO ceremonial_draw_hash_chain_head (singleton)
VALUES (TRUE)
ON CONFLICT (singleton) DO NOTHING;
