import { getPool } from "../../db/pool.js";

const text = (value, name) => { if (typeof value !== "string" || !value.trim()) throw new TypeError(`${name} debe ser texto no vacío.`); return value.trim(); };
const order = (value) => { if (!Number.isInteger(value) || value <= 0) throw new TypeError("displayOrder debe ser entero positivo."); return value; };

export async function createCategory({ client = getPool(), eventId, name, code, displayOrder }) {
  const { rows } = await client.query(
    `INSERT INTO event_category (event_id, name, code, display_order) VALUES ($1, $2, $3, $4)
     RETURNING id, event_id AS "eventId", name, code, display_order AS "displayOrder", active`,
    [text(eventId, "eventId"), text(name, "name"), text(code, "code"), order(displayOrder)],
  ); return rows[0];
}
export async function listCategories({ client = getPool(), eventId, eligible = false }) {
  const { rows } = await client.query(
    `SELECT id, event_id AS "eventId", name, code, display_order AS "displayOrder", active FROM event_category
     WHERE event_id = $1 ${eligible ? "AND active = true" : ""} ORDER BY display_order`, [text(eventId, "eventId")],
  ); return rows;
}
export async function updateCategory({ client = getPool(), categoryId, active }) {
  const { rows } = await client.query(
    `UPDATE event_category c SET active = $2, updated_at = CURRENT_TIMESTAMP FROM carnival_event e
     WHERE c.id = $1 AND c.event_id = e.id AND e.status = 'CONFIGURING'
     RETURNING c.id, c.event_id AS "eventId", c.name, c.code, c.display_order AS "displayOrder", c.active`,
    [text(categoryId, "categoryId"), Boolean(active)],
  ); if (!rows[0]) throw new Error("EVENT_LOCKED"); return rows[0];
}
export async function createTroupe({ client = getPool(), eventId, categoryId, name }) {
  const { rows } = await client.query(
    `INSERT INTO event_troupe (event_id, category_id, name) VALUES ($1, $2, $3)
     RETURNING id, event_id AS "eventId", category_id AS "categoryId", name, active`,
    [text(eventId, "eventId"), text(categoryId, "categoryId"), text(name, "name")],
  ); return rows[0];
}
