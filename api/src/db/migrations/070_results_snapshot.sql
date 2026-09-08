-- Migración 070 — Spec 024: Snapshots públicos de resultados
-- Tabla inmutable versionada para servir resultados consolidados oficiales a la ciudadanía y medios
-- sin consultar las tablas transaccionales de votación ni violar el secreto de voto.

CREATE TABLE IF NOT EXISTS results_snapshot (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES carnival_event(id) ON DELETE CASCADE,
  version INTEGER NOT NULL DEFAULT 1,
  snapshot_hash VARCHAR(64) NOT NULL,
  payload JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_results_snapshot_event_version UNIQUE (event_id, version)
);

CREATE INDEX IF NOT EXISTS idx_results_snapshot_event_latest
  ON results_snapshot (event_id, version DESC);

-- Trigger de inmutabilidad estricta: prohíbe UPDATE y DELETE
CREATE OR REPLACE FUNCTION guard_results_snapshot_immutable()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    RAISE EXCEPTION 'RESULTS_SNAPSHOT_IMMUTABLE_NO_UPDATE';
  END IF;
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'RESULTS_SNAPSHOT_IMMUTABLE_NO_DELETE';
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_results_snapshot_immutable ON results_snapshot;
CREATE TRIGGER trg_results_snapshot_immutable
BEFORE UPDATE OR DELETE ON results_snapshot
FOR EACH ROW
EXECUTE FUNCTION guard_results_snapshot_immutable();
