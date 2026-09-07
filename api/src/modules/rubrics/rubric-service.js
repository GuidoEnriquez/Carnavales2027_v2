import { getPool } from "../../db/pool.js";
import { auditEvent } from "../../audit/audit-service.js";
import { requireConfiguringEvent, requireEventExists } from "../events/event-service.js";

const EVALUATION_TARGETS = new Set(["TROUPE", "NOMINATION"]);
const SUBJECT_TYPES = new Set(["PERSON", "COUPLE", "GROUP", "FIGURE", "ELEMENT", "OTHER"]);
const RUBRIC_TYPES = new Set(["NOMINATIVE", "RANDOM", "GENERAL", "CALCULATED", "SPECIAL"]);
const RESOLUTION_METHODS = new Set(["JURY", "COMMITTEE", "AUTOMATIC", "ADMINISTRATIVE"]);

function text(value, name) {
  if (typeof value !== "string" || !value.trim()) throw new TypeError(`${name} debe ser texto no vacío.`);
  return value.trim();
}

function order(value) {
  if (!Number.isInteger(value) || value <= 0) throw new TypeError("displayOrder debe ser entero positivo.");
  return value;
}

function itemOrder(value) {
  return value === undefined ? 0 : order(value);
}

async function inTransaction(operation) {
  const client = await getPool().connect();
  try {
    await client.query("BEGIN");
    const result = await operation(client);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

async function lockConfigurationParent(client, table, id) {
  // Discover only the event before locking; re-read the child after the event lock.
  // Table names are internal constants, never request input.
  const { rows: parents } = await client.query(`SELECT event_id FROM ${table} WHERE id=$1`, [text(id, "id")]);
  if (!parents[0]) throw new Error(`${table.toUpperCase()}_NOT_FOUND`);
  const eventId = parents[0].event_id;
  const { rows: events } = await client.query("SELECT status FROM carnival_event WHERE id=$1 FOR UPDATE", [eventId]);
  if (!events[0]) throw new Error("EVENT_NOT_FOUND");
  if (events[0].status !== "CONFIGURING") throw new Error("EVENT_LOCKED");
  const { rows } = await client.query(`SELECT * FROM ${table} WHERE id=$1 AND event_id=$2 FOR UPDATE`, [id, eventId]);
  if (!rows[0]) throw new Error(`${table.toUpperCase()}_NOT_FOUND`);
  return rows[0];
}

function boolean(value, name) {
  if (typeof value !== "boolean") throw new TypeError(`${name} debe ser booleano.`);
  return value;
}

function rubricType(value) {
  const t = value === undefined ? "NOMINATIVE" : text(value, "rubricType");
  if (!RUBRIC_TYPES.has(t)) throw new TypeError("rubricType inválido.");
  return t;
}

function resolutionMethod(value) {
  const m = value === undefined ? "JURY" : text(value, "resolutionMethod");
  if (!RESOLUTION_METHODS.has(m)) throw new TypeError("resolutionMethod inválido.");
  return m;
}

function rubricValues({ name, code, evaluationTarget, expectedSubjectType, active = true, rubricType: type = "NOMINATIVE", resolutionMethod: method = "JURY", evaluationObjective = null }) {
  const target = text(evaluationTarget, "evaluationTarget");
  if (!EVALUATION_TARGETS.has(target)) throw new TypeError("evaluationTarget inválido.");
  let subjectType = null;
  if (target === "NOMINATION") {
    subjectType = text(expectedSubjectType, "expectedSubjectType");
    if (!SUBJECT_TYPES.has(subjectType)) throw new TypeError("expectedSubjectType inválido.");
  } else if (expectedSubjectType !== null && expectedSubjectType !== undefined) {
    throw new TypeError("expectedSubjectType solo aplica a NOMINATION.");
  }
  return {
    name: text(name, "name"),
    code: text(code, "code"),
    evaluationTarget: target,
    expectedSubjectType: subjectType,
    active: boolean(active, "active"),
    rubricType: rubricType(type),
    resolutionMethod: resolutionMethod(method),
    evaluationObjective: evaluationObjective === null || evaluationObjective === undefined ? null : text(evaluationObjective, "evaluationObjective"),
  };
}

export async function createRubric({ client = getPool(), eventId, ...input }) {
  await requireConfiguringEvent({ client, eventId });
  const values = rubricValues(input);
  const { rows } = await client.query(
    `INSERT INTO rubric(event_id,name,code,evaluation_target,expected_subject_type,active,rubric_type,resolution_method,evaluation_objective)
     VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9)
     RETURNING id,event_id AS "eventId",name,code,evaluation_target AS "evaluationTarget",
               expected_subject_type AS "expectedSubjectType",active,rubric_type AS "rubricType",
               resolution_method AS "resolutionMethod",evaluation_objective AS "evaluationObjective"`,
    [text(eventId, "eventId"), values.name, values.code, values.evaluationTarget, values.expectedSubjectType, values.active, values.rubricType, values.resolutionMethod, values.evaluationObjective],
  );
  return rows[0];
}

export async function listRubrics({ client = getPool(), eventId }) {
  await requireEventExists({ client, eventId });
  const { rows } = await client.query(
    `SELECT id, event_id AS "eventId", name, code, evaluation_target AS "evaluationTarget",
            expected_subject_type AS "expectedSubjectType", active, rubric_type AS "rubricType",
            resolution_method AS "resolutionMethod", evaluation_objective AS "evaluationObjective"
       FROM rubric
      WHERE event_id = $1
      ORDER BY code`,
    [text(eventId, "eventId")],
  );
  const rubrics = [];
  for (const row of rows) rubrics.push(await getRubric({ client, rubricId: row.id }));
  return rubrics;
}

export async function getRubric({ client = getPool(), rubricId }) {
  const { rows } = await client.query(
    `SELECT id, event_id AS "eventId", name, code, evaluation_target AS "evaluationTarget",
            expected_subject_type AS "expectedSubjectType", active, rubric_type AS "rubricType",
            resolution_method AS "resolutionMethod", evaluation_objective AS "evaluationObjective"
       FROM rubric WHERE id=$1`,
    [text(rubricId, "rubricId")],
  );
  if (!rows[0]) return null;
  const items = await listItems({ client, rubricId });
  const criteria = await listCriteria({ client, rubricId });
  const { rows: specialties } = await client.query(
    `SELECT DISTINCT s.id, s.code, s.name
       FROM evaluation_item i
       JOIN event_specialty s ON s.id=i.specialty_id
      WHERE i.rubric_id=$1 AND i.active AND s.active
      ORDER BY s.code`,
    [rubricId],
  );
  return { ...rows[0], items, criteria, specialties };
}

export async function updateRubric({ client = null, rubricId, ...input }) {
  if (!client) return inTransaction((client) => updateRubric({ ...input, client, rubricId }));
  await lockConfigurationParent(client, "rubric", rubricId);
  const { rows } = await client.query(
    `SELECT id,event_id AS "eventId",name,code,evaluation_target AS "evaluationTarget",
            expected_subject_type AS "expectedSubjectType",active,rubric_type AS "rubricType",
            resolution_method AS "resolutionMethod",evaluation_objective AS "evaluationObjective"
       FROM rubric WHERE id=$1 FOR UPDATE`,
    [text(rubricId, "rubricId")],
  );
  const current = rows[0];
  if (!current) throw new Error("RUBRIC_NOT_FOUND");
  if (input.active !== undefined) boolean(input.active, "active");
  const values = rubricValues({
    name: input.name === undefined ? current.name : input.name,
    code: input.code === undefined ? current.code : input.code,
    evaluationTarget: input.evaluationTarget === undefined ? current.evaluationTarget : input.evaluationTarget,
    expectedSubjectType: input.evaluationTarget === "TROUPE" && input.expectedSubjectType === undefined
      ? null
      : input.expectedSubjectType === undefined ? current.expectedSubjectType : input.expectedSubjectType,
    active: input.active === undefined ? current.active : input.active,
    rubricType: input.rubricType === undefined ? current.rubricType : input.rubricType,
    resolutionMethod: input.resolutionMethod === undefined ? current.resolutionMethod : input.resolutionMethod,
    evaluationObjective: input.evaluationObjective === undefined ? current.evaluationObjective : input.evaluationObjective,
  });
  const { rows: updatedRows } = await client.query(
    `UPDATE rubric SET name=$2,code=$3,evaluation_target=$4,expected_subject_type=$5,active=$6,
                       rubric_type=$7,resolution_method=$8,evaluation_objective=$9,
                       updated_at=CURRENT_TIMESTAMP
      WHERE id=$1
      RETURNING id,event_id AS "eventId",name,code,evaluation_target AS "evaluationTarget",
                expected_subject_type AS "expectedSubjectType",active,rubric_type AS "rubricType",
                resolution_method AS "resolutionMethod",evaluation_objective AS "evaluationObjective"`,
    [rubricId, values.name, values.code, values.evaluationTarget, values.expectedSubjectType, values.active, values.rubricType, values.resolutionMethod, values.evaluationObjective],
  );
  return updatedRows[0];
}

export async function createItem({ client = null, rubricId, name, code, specialtyId, displayOrder, required = true, allowNotPresented = true }) {
  if (!client) return inTransaction((client) => createItem({ client, rubricId, name, code, specialtyId, displayOrder, required, allowNotPresented }));
  const rubric = await lockConfigurationParent(client, "rubric", rubricId);
  if (typeof required !== "boolean") throw new TypeError("required debe ser booleano.");
  if (typeof allowNotPresented !== "boolean") throw new TypeError("allowNotPresented debe ser booleano.");
  const { rows } = await client.query(
    `INSERT INTO evaluation_item(event_id,rubric_id,specialty_id,name,code,display_order,required,allow_not_presented) VALUES($1,$2,$3,$4,$5,$6,$7,$8)
     RETURNING id,rubric_id AS "rubricId",specialty_id AS "specialtyId",name,code,active,
               display_order AS "displayOrder",required,allow_not_presented AS "allowNotPresented"`,
    [rubric.event_id, rubricId, text(specialtyId, "specialtyId"), text(name, "name"), text(code, "code"), itemOrder(displayOrder), required, allowNotPresented],
  );
  return rows[0];
}

export async function listItems({ client = getPool(), rubricId }) {
  const { rows } = await client.query(
    `SELECT i.id,i.rubric_id AS "rubricId",i.specialty_id AS "specialtyId",i.name,i.code,i.active,
            i.display_order AS "displayOrder",i.required,i.allow_not_presented AS "allowNotPresented",
            s.name AS "specialtyName",s.code AS "specialtyCode"
       FROM evaluation_item i
       JOIN event_specialty s ON s.id=i.specialty_id
      WHERE i.rubric_id=$1
      ORDER BY i.display_order, i.code`,
    [text(rubricId, "rubricId")],
  );
  return rows;
}

export async function updateItem({ client = null, itemId, name, code, specialtyId, active, displayOrder, required, allowNotPresented }) {
  if (!client) return inTransaction((client) => updateItem({ client, itemId, name, code, specialtyId, active, displayOrder, required, allowNotPresented }));
  await lockConfigurationParent(client, "evaluation_item", itemId);
  if (active !== undefined) boolean(active, "active");
  if (required !== undefined && typeof required !== "boolean") throw new TypeError("required debe ser booleano.");
  if (allowNotPresented !== undefined && typeof allowNotPresented !== "boolean") throw new TypeError("allowNotPresented debe ser booleano.");
  const { rows } = await client.query(
    `UPDATE evaluation_item
        SET name=COALESCE($2,name),code=COALESCE($3,code),specialty_id=COALESCE($4,specialty_id),
            active=COALESCE($5,active),display_order=COALESCE($6,display_order),
            required=COALESCE($7,required),allow_not_presented=COALESCE($8,allow_not_presented),
            updated_at=CURRENT_TIMESTAMP
      WHERE id=$1
      RETURNING id,rubric_id AS "rubricId",specialty_id AS "specialtyId",name,code,active,
                display_order AS "displayOrder",required,allow_not_presented AS "allowNotPresented"`,
    [
      text(itemId, "itemId"),
      name === undefined ? null : text(name, "name"),
      code === undefined ? null : text(code, "code"),
      specialtyId === undefined ? null : text(specialtyId, "specialtyId"),
      active ?? null,
      displayOrder === undefined ? null : order(displayOrder),
      required ?? null,
      allowNotPresented ?? null,
    ],
  );
  if (!rows[0]) throw new Error("EVALUATION_ITEM_NOT_FOUND");
  return rows[0];
}

export async function createCriterion({ client = null, rubricId, scoringItemId, description, displayOrder }) {
  if (!client) return inTransaction((client) => createCriterion({ client, rubricId, scoringItemId, description, displayOrder }));
  const rubric = await lockConfigurationParent(client, "rubric", rubricId);
  if (!scoringItemId) throw new TypeError("scoringItemId es obligatorio.");
  const { rows: items } = await client.query("SELECT id FROM evaluation_item WHERE id=$1 AND rubric_id=$2", [text(scoringItemId, "scoringItemId"), rubricId]);
  if (!items[0]) throw new Error("EVALUATION_ITEM_NOT_FOUND");
  const { rows } = await client.query(
    `INSERT INTO rubric_criterion(event_id,rubric_id,scoring_item_id,description,display_order) VALUES($1,$2,$3,$4,$5)
     RETURNING id,rubric_id AS "rubricId",scoring_item_id AS "scoringItemId",description,display_order AS "displayOrder",active`,
    [rubric.event_id, rubricId, scoringItemId, text(description, "description"), order(displayOrder)],
  );
  return rows[0];
}

export async function listCriteria({ client = getPool(), rubricId, scoringItemId = null }) {
  let sql = `SELECT id,rubric_id AS "rubricId",scoring_item_id AS "scoringItemId",description,display_order AS "displayOrder",active
       FROM rubric_criterion WHERE rubric_id=$1`;
  const params = [text(rubricId, "rubricId")];
  if (scoringItemId) {
    sql += ` AND scoring_item_id=$2`;
    params.push(text(scoringItemId, "scoringItemId"));
  }
  sql += ` ORDER BY display_order`;
  const { rows } = await client.query(sql, params);
  return rows;
}

export async function updateCriterion({ client = null, criterionId, scoringItemId, description, displayOrder, active }) {
  if (!client) return inTransaction((client) => updateCriterion({ client, criterionId, scoringItemId, description, displayOrder, active }));
  const current = await lockConfigurationParent(client, "rubric_criterion", criterionId);
  if (scoringItemId !== undefined) {
    const { rows: items } = await client.query(
      "SELECT 1 FROM evaluation_item WHERE id=$1 AND rubric_id=$2",
      [text(scoringItemId, "scoringItemId"), current.rubric_id],
    );
    if (!items[0]) throw new Error("EVALUATION_ITEM_NOT_FOUND");
  }
  if (active !== undefined) boolean(active, "active");
  const { rows } = await client.query(
    `UPDATE rubric_criterion
        SET description=COALESCE($2,description),display_order=COALESCE($3,display_order),
            active=COALESCE($4,active),scoring_item_id=COALESCE($5,scoring_item_id),updated_at=CURRENT_TIMESTAMP
      WHERE id=$1
      RETURNING id,rubric_id AS "rubricId",scoring_item_id AS "scoringItemId",description,display_order AS "displayOrder",active`,
    [
      text(criterionId, "criterionId"),
      description === undefined ? null : text(description, "description"),
      displayOrder === undefined ? null : order(displayOrder),
      active ?? null,
      scoringItemId ?? null,
    ],
  );
  if (!rows[0]) throw new Error("RUBRIC_CRITERION_NOT_FOUND");
  return rows[0];
}

export async function listCriteriaByItem({ client = getPool(), rubricId, scoringItemId }) {
  const { rows: items } = await client.query(
    "SELECT 1 FROM evaluation_item WHERE id=$1 AND rubric_id=$2",
    [text(scoringItemId, "scoringItemId"), text(rubricId, "rubricId")],
  );
  if (!items[0]) throw new Error("EVALUATION_ITEM_NOT_FOUND");
  const { rows } = await client.query(
    `SELECT id,rubric_id AS "rubricId",scoring_item_id AS "scoringItemId",description,display_order AS "displayOrder",active
       FROM rubric_criterion WHERE rubric_id=$1 AND scoring_item_id=$2 AND active ORDER BY display_order`,
    [rubricId, scoringItemId],
  );
  return rows;
}

export async function getOrphanedCriteria({ client = getPool(), eventId }) {
  await requireEventExists({ client, eventId });
  const { rows } = await client.query(
    `SELECT c.id, c.rubric_id AS "rubricId", c.description, c.display_order AS "displayOrder", r.name AS "rubricName", r.code AS "rubricCode"
       FROM rubric_criterion c
       JOIN rubric r ON r.id = c.rubric_id
      WHERE r.event_id = $1 AND c.scoring_item_id IS NULL
      ORDER BY r.code, c.display_order`,
    [text(eventId, "eventId")],
  );
  return rows;
}

export function reorderItem({ itemId, ...input }) {
  return reorderConfiguration("evaluation_item", itemId, input);
}

export function reorderCriterion({ criterionId, ...input }) {
  return reorderConfiguration("rubric_criterion", criterionId, input);
}

async function reorderConfiguration(table, id, { client = null, actorUserId = null, direction, neighborId, expectedOrder, expectedNeighborOrder }) {
  if (!["UP", "DOWN"].includes(direction)) throw new TypeError("direction debe ser UP o DOWN.");
  const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (typeof id !== "string" || !uuid.test(id) || typeof neighborId !== "string" || !uuid.test(neighborId)) throw new TypeError("IDs invalidos.");
  id = id.toLowerCase();
  neighborId = neighborId.toLowerCase();
  order(expectedOrder);
  order(expectedNeighborOrder);
  if (expectedOrder > 2147483647 || expectedNeighborOrder > 2147483647 || id === neighborId) throw new TypeError("Orden o vecino invalido.");
  if (!client) return inTransaction((client) => reorderConfiguration(table, id, { client, actorUserId, direction, neighborId, expectedOrder, expectedNeighborOrder }));

  const current = await lockConfigurationParent(client, table, id);
  const isCriterion = table === "rubric_criterion";
  if (isCriterion && current.scoring_item_id === null) throw new Error("CRITERION_REASSIGNMENT_REQUIRED");
  const { rows: neighbors } = await client.query(`SELECT * FROM ${table} WHERE id=$1`, [neighborId]);
  const neighbor = neighbors[0];
  if (!neighbor) throw new Error(`${table.toUpperCase()}_NOT_FOUND`);
  if (isCriterion && neighbor.scoring_item_id === null) throw new Error("CRITERION_REASSIGNMENT_REQUIRED");
  if (neighbor.event_id !== current.event_id || neighbor.rubric_id !== current.rubric_id
      || (isCriterion && neighbor.scoring_item_id !== current.scoring_item_id)
      || current.display_order !== expectedOrder || neighbor.display_order !== expectedNeighborOrder) throw new Error("ORDER_CONFLICT");

  const { rows: siblings } = await client.query(
    `SELECT id FROM ${table} WHERE rubric_id=$1 AND event_id=$2
     ${isCriterion ? "AND scoring_item_id=$3" : ""} ORDER BY display_order`,
    isCriterion ? [current.rubric_id, current.event_id, current.scoring_item_id] : [current.rubric_id, current.event_id],
  );
  const index = siblings.findIndex((row) => row.id === id);
  const adjacent = siblings[index + (direction === "UP" ? -1 : 1)];
  if (!adjacent) throw new Error("ORDER_BOUNDARY");
  if (adjacent.id !== neighborId) throw new Error("ORDER_CONFLICT");

  const constraint = isCriterion ? "rubric_criterion_rubric_order_unique" : "evaluation_item_rubric_display_order_unique";
  await client.query(`SET CONSTRAINTS ${constraint} DEFERRED`);
  await client.query(
    `UPDATE ${table} SET display_order=CASE WHEN id=$1 THEN $4::integer ELSE $3::integer END,
       updated_at=CURRENT_TIMESTAMP WHERE id IN ($1,$2)`,
    [id, neighborId, expectedOrder, expectedNeighborOrder],
  );
  await client.query(`SET CONSTRAINTS ${constraint} IMMEDIATE`);
  const changes = [{ id, displayOrder: expectedNeighborOrder }, { id: neighborId, displayOrder: expectedOrder }];
  const context = { eventId: current.event_id, rubricId: current.rubric_id, direction,
    ...(isCriterion ? { scoringItemId: current.scoring_item_id } : {}) };
  await auditEvent(client, {
    actorUserId, action: `${table.toUpperCase()}_REORDERED`, entityType: table, entityId: id,
    before: { ...context, changes: [{ id, displayOrder: expectedOrder }, { id: neighborId, displayOrder: expectedNeighborOrder }] },
    after: { ...context, changes },
  });
  return { changes };
}
