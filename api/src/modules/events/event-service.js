import { getPool } from "../../db/pool.js";

function requireText(value, name) {
  if (typeof value !== "string" || value.trim().length === 0) throw new TypeError(`${name} debe ser texto no vacío.`);
  return value.trim();
}
function requirePositiveInteger(value, name) {
  if (!Number.isInteger(value) || value <= 0) throw new TypeError(`${name} debe ser un entero positivo.`);
  return value;
}

export async function requireEventExists({ client = getPool(), eventId }) {
  const { rows } = await client.query("SELECT id, status FROM carnival_event WHERE id=$1", [requireText(eventId, "eventId")]);
  if (!rows[0]) throw new Error("EVENT_NOT_FOUND");
  return rows[0];
}

export async function requireConfiguringEvent({ client = getPool(), eventId }) {
  const event = await requireEventExists({ client, eventId });
  if (event.status !== "CONFIGURING") throw new Error("EVENT_LOCKED");
  return event;
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
  await requireEventExists({ client, eventId });
  const { rows } = await client.query(
    `SELECT id, event_id AS "eventId", name, display_order AS "displayOrder", kind, status, event_date AS "eventDate"
     FROM night WHERE event_id = $1 ORDER BY display_order`,
    [requireText(eventId, "eventId")],
  );
  return rows;
}

export async function updateEvent({ client = getPool(), eventId, name }) {
  const { rows } = await client.query(
    "UPDATE carnival_event SET name = $2, updated_at = CURRENT_TIMESTAMP WHERE id = $1 RETURNING id, name, status",
    [requireText(eventId, "eventId"), requireText(name, "name")],
  );
  if (!rows[0]) throw new Error("EVENT_NOT_FOUND");
  return rows[0];
}
export async function createNight({ client = getPool(), eventId, name, displayOrder, kind, eventDate = null }) {
  await requireConfiguringEvent({ client, eventId });
  const { rows } = await client.query(
    `INSERT INTO night (event_id, name, display_order, kind, event_date) VALUES ($1, $2, $3, $4, $5)
     RETURNING id, event_id AS "eventId", name, display_order AS "displayOrder", kind, status, event_date AS "eventDate"`,
    [requireText(eventId, "eventId"), requireText(name, "name"), requirePositiveInteger(displayOrder, "displayOrder"), requireText(kind, "kind"), eventDate],
  );
  return rows[0];
}
export async function updateNight({ client = getPool(), nightId, name, displayOrder, kind, eventDate = null, status = null }) {
  const { rows } = await client.query(
    `UPDATE night SET name = $2, display_order = $3, kind = $4, event_date = $5,
             status = COALESCE($6, status), updated_at = CURRENT_TIMESTAMP
     WHERE id = $1
     RETURNING id, event_id AS "eventId", name, display_order AS "displayOrder", kind, status, event_date AS "eventDate"`,
    [requireText(nightId, "nightId"), requireText(name, "name"), requirePositiveInteger(displayOrder, "displayOrder"), requireText(kind, "kind"), eventDate, status],
  );
  if (!rows[0]) throw new Error("NIGHT_NOT_FOUND");
  return rows[0];
}
