-- ============================================================
-- 065_operational_invitation_delivery.sql
-- Agrega columnas de seguimiento de entrega de invitaciones
-- operativas para alinear con el flujo de jurados.
-- ============================================================

ALTER TABLE operational_invitation
  ADD COLUMN delivery_status TEXT NOT NULL DEFAULT 'PENDING'
    CHECK (delivery_status IN ('PENDING', 'SENT', 'FAILED')),
  ADD COLUMN sent_at TIMESTAMPTZ;

-- El trigger existente ya protege el historial; las columnas nuevas
-- se actualizan únicamente desde el servicio con UPDATES controlados.
