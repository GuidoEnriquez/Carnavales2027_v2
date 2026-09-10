-- Spec 017 / T09b: allow atomic presentation_order swaps within a night.
-- Only the order constraint is deferred; troupe/night uniqueness stays immediate.
ALTER TABLE night_troupe_schedule
  DROP CONSTRAINT schedule_night_order_unique,
  ADD CONSTRAINT schedule_night_order_unique
    UNIQUE (night_id, presentation_order) DEFERRABLE INITIALLY IMMEDIATE;
