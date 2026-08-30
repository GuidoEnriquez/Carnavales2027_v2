import { getPool } from "../../db/pool.js";
import { requireConfiguringEvent, requireEventExists } from "../events/event-service.js";

const EVALUATION_TARGETS = new Set(["TROUPE", "NOMINATION"]);
const SUBJECT_TYPES = new Set(["PERSON", "COUPLE", "GROUP", "FIGURE", "ELEMENT", "OTHER"]);

function text(value, name) {
  if (typeof value !== "string" || !value.trim()) throw new TypeError(`${name} debe ser texto no vacío.`);
  return value.trim();
}

function order(value) {
  if (!Number.isInteger(value) || value <= 0) throw new TypeError("displayOrder debe ser entero positivo.");
  return value;
}

function boolean(value, name) {
  if (typeof value !== "boolean") throw new TypeError(`${name} debe ser booleano.`);
  return value;
}

function rubricValues({ name, code, evaluationTarget, expectedSubjectType, active = true }) {
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
  };
}

export async function createRubric({ client = getPool(), eventId, ...input }) {
  await requireConfiguringEvent({ client, eventId });
  const values = rubricValues(input);
  const { rows } = await client.query(
    `INSERT INTO rubric(event_id,name,code,evaluation_target,expected_subject_type,active)
     VALUES($1,$2,$3,$4,$5,$6)
     RETURNING id,event_id AS "eventId",name,code,evaluation_target AS "evaluationTarget",
               expected_subject_type AS "expectedSubjectType",active`,
    [text(eventId, "eventId"), values.name, values.code, values.evaluationTarget, values.expectedSubjectType, values.active],
  );
  return rows[0];
}

export async function listRubrics({ client = getPool(), eventId }) {
  await requireEventExists({ client, eventId });
  const { rows } = await client.query(
    `SELECT id, event_id AS "eventId", name, code, evaluation_target AS "evaluationTarget",
            expected_subject_type AS "expectedSubjectType", active
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
            expected_subject_type AS "expectedSubjectType", active
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
  if (!client) {
    const ownedClient = await getPool().connect();
    try {
      await ownedClient.query("BEGIN");
      const result = await updateRubric({ client: ownedClient, rubricId, ...input });
      await ownedClient.query("COMMIT");
      return result;
    } catch (error) {
      await ownedClient.query("ROLLBACK");
      throw error;
    } finally {
      ownedClient.release();
    }
  }
  const { rows } = await client.query(
    `SELECT id,event_id AS "eventId",name,code,evaluation_target AS "evaluationTarget",
            expected_subject_type AS "expectedSubjectType",active
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
  });
  const { rows: updatedRows } = await client.query(
    `UPDATE rubric SET name=$2,code=$3,evaluation_target=$4,expected_subject_type=$5,active=$6,
                       updated_at=CURRENT_TIMESTAMP
      WHERE id=$1
      RETURNING id,event_id AS "eventId",name,code,evaluation_target AS "evaluationTarget",
                expected_subject_type AS "expectedSubjectType",active`,
    [rubricId, values.name, values.code, values.evaluationTarget, values.expectedSubjectType, values.active],
  );
  return updatedRows[0];
}

export async function createItem({ client = getPool(), rubricId, name, code, specialtyId }) {
  const { rows: rubrics } = await client.query("SELECT event_id FROM rubric WHERE id=$1", [text(rubricId, "rubricId")]);
  if (!rubrics[0]) throw new Error("RUBRIC_NOT_FOUND");
  const { rows } = await client.query(
    `INSERT INTO evaluation_item(event_id,rubric_id,specialty_id,name,code) VALUES($1,$2,$3,$4,$5)
     RETURNING id,rubric_id AS "rubricId",specialty_id AS "specialtyId",name,code,active`,
    [rubrics[0].event_id, rubricId, text(specialtyId, "specialtyId"), text(name, "name"), text(code, "code")],
  );
  return rows[0];
}

export async function listItems({ client = getPool(), rubricId }) {
  const { rows } = await client.query(
    `SELECT i.id,i.rubric_id AS "rubricId",i.specialty_id AS "specialtyId",i.name,i.code,i.active,
            s.name AS "specialtyName",s.code AS "specialtyCode"
       FROM evaluation_item i
       JOIN event_specialty s ON s.id=i.specialty_id
      WHERE i.rubric_id=$1
      ORDER BY i.code`,
    [text(rubricId, "rubricId")],
  );
  return rows;
}

export async function updateItem({ client = getPool(), itemId, name, code, specialtyId, active }) {
  if (active !== undefined) boolean(active, "active");
  const { rows } = await client.query(
    `UPDATE evaluation_item
        SET name=COALESCE($2,name),code=COALESCE($3,code),specialty_id=COALESCE($4,specialty_id),
            active=COALESCE($5,active),updated_at=CURRENT_TIMESTAMP
      WHERE id=$1
      RETURNING id,rubric_id AS "rubricId",specialty_id AS "specialtyId",name,code,active`,
    [
      text(itemId, "itemId"),
      name === undefined ? null : text(name, "name"),
      code === undefined ? null : text(code, "code"),
      specialtyId === undefined ? null : text(specialtyId, "specialtyId"),
      active ?? null,
    ],
  );
  if (!rows[0]) throw new Error("EVALUATION_ITEM_NOT_FOUND");
  return rows[0];
}

export async function createCriterion({ client = getPool(), rubricId, description, displayOrder }) {
  const { rows: rubrics } = await client.query("SELECT event_id FROM rubric WHERE id=$1", [text(rubricId, "rubricId")]);
  if (!rubrics[0]) throw new Error("RUBRIC_NOT_FOUND");
  const { rows } = await client.query(
    `INSERT INTO rubric_criterion(event_id,rubric_id,description,display_order) VALUES($1,$2,$3,$4)
     RETURNING id,rubric_id AS "rubricId",description,display_order AS "displayOrder",active`,
    [rubrics[0].event_id, rubricId, text(description, "description"), order(displayOrder)],
  );
  return rows[0];
}

export async function listCriteria({ client = getPool(), rubricId }) {
  const { rows } = await client.query(
    `SELECT id,rubric_id AS "rubricId",description,display_order AS "displayOrder",active
       FROM rubric_criterion WHERE rubric_id=$1 ORDER BY display_order`,
    [text(rubricId, "rubricId")],
  );
  return rows;
}

export async function updateCriterion({ client = getPool(), criterionId, description, displayOrder, active }) {
  if (active !== undefined) boolean(active, "active");
  const { rows } = await client.query(
    `UPDATE rubric_criterion
        SET description=COALESCE($2,description),display_order=COALESCE($3,display_order),
            active=COALESCE($4,active),updated_at=CURRENT_TIMESTAMP
      WHERE id=$1
      RETURNING id,rubric_id AS "rubricId",description,display_order AS "displayOrder",active`,
    [
      text(criterionId, "criterionId"),
      description === undefined ? null : text(description, "description"),
      displayOrder === undefined ? null : order(displayOrder),
      active ?? null,
    ],
  );
  if (!rows[0]) throw new Error("RUBRIC_CRITERION_NOT_FOUND");
  return rows[0];
}
