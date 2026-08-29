import { getPool } from "../../db/pool.js";

function requireText(value, name) {
  if (typeof value !== "string" || value.trim().length === 0) throw new TypeError(`${name} debe ser texto no vacío.`);
  return value.trim();
}
function requirePositiveInteger(value, name) {
  if (!Number.isInteger(value) || value <= 0) throw new TypeError(`${name} debe ser un entero positivo.`);
  return value;
}

export async function createEvent({ client = getPool(), name }) {
  const { rows } = await client.query("INSERT INTO carnival_event (name) VALUES ($1) RETURNING id, name, status", [requireText(name, "name")]);
  return rows[0];
}
export async function listEvents({ client = getPool() } = {}) {
  const { rows } = await client.query("SELECT id, name, status FROM carnival_event ORDER BY created_at");
  return rows;
}
export async function getEvent({ client = getPool(), eventId }) {
  const { rows } = await client.query("SELECT id, name, status FROM carnival_event WHERE id = $1", [requireText(eventId, "eventId")]);
  return rows[0] ?? null;
}
export async function listNights({ client = getPool(), eventId }) {
  const { rows } = await client.query(
    `SELECT id, event_id AS "eventId", name, display_order AS "displayOrder", kind, status, event_date AS "eventDate"
     FROM night WHERE event_id = $1 ORDER BY display_order`,
    [requireText(eventId, "eventId")],
  );
  return rows;
}

export async function updateEvent({ client = getPool(), eventId, name }) {
  const { rows } = await client.query(
    "UPDATE carnival_event SET name = $2, updated_at = CURRENT_TIMESTAMP WHERE id = $1 AND status = 'CONFIGURING' RETURNING id, name, status",
    [requireText(eventId, "eventId"), requireText(name, "name")],
  );
  if (!rows[0]) throw new Error("EVENT_LOCKED");
  return rows[0];
}
export async function createNight({ client = getPool(), eventId, name, displayOrder, kind, eventDate = null }) {
  const { rows } = await client.query(
    `INSERT INTO night (event_id, name, display_order, kind, event_date) VALUES ($1, $2, $3, $4, $5)
     RETURNING id, event_id AS "eventId", name, display_order AS "displayOrder", kind, status, event_date AS "eventDate"`,
    [requireText(eventId, "eventId"), requireText(name, "name"), requirePositiveInteger(displayOrder, "displayOrder"), requireText(kind, "kind"), eventDate],
  );
  return rows[0];
}
export async function updateNight({ client = getPool(), nightId, name, displayOrder, kind, eventDate = null }) {
  const { rows } = await client.query(
    `UPDATE night n SET name = $2, display_order = $3, kind = $4, event_date = $5, updated_at = CURRENT_TIMESTAMP
     FROM carnival_event e WHERE n.id = $1 AND n.event_id = e.id AND e.status = 'CONFIGURING'
     RETURNING n.id, n.event_id AS "eventId", n.name, n.display_order AS "displayOrder", n.kind, n.status, n.event_date AS "eventDate"`,
    [requireText(nightId, "nightId"), requireText(name, "name"), requirePositiveInteger(displayOrder, "displayOrder"), requireText(kind, "kind"), eventDate],
  );
  if (!rows[0]) throw new Error("EVENT_LOCKED");
  return rows[0];
}
