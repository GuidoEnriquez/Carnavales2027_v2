-- Spec 019: Cadena de integridad criptográfica general para audit_event.
-- Permite que todos los eventos lleven hash_chain_version = 2 mientras preserva
-- los eventos históricos sin cadena (NULL) y los sorteos ceremoniales (versión 1).

ALTER TABLE audit_event
  DROP CONSTRAINT IF EXISTS audit_event_ceremonial_hash_fields;

ALTER TABLE audit_event
  ADD CONSTRAINT audit_event_hash_chain_fields
    CHECK (
      -- Eventos históricos pre-cadena
      (hash_chain_version IS NULL
        AND previous_hash IS NULL
        AND event_hash IS NULL)
      OR
      -- Spec 011: Sorteo ceremonial histórico (versión 1)
      (action = 'RESULTS_TIE_BREAKER_CEREMONIAL_DRAW'
        AND hash_chain_version = 1
        AND previous_hash ~ '^[0-9a-f]{64}$'
        AND event_hash ~ '^[0-9a-f]{64}$')
      OR
      -- Spec 019: Cadena de integridad criptográfica general (versión 2)
      (hash_chain_version = 2
        AND previous_hash ~ '^[0-9a-f]{64}$'
        AND event_hash ~ '^[0-9a-f]{64}$')
    );

CREATE TABLE IF NOT EXISTS general_audit_hash_chain_head (
  singleton BOOLEAN PRIMARY KEY DEFAULT TRUE CHECK (singleton),
  last_audit_event_id UUID,
  last_hash CHAR(64) NOT NULL DEFAULT repeat('0', 64),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO general_audit_hash_chain_head (singleton)
VALUES (TRUE)
ON CONFLICT (singleton) DO NOTHING;
