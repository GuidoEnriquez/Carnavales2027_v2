import { getPool } from "../../db/pool.js";
import { auditEvent } from "../../audit/audit-service.js";

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

const DELETE_BLOCKERS = [
  ["ballot", "EVENT_HAS_BALLOTS"],
  ["judge_assignment", "EVENT_HAS_ASSIGNMENTS"],
  ["judge_quota", "EVENT_HAS_QUOTAS"],
  ["troupe_penalty", "EVENT_HAS_PENALTIES"],
  ["official_scrutiny_record", "EVENT_HAS_SCRUTINY_RECORD"],
  ["results_release", "EVENT_HAS_RESULTS"],
  ["results_snapshot", "EVENT_HAS_RESULTS"],
];

export async function deleteEvent({ client = null, eventId, actorUserId = null }) {
  const owned = !client;
  const db = client ?? await getPool().connect();
  try {
    if (owned) await db.query("BEGIN");
    const id = requireText(eventId, "eventId");
    const { rows: events } = await db.query("SELECT id, name, status FROM carnival_event WHERE id = $1 FOR UPDATE", [id]);
    if (!events[0]) throw new Error("EVENT_NOT_FOUND");
    if (events[0].status !== "CONFIGURING") throw new Error("EVENT_LOCKED");
    for (const [table, code] of DELETE_BLOCKERS) {
      const { rows: [{ n }] } = await db.query(`SELECT COUNT(*)::int AS n FROM ${table} WHERE event_id = $1`, [id]);
      if (n > 0) throw new Error(code);
    }
    await db.query("DELETE FROM rubric_criterion WHERE rubric_id IN (SELECT id FROM rubric WHERE event_id = $1)", [id]);
    await db.query("DELETE FROM evaluation_item WHERE event_id = $1", [id]);
    await db.query("DELETE FROM troupe_nomination WHERE event_id = $1", [id]);
    await db.query("DELETE FROM night_troupe_schedule WHERE event_id = $1", [id]);
    await db.query("DELETE FROM voting_window WHERE event_id = $1", [id]);
    await db.query("DELETE FROM night WHERE event_id = $1", [id]);
    await db.query("DELETE FROM event_troupe WHERE event_id = $1", [id]);
    await db.query("DELETE FROM event_category WHERE event_id = $1", [id]);
    await db.query("DELETE FROM rubric WHERE event_id = $1", [id]);
    await db.query("DELETE FROM event_specialty WHERE event_id = $1", [id]);
    await db.query("DELETE FROM configuration_seed WHERE event_id = $1", [id]);
    await db.query("DELETE FROM carnival_event WHERE id = $1", [id]);
    await auditEvent(db, {
      actorUserId, action: "EVENT_DELETED", entityType: "carnival_event", entityId: id,
      before: { name: events[0].name, status: events[0].status },
    });
    if (owned) await db.query("COMMIT");
    return { id };
  } catch (error) {
    if (owned) await db.query("ROLLBACK");
    throw error;
  } finally {
    if (owned) db.release();
  }
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
