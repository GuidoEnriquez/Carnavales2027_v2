-- 075_carnival_event_active.sql
-- T09d: eliminacion logica de eventos. La accion Eliminar oculta en UI
-- y conserva el registro con active=false; sin cascada fisica ni tabla paralela.
ALTER TABLE carnival_event
  ADD COLUMN IF NOT EXISTS active BOOLEAN NOT NULL DEFAULT true;
