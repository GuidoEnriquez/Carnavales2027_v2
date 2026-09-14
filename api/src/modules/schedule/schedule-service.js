import { getPool } from "../../db/pool.js";
import { auditEvent } from "../../audit/audit-service.js";
import { requireEventExists } from "../events/event-service.js";

function text(value, name) {
  if (typeof value !== "string" || !value.trim()) throw new TypeError(`${name} debe ser texto no vacío.`);
  return value.trim();
}

function order(value) {
  if (!Number.isInteger(value) || value <= 0) throw new TypeError("presentationOrder debe ser entero positivo.");
  return value;
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

export async function listSchedule({ client = getPool(), eventId, nightId = null }) {
  await requireEventExists({ client, eventId });
  const params = [text(eventId, "eventId")];
  let nightFilter = "";
  if (nightId !== null && nightId !== undefined) {
    nightFilter = "AND s.night_id = $2";
    params.push(text(nightId, "nightId"));
  }
  const { rows } = await client.query(
    `SELECT s.id, s.event_id AS "eventId", s.night_id AS "nightId", n.name AS "nightName",
            s.event_troupe_id AS "troupeId", t.name AS "troupeName",
            t.brand_color AS "troupeBrandColor",
             s.presentation_order AS "presentationOrder", s.status,
             s.scheduled_at AS "scheduledAt", s.scheduled_timezone AS "scheduledTimezone", s.order_source AS "orderSource"
       FROM night_troupe_schedule s
       JOIN night n ON n.id = s.night_id
       JOIN event_troupe t ON t.id = s.event_troupe_id
      WHERE s.event_id = $1 ${nightFilter}
      ORDER BY n.display_order, s.presentation_order`,
    params,
  );
  return rows;
}

export function reorderScheduleEntry({ scheduleId, ...input }) {
  return reorderSchedule(scheduleId, input);
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function uuid(value, name) {
  if (typeof value !== "string" || !UUID_RE.test(value)) throw new TypeError(`${name} invalido.`);
  return value.toLowerCase();
}

// Spec 017 T09c (RF-153..RF-155, RF-157): reorden total de la jornada por lista
// ordenada. En CONFIGURING mantiene las reglas vigentes (motivo opcional). En
// OPEN exige motivo obligatorio (422) y cero ballots en la jornada (409).
export async function reorderEventSchedule({ client = null, eventId, nightId, orderedIds, reason = null, actorUserId = null }) {
  if (!client) {
    return inTransaction((client) => reorderEventSchedule({ client, eventId, nightId, orderedIds, reason, actorUserId }));
  }
  eventId = uuid(eventId, "eventId");
  nightId = uuid(nightId, "nightId");
  if (!Array.isArray(orderedIds) || orderedIds.length === 0) throw new TypeError("orderedIds debe ser una lista no vacia.");
  const ids = orderedIds.map((id) => uuid(id, "orderedId"));
  if (new Set(ids).size !== ids.length) throw new TypeError("orderedIds contiene duplicados.");

  const { rows: events } = await client.query("SELECT status FROM carnival_event WHERE id=$1 FOR UPDATE", [eventId]);
  if (!events[0]) throw new Error("EVENT_NOT_FOUND");
  const status = events[0].status;
  if (status !== "CONFIGURING" && status !== "OPEN") throw new Error("EVENT_LOCKED");

  const { rows: nights } = await client.query("SELECT id FROM night WHERE id=$1 AND event_id=$2", [nightId, eventId]);
  if (!nights[0]) throw new Error("NIGHT_NOT_FOUND");

  if (status === "OPEN") {
    const motive = typeof reason === "string" ? reason.trim() : "";
    if (!motive) {
      const error = new Error("REORDER_REASON_REQUIRED");
      error.status = 422;
      throw error;
    }
    reason = motive;
    const { rows: [{ n }] } = await client.query(
      "SELECT COUNT(*)::int AS n FROM ballot WHERE event_id=$1 AND night_id=$2",
      [eventId, nightId],
    );
    if (n > 0) throw new Error("NIGHT_VOTING_STARTED");
  } else if (typeof reason === "string" && reason.trim()) {
    reason = reason.trim();
  } else {
    reason = null;
  }

  const { rows: current } = await client.query(
    `SELECT id FROM night_troupe_schedule WHERE event_id=$1 AND night_id=$2 ORDER BY presentation_order FOR UPDATE`,
    [eventId, nightId],
  );
  if (current.length === 0) throw new Error("NIGHT_SCHEDULE_EMPTY");
  const currentIds = current.map((row) => row.id);
  if (currentIds.length !== ids.length || !currentIds.every((id) => ids.includes(id))) {
    throw new Error("ORDER_CONFLICT");
  }

  const before = currentIds.map((id, index) => ({ id, presentationOrder: index + 1 }));
  const after = ids.map((id, index) => ({ id, presentationOrder: index + 1 }));
  await client.query("SET CONSTRAINTS schedule_night_order_unique DEFERRED");
  for (const entry of after) {
    await client.query(
      "UPDATE night_troupe_schedule SET presentation_order=$2::integer, updated_at=CURRENT_TIMESTAMP WHERE id=$1",
      [entry.id, entry.presentationOrder],
    );
  }
  await client.query("SET CONSTRAINTS schedule_night_order_unique IMMEDIATE");
  await auditEvent(client, {
    actorUserId, action: "NIGHT_TROUPE_SCHEDULE_REORDERED", entityType: "night_troupe_schedule", entityId: nightId,
    before: { eventId, nightId, eventStatus: status, changes: before },
    after: { eventId, nightId, eventStatus: status, reason, changes: after },
  });
  return { changes: after };
}

export async function addTroupeToSchedule({ client = null, eventId, nightId, troupeId, actorUserId = null }) {
  if (!client) return inTransaction((client) => addTroupeToSchedule({ client, eventId, nightId, troupeId, actorUserId }));
  const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  eventId = text(eventId, "eventId"); nightId = text(nightId, "nightId"); troupeId = text(troupeId, "troupeId");
  if (!uuid.test(eventId) || !uuid.test(nightId) || !uuid.test(troupeId)) throw new TypeError("IDs invalidos.");
  const { rows: events } = await client.query("SELECT status FROM carnival_event WHERE id=$1 FOR UPDATE", [eventId]);
  if (!events[0]) throw new Error("EVENT_NOT_FOUND");
  if (events[0].status !== "CONFIGURING") throw new Error("EVENT_LOCKED");
  const { rows: nights } = await client.query("SELECT id FROM night WHERE id=$1 AND event_id=$2", [nightId, eventId]);
  if (!nights[0]) throw new Error("NIGHT_NOT_FOUND");
  const { rows: troupes } = await client.query("SELECT id FROM event_troupe WHERE id=$1 AND event_id=$2 AND active", [troupeId, eventId]);
  if (!troupes[0]) throw new Error("TROUPE_NOT_FOUND");
  const { rows: existing } = await client.query(
    "SELECT id FROM night_troupe_schedule WHERE night_id=$1 AND event_troupe_id=$2", [nightId, troupeId],
  );
  if (existing[0]) throw new Error("SCHEDULE_CONFLICT");
  const { rows } = await client.query(
    `INSERT INTO night_troupe_schedule (event_id, night_id, event_troupe_id, presentation_order, status)
     VALUES ($1, $2, $3, COALESCE((SELECT MAX(presentation_order) FROM night_troupe_schedule WHERE night_id=$2 AND event_id=$1), 0) + 1, 'SCHEDULED')
     RETURNING id, event_id AS "eventId", night_id AS "nightId", event_troupe_id AS "troupeId",
               presentation_order AS "presentationOrder", status`,
    [eventId, nightId, troupeId],
  );
  await auditEvent(client, {
    actorUserId, action: "NIGHT_TROUPE_SCHEDULED", entityType: "night_troupe_schedule", entityId: rows[0].id,
    after: { eventId, nightId, troupeId, presentationOrder: rows[0].presentationOrder },
  });
  return rows[0];
}

export async function removeScheduleEntry({ client = null, scheduleId, actorUserId = null }) {
  if (!client) return inTransaction((client) => removeScheduleEntry({ client, scheduleId, actorUserId }));
  const { rows: current } = await client.query("SELECT * FROM night_troupe_schedule WHERE id=$1", [text(scheduleId, "scheduleId")]);
  if (!current[0]) throw new Error("NIGHT_TROUPE_SCHEDULE_NOT_FOUND");
  const { rows: events } = await client.query("SELECT status FROM carnival_event WHERE id=$1 FOR UPDATE", [current[0].event_id]);
  if (!events[0]) throw new Error("EVENT_NOT_FOUND");
  if (events[0].status !== "CONFIGURING") throw new Error("EVENT_LOCKED");
  await client.query("DELETE FROM night_troupe_schedule WHERE id=$1", [current[0].id]);
  await auditEvent(client, {
    actorUserId, action: "NIGHT_TROUPE_UNSCHEDULED", entityType: "night_troupe_schedule", entityId: current[0].id,
    before: { eventId: current[0].event_id, nightId: current[0].night_id, troupeId: current[0].event_troupe_id },
  });
  return { id: current[0].id };
}

async function reorderSchedule(id, { client = null, actorUserId = null, direction, neighborId, expectedOrder, expectedNeighborOrder }) {
  if (!["UP", "DOWN"].includes(direction)) throw new TypeError("direction debe ser UP o DOWN.");
  const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (typeof id !== "string" || !uuid.test(id) || typeof neighborId !== "string" || !uuid.test(neighborId)) throw new TypeError("IDs invalidos.");
  id = id.toLowerCase();
  neighborId = neighborId.toLowerCase();
  order(expectedOrder);
  order(expectedNeighborOrder);
  if (expectedOrder > 2147483647 || expectedNeighborOrder > 2147483647 || id === neighborId) throw new TypeError("Orden o vecino invalido.");
  if (!client) return inTransaction((client) => reorderSchedule(id, { client, actorUserId, direction, neighborId, expectedOrder, expectedNeighborOrder }));

  const { rows: parents } = await client.query("SELECT event_id FROM night_troupe_schedule WHERE id=$1", [text(id, "id")]);
  if (!parents[0]) throw new Error("NIGHT_TROUPE_SCHEDULE_NOT_FOUND");
  const eventId = parents[0].event_id;
  const { rows: events } = await client.query("SELECT status FROM carnival_event WHERE id=$1 FOR UPDATE", [eventId]);
  if (!events[0]) throw new Error("EVENT_NOT_FOUND");
  if (events[0].status !== "CONFIGURING") throw new Error("EVENT_LOCKED");
  const { rows: currentRows } = await client.query("SELECT * FROM night_troupe_schedule WHERE id=$1 AND event_id=$2 FOR UPDATE", [id, eventId]);
  const current = currentRows[0];
  if (!current) throw new Error("NIGHT_TROUPE_SCHEDULE_NOT_FOUND");

  const { rows: neighbors } = await client.query("SELECT * FROM night_troupe_schedule WHERE id=$1", [neighborId]);
  const neighbor = neighbors[0];
  if (!neighbor) throw new Error("NIGHT_TROUPE_SCHEDULE_NOT_FOUND");
  if (neighbor.event_id !== current.event_id || neighbor.night_id !== current.night_id
      || current.presentation_order !== expectedOrder || neighbor.presentation_order !== expectedNeighborOrder) {
    throw new Error("ORDER_CONFLICT");
  }

  const { rows: siblings } = await client.query(
    "SELECT id FROM night_troupe_schedule WHERE night_id=$1 AND event_id=$2 ORDER BY presentation_order",
    [current.night_id, current.event_id],
  );
  const index = siblings.findIndex((row) => row.id === id);
  const adjacent = siblings[index + (direction === "UP" ? -1 : 1)];
  if (!adjacent) throw new Error("ORDER_BOUNDARY");
  if (adjacent.id !== neighborId) throw new Error("ORDER_CONFLICT");

  await client.query("SET CONSTRAINTS schedule_night_order_unique DEFERRED");
  await client.query(
    `UPDATE night_troupe_schedule SET presentation_order=CASE WHEN id=$1 THEN $4::integer ELSE $3::integer END,
       updated_at=CURRENT_TIMESTAMP WHERE id IN ($1,$2)`,
    [id, neighborId, expectedOrder, expectedNeighborOrder],
  );
  await client.query("SET CONSTRAINTS schedule_night_order_unique IMMEDIATE");
  const changes = [{ id, presentationOrder: expectedNeighborOrder }, { id: neighborId, presentationOrder: expectedOrder }];
  const context = { eventId: current.event_id, nightId: current.night_id, direction };
  await auditEvent(client, {
    actorUserId, action: "NIGHT_TROUPE_SCHEDULE_REORDERED", entityType: "night_troupe_schedule", entityId: id,
    before: { ...context, changes: [{ id, presentationOrder: expectedOrder }, { id: neighborId, presentationOrder: expectedNeighborOrder }] },
    after: { ...context, changes },
  });
  return { changes };
}
