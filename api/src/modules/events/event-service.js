import { getPool } from "../../db/pool.js";

function requireText(value, name) {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new TypeError(`${name} debe ser texto no vacío.`);
  }

  return value.trim();
}

function requirePositiveInteger(value, name) {
  if (!Number.isInteger(value) || value <= 0) {
    throw new TypeError(`${name} debe ser un entero positivo.`);
  }

  return value;
}

export async function createEvent({ client = getPool(), name }) {
  const { rows } = await client.query(
    `INSERT INTO carnival_event (name)
     VALUES ($1)
     RETURNING id, name, status`,
    [requireText(name, "name")],
  );

  return rows[0];
}

export async function createNight({
  client = getPool(),
  eventId,
  name,
  displayOrder,
  kind,
  eventDate = null,
}) {
  const { rows } = await client.query(
    `INSERT INTO night (event_id, name, display_order, kind, event_date)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING id, event_id AS "eventId", name, display_order AS "displayOrder", kind, status, event_date AS "eventDate"`,
    [
      requireText(eventId, "eventId"),
      requireText(name, "name"),
      requirePositiveInteger(displayOrder, "displayOrder"),
      requireText(kind, "kind"),
      eventDate,
    ],
  );

  return rows[0];
}
