-- 054_tie_breaker_ceremonial_draw_unique.sql
-- Spec 011 — Sorteo ceremonial con conteo regresivo.
-- Garantiza que solo pueda existir UN sorteo ceremonial por evento.
-- Refuerza RF-104 (reversibilidad cero) a nivel de base de datos, no solo de aplicación.

CREATE UNIQUE INDEX audit_event_one_ceremonial_draw_per_event
  ON audit_event (entity_id)
  WHERE action = 'RESULTS_TIE_BREAKER_CEREMONIAL_DRAW'
    AND entity_type = 'results';
