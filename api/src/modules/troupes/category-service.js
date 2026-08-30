import { getPool } from "../../db/pool.js";
import { requireConfiguringEvent, requireEventExists } from "../events/event-service.js";

function text(value, name) {
  if (typeof value !== "string" || !value.trim()) throw new TypeError(`${name} debe ser texto no vacío.`);
  return value.trim();
}

function order(value) {
  if (!Number.isInteger(value) || value <= 0) throw new TypeError("displayOrder debe ser entero positivo.");
  return value;
}

function optionalBoolean(value, name) {
  if (value === undefined) return null;
  if (typeof value !== "boolean") throw new TypeError(`${name} debe ser booleano.`);
  return value;
}

export async function createCategory({ client = getPool(), eventId, name, code, displayOrder }) {
  await requireConfiguringEvent({ client, eventId });
  const { rows } = await client.query(
    `INSERT INTO event_category (event_id, name, code, display_order) VALUES ($1, $2, $3, $4)
     RETURNING id, event_id AS "eventId", name, code, display_order AS "displayOrder", active`,
    [text(eventId, "eventId"), text(name, "name"), text(code, "code"), order(displayOrder)],
  );
  return rows[0];
}

export async function listCategories({ client = getPool(), eventId, eligible = false }) {
  await requireEventExists({ client, eventId });
  const { rows } = await client.query(
    `SELECT id, event_id AS "eventId", name, code, display_order AS "displayOrder", active
       FROM event_category
      WHERE event_id = $1 ${eligible ? "AND active = true" : ""}
      ORDER BY display_order`,
    [text(eventId, "eventId")],
  );
  return rows;
}

export async function updateCategory({ client = getPool(), categoryId, name, code, displayOrder, active }) {
  const { rows } = await client.query(
    `UPDATE event_category
        SET name = COALESCE($2, name),
            code = COALESCE($3, code),
            display_order = COALESCE($4, display_order),
            active = COALESCE($5, active),
            updated_at = CURRENT_TIMESTAMP
      WHERE id = $1
      RETURNING id, event_id AS "eventId", name, code, display_order AS "displayOrder", active`,
    [
      text(categoryId, "categoryId"),
      name === undefined ? null : text(name, "name"),
      code === undefined ? null : text(code, "code"),
      displayOrder === undefined ? null : order(displayOrder),
      optionalBoolean(active, "active"),
    ],
  );
  if (!rows[0]) throw new Error("CATEGORY_NOT_FOUND");
  return rows[0];
}

export async function createTroupe({ client = getPool(), eventId, categoryId, name }) {
  await requireConfiguringEvent({ client, eventId });
  const { rows } = await client.query(
    `INSERT INTO event_troupe (event_id, category_id, name) VALUES ($1, $2, $3)
     RETURNING id, event_id AS "eventId", category_id AS "categoryId", name, active`,
    [text(eventId, "eventId"), text(categoryId, "categoryId"), text(name, "name")],
  );
  return rows[0];
}

export async function listTroupes({ client = getPool(), eventId }) {
  await requireEventExists({ client, eventId });
  const { rows } = await client.query(
    `SELECT t.id, t.event_id AS "eventId", t.category_id AS "categoryId", t.name, t.active,
            c.name AS "categoryName", c.code AS "categoryCode", c.active AS "categoryActive"
       FROM event_troupe t
       JOIN event_category c ON c.id = t.category_id
      WHERE t.event_id = $1
      ORDER BY t.name`,
    [text(eventId, "eventId")],
  );
  return rows;
}

export async function updateTroupe({ client = getPool(), troupeId, categoryId, name, active }) {
  const { rows } = await client.query(
    `UPDATE event_troupe
        SET category_id = COALESCE($2, category_id),
            name = COALESCE($3, name),
            active = COALESCE($4, active),
            updated_at = CURRENT_TIMESTAMP
      WHERE id = $1
      RETURNING id, event_id AS "eventId", category_id AS "categoryId", name, active`,
    [
      text(troupeId, "troupeId"),
      categoryId === undefined ? null : text(categoryId, "categoryId"),
      name === undefined ? null : text(name, "name"),
      optionalBoolean(active, "active"),
    ],
  );
  if (!rows[0]) throw new Error("TROUPE_NOT_FOUND");
  return rows[0];
}
