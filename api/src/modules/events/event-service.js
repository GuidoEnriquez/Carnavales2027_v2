import { getPool } from "../../db/pool.js";

function requireText(value, name) {
  if (typeof value !== "string" || value.trim().length === 0) throw new TypeError(`${name} debe ser texto no vacío.`);
  return value.trim();
}
function parseCalendarDate(value) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  const parsed = new Date(Date.UTC(year, month - 1, day));
  const valid =
    parsed.getUTCFullYear() === year &&
    parsed.getUTCMonth() === month - 1 &&
    parsed.getUTCDate() === day;
  return valid ? value : null;
}
function requireNightDate(value) {
  if (value === null || value === undefined || value === "") throw new Error("NIGHT_DATE_REQUIRED");
  if (typeof value !== "string" || !parseCalendarDate(value)) throw new Error("NIGHT_DATE_INVALID");
  return value;
}
async function runWithTransaction(client, operation) {
  const { rows } = await client.query("SELECT pg_current_xact_id_if_assigned() IS NOT NULL AS in_txn");
  const ownsTransaction = !rows[0].in_txn;
  if (ownsTransaction) await client.query("BEGIN");
  try {
    const result = await operation();
    if (ownsTransaction) await client.query("COMMIT");
    return result;
  } catch (error) {
    if (ownsTransaction) await client.query("ROLLBACK").catch(() => {});
    throw error;
  }
}
async function normalizeNightOrder({ client, eventId }) {
  await client.query("SELECT pg_advisory_xact_lock(hashtext($1))", [`night_order:${eventId}`]);
  await client.query("UPDATE night SET display_order = display_order + 1000000 WHERE event_id = $1", [eventId]);
  await client.query(
    `UPDATE night AS n
        SET display_order = ranked.rn
       FROM (
         SELECT id,
                row_number() OVER (
                  PARTITION BY event_id
                  ORDER BY event_date NULLS LAST, created_at, id
                )::INTEGER AS rn
           FROM night
          WHERE event_id = $1
       ) AS ranked
      WHERE n.id = ranked.id`,
    [eventId],
  );
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
export async function createNight({ client = getPool(), eventId, name, kind, eventDate }) {
  await requireConfiguringEvent({ client, eventId });
  const normalizedEventId = requireText(eventId, "eventId");
  const date = requireNightDate(eventDate);
  const nightName = requireText(name, "name");
  const nightKind = requireText(kind, "kind");

  return runWithTransaction(client, async () => {
    await client.query("SELECT pg_advisory_xact_lock(hashtext($1))", [`night_order:${normalizedEventId}`]);
    const { rows: existing } = await client.query(
      "SELECT id FROM night WHERE event_id = $1 AND event_date = $2",
      [normalizedEventId, date],
    );
    if (existing.length > 0) throw new Error("NIGHT_DATE_DUPLICATE");
    const { rows: maxRows } = await client.query(
      "SELECT COALESCE(MAX(display_order), 0) + 1 AS next FROM night WHERE event_id = $1",
      [normalizedEventId],
    );
    const { rows } = await client.query(
      `INSERT INTO night (event_id, name, display_order, kind, event_date)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id`,
      [normalizedEventId, nightName, maxRows[0].next, nightKind, date],
    );
    await normalizeNightOrder({ client, eventId: normalizedEventId });
    const { rows: finalRows } = await client.query(
      `SELECT id, event_id AS "eventId", name, display_order AS "displayOrder", kind, status, event_date AS "eventDate"
       FROM night WHERE id = $1`,
      [rows[0].id],
    );
    return finalRows[0];
  });
}
export async function updateNight({ client = getPool(), nightId, name, kind, eventDate, status = null }) {
  const normalizedNightId = requireText(nightId, "nightId");
  const date = requireNightDate(eventDate);
  const nightName = requireText(name, "name");
  const nightKind = requireText(kind, "kind");

  return runWithTransaction(client, async () => {
    const { rows: existing } = await client.query(
      'SELECT id, event_id AS "eventId" FROM night WHERE id = $1',
      [normalizedNightId],
    );
    if (!existing[0]) throw new Error("NIGHT_NOT_FOUND");
    const eventId = existing[0].eventId;
    await client.query("SELECT pg_advisory_xact_lock(hashtext($1))", [`night_order:${eventId}`]);
    const { rows: duplicates } = await client.query(
      "SELECT id FROM night WHERE event_id = $1 AND event_date = $2 AND id <> $3",
      [eventId, date, normalizedNightId],
    );
    if (duplicates.length > 0) throw new Error("NIGHT_DATE_DUPLICATE");
    const { rows } = await client.query(
      `UPDATE night SET name = $2, kind = $3, event_date = $4,
              status = COALESCE($5, status), updated_at = CURRENT_TIMESTAMP
       WHERE id = $1
       RETURNING id`,
      [normalizedNightId, nightName, nightKind, date, status],
    );
    if (!rows[0]) throw new Error("NIGHT_NOT_FOUND");
    await normalizeNightOrder({ client, eventId });
    const { rows: finalRows } = await client.query(
      `SELECT id, event_id AS "eventId", name, display_order AS "displayOrder", kind, status, event_date AS "eventDate"
       FROM night WHERE id = $1`,
      [normalizedNightId],
    );
    return finalRows[0];
  });
}