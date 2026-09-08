-- Spec 021: Color de identidad visual por comparsa para la planilla del jurado
ALTER TABLE event_troupe
  ADD COLUMN IF NOT EXISTS brand_color VARCHAR(32);

ALTER TABLE event_troupe
  DROP CONSTRAINT IF EXISTS event_troupe_brand_color_format;

ALTER TABLE event_troupe
  ADD CONSTRAINT event_troupe_brand_color_format
    CHECK (brand_color IS NULL OR brand_color ~ '^#[0-9A-Fa-f]{6}$');
