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
  // T09d: los inactivos no configuran. Compatible con esquemas historicos pre-075 sin columna active
  // y con llamadas fuera de transaccion (SAVEPOINT solo es legal dentro de una transaccion).
  let savepoint = false;
  try {
    await client.query("SAVEPOINT require_configuring_active_compat");
    savepoint = true;
  } catch (error) {
    if (error?.code !== "25P01") throw error;
  }
  try {
    const { rows } = await client.query("SELECT active FROM carnival_event WHERE id=$1", [requireText(eventId, "eventId")]);
    if (savepoint) await client.query("RELEASE SAVEPOINT require_configuring_active_compat");
    if (rows[0]?.active === false) throw new Error("EVENT_LOCKED");
  } catch (error) {
    if (error?.code !== "42703") throw error;
    if (savepoint) {
      await client.query("ROLLBACK TO SAVEPOINT require_configuring_active_compat");
      await client.query("RELEASE SAVEPOINT require_configuring_active_compat");
    }
  }
  return event;
}

export async function createEvent({ client = getPool(), name }) {
  const { rows } = await client.query("INSERT INTO carnival_event (name) VALUES ($1) RETURNING id, name, status, active", [requireText(name, "name")]);
  return rows[0];
}
export async function listEvents({ client = getPool() } = {}) {
  const { rows } = await client.query("SELECT id, name, status, active FROM carnival_event ORDER BY created_at");
  return rows;
}
export async function getEvent({ client = getPool(), eventId }) {
  const { rows } = await client.query("SELECT id, name, status, active FROM carnival_event WHERE id = $1", [requireText(eventId, "eventId")]);
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

export async function updateEvent({ client = getPool(), eventId, name, active }) {
  const id = requireText(eventId, "eventId");
  const hasName = name !== undefined;
  const hasActive = active !== undefined;
  if (!hasName && !hasActive) throw new TypeError("Nada para actualizar.");
  if (hasActive && typeof active !== "boolean") throw new TypeError("active debe ser booleano.");
  const { rows: current } = await client.query("SELECT id, status FROM carnival_event WHERE id = $1", [id]);
  if (!current[0]) throw new Error("EVENT_NOT_FOUND");
  if (current[0].status !== "CONFIGURING") throw new Error("EVENT_LOCKED");
  const { rows } = await client.query(
    "UPDATE carnival_event SET name = COALESCE($2, name), active = COALESCE($3, active), updated_at = CURRENT_TIMESTAMP WHERE id = $1 RETURNING id, name, status, active",
    [id, hasName ? requireText(name, "name") : null, hasActive ? active : null],
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
    const { rows: events } = await db.query("SELECT id, name, status, active FROM carnival_event WHERE id = $1 FOR UPDATE", [id]);
    if (!events[0] || events[0].active === false) throw new Error("EVENT_NOT_FOUND");
    if (events[0].status !== "CONFIGURING") throw new Error("EVENT_LOCKED");
    for (const [table, code] of DELETE_BLOCKERS) {
      const { rows: [{ n }] } = await db.query(`SELECT COUNT(*)::int AS n FROM ${table} WHERE event_id = $1`, [id]);
      if (n > 0) throw new Error(code);
    }
    // T09d: baja logica. Sin cascada fisica: el registro se conserva con active=false.
    await db.query("UPDATE carnival_event SET active = false, updated_at = CURRENT_TIMESTAMP WHERE id = $1", [id]);
    await auditEvent(db, {
      actorUserId, action: "EVENT_DELETED", entityType: "carnival_event", entityId: id,
      before: { name: events[0].name, status: events[0].status, active: true },
      after: { active: false },
    });
    if (owned) await db.query("COMMIT");
    return { id, active: false };
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
