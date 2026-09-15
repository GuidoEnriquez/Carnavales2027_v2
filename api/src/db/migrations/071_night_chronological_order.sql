-- Spec 027: Jornadas con orden cronologico automatico.
-- 1) Unicidad de fecha por evento (parcial: las jornadas historicas sin fecha se conservan).
CREATE UNIQUE INDEX night_event_date_unique
  ON night (event_id, event_date)
  WHERE event_date IS NOT NULL;

-- 2) Renumeracion por fecha (NULLS LAST), created_at e id, en dos fases para no
--    violar UNIQUE(event_id, display_order). Es mantenimiento de trama de
--    presentacion bajo el lock de migraciones; se suspende en este ciclo el
--    trigger operativo (029) solo para poder renumerar noches de eventos
--    abiertos/cerrados previos a esta spec. La regla runtime no cambia.
ALTER TABLE night DISABLE TRIGGER night_requires_operational_change;

UPDATE night
   SET display_order = display_order + 1000000;

UPDATE night AS n
   SET display_order = ranked.rn
  FROM (
    SELECT id,
           row_number() OVER (
             PARTITION BY event_id
             ORDER BY event_date NULLS LAST, created_at, id
           )::INTEGER AS rn
      FROM night
  ) AS ranked
 WHERE n.id = ranked.id;

ALTER TABLE night ENABLE TRIGGER night_requires_operational_change;