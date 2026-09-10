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
            s.presentation_order AS "presentationOrder", s.status
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
