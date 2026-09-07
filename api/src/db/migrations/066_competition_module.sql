-- Spec 017 / T02: hierarchy and metadata for competition configuration.
-- State machines remain deferred until the opening transition is clarified.

-- Preserve the existing classification data while adopting the new name.
ALTER TABLE rubric DROP CONSTRAINT rubric_rubric_kind_check;
ALTER TABLE rubric RENAME COLUMN rubric_kind TO rubric_type;
ALTER TABLE rubric
  ADD CONSTRAINT rubric_rubric_type_check
  CHECK (rubric_type IN ('NOMINATIVE', 'RANDOM', 'GENERAL', 'CALCULATED', 'SPECIAL'));

COMMENT ON COLUMN rubric.rubric_type IS
  'NOMINATIVE participates in Best Troupe. Other types do not participate unless a later approved spec says otherwise.';

ALTER TABLE rubric
  ADD COLUMN resolution_method TEXT NOT NULL DEFAULT 'JURY'
    CHECK (resolution_method IN ('JURY', 'COMMITTEE', 'AUTOMATIC', 'ADMINISTRATIVE')),
  ADD COLUMN evaluation_objective TEXT;

COMMENT ON COLUMN rubric.resolution_method IS
  'Configuration metadata only in Spec 017; it does not execute formulas or administrative decisions.';

-- Existing items did not have an explicit order. Assign a stable order by code.
ALTER TABLE evaluation_item
  ADD COLUMN display_order INTEGER,
  ADD COLUMN required BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN allow_not_presented BOOLEAN NOT NULL DEFAULT true;

ALTER TABLE evaluation_item DISABLE TRIGGER evaluation_item_requires_configuring_event;

WITH ordered_items AS (
  SELECT id, row_number() OVER (PARTITION BY rubric_id ORDER BY code, id)::INTEGER AS display_order
  FROM evaluation_item
)
UPDATE evaluation_item item
SET display_order = ordered.display_order
FROM ordered_items ordered
WHERE ordered.id = item.id;

ALTER TABLE evaluation_item ENABLE TRIGGER evaluation_item_requires_configuring_event;

ALTER TABLE evaluation_item
  ALTER COLUMN display_order SET NOT NULL,
  ALTER COLUMN display_order SET DEFAULT 0,
  ADD CONSTRAINT evaluation_item_display_order_check CHECK (display_order > 0),
  ADD CONSTRAINT evaluation_item_rubric_display_order_unique UNIQUE (rubric_id, display_order),
  ADD CONSTRAINT evaluation_item_id_rubric_event_unique UNIQUE (id, rubric_id, event_id);

-- Keep legacy inserts compatible while serializing order allocation through the
-- existing event-row lock acquired by the configuration guard.
CREATE FUNCTION assign_evaluation_item_display_order()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.display_order IS NULL OR NEW.display_order <= 0 THEN
    SELECT COALESCE(MAX(display_order), 0) + 1
      INTO NEW.display_order
      FROM evaluation_item
     WHERE rubric_id = NEW.rubric_id;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER zz_evaluation_item_assign_display_order
BEFORE INSERT ON evaluation_item
FOR EACH ROW EXECUTE FUNCTION assign_evaluation_item_display_order();

-- Nullable only for historical rows that cannot be assigned unambiguously.
ALTER TABLE rubric_criterion
  ADD COLUMN scoring_item_id UUID;

ALTER TABLE rubric_criterion DISABLE TRIGGER rubric_criterion_requires_configuring_event;

WITH single_active_item AS (
  SELECT rubric_id, (array_agg(id ORDER BY id))[1] AS item_id
  FROM evaluation_item
  WHERE active
  GROUP BY rubric_id
  HAVING COUNT(*) = 1
)
UPDATE rubric_criterion criterion
SET scoring_item_id = item.item_id
FROM single_active_item item
WHERE criterion.rubric_id = item.rubric_id
  AND criterion.scoring_item_id IS NULL;

ALTER TABLE rubric_criterion ENABLE TRIGGER rubric_criterion_requires_configuring_event;

ALTER TABLE rubric_criterion
  ADD CONSTRAINT rubric_criterion_scoring_item_fk
  FOREIGN KEY (scoring_item_id, rubric_id, event_id)
  REFERENCES evaluation_item(id, rubric_id, event_id)
  ON DELETE RESTRICT;

CREATE INDEX rubric_criterion_unassigned_idx
  ON rubric_criterion(event_id, rubric_id)
  WHERE scoring_item_id IS NULL;

COMMENT ON COLUMN rubric_criterion.scoring_item_id IS
  'Required for new criteria. NULL is reserved for preserved historical criteria pending explicit reassignment.';
