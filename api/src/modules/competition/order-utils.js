import { getPool } from "../../db/pool.js";
import { auditEvent } from "../../audit/audit-service.js";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

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

function positiveInt(value, message) {
  if (!Number.isInteger(value) || value <= 0) throw new TypeError(message);
  return value;
}

export async function nextDisplayOrder({ client = getPool(), table, eventId }) {
  const { rows } = await client.query(
    `SELECT COALESCE(MAX(display_order), 0) + 1 AS next FROM ${table} WHERE event_id = $1`,
    [eventId],
  );
  return Number(rows[0].next);
}

export async function reorderAdjacentEntity({
  table,
  entityLabel,
  advisoryKey,
  client = null,
  id,
  actorUserId = null,
  direction,
  neighborId,
  expectedOrder,
  expectedNeighborOrder,
}) {
  if (!["UP", "DOWN"].includes(direction)) throw new TypeError("direction debe ser UP o DOWN.");
  if (
    typeof id !== "string" ||
    !UUID_RE.test(id) ||
    typeof neighborId !== "string" ||
    !UUID_RE.test(neighborId)
  ) {
    throw new TypeError("IDs invalidos.");
  }
  id = id.toLowerCase();
  neighborId = neighborId.toLowerCase();
  positiveInt(expectedOrder, "displayOrder debe ser entero positivo.");
  positiveInt(expectedNeighborOrder, "displayOrder debe ser entero positivo.");
  if (
    expectedOrder > 2147483647 ||
    expectedNeighborOrder > 2147483647 ||
    id === neighborId
  ) {
    throw new TypeError("Orden o vecino invalido.");
  }
  if (!client) {
    return inTransaction((client) =>
      reorderAdjacentEntity({
        table,
        entityLabel,
        advisoryKey,
        client,
        id,
        actorUserId,
        direction,
        neighborId,
        expectedOrder,
        expectedNeighborOrder,
      }),
    );
  }

  const notFound = `${entityLabel}_NOT_FOUND`;
  const { rows: currentRows } = await client.query(`SELECT * FROM ${table} WHERE id = $1`, [id]);
  const current = currentRows[0];
  if (!current) throw new Error(notFound);
  const eventId = current.event_id;

  await client.query(`SELECT pg_advisory_xact_lock(hashtext($1))`, [`${advisoryKey}${eventId}`]);
  const { rows: eventRows } = await client.query(
    "SELECT status FROM carnival_event WHERE id = $1 FOR UPDATE",
    [eventId],
  );
  if (!eventRows[0]) throw new Error("EVENT_NOT_FOUND");
  if (eventRows[0].status !== "CONFIGURING") throw new Error("EVENT_LOCKED");

  const { rows: neighborRows } = await client.query(`SELECT * FROM ${table} WHERE id = $1`, [neighborId]);
  const neighbor = neighborRows[0];
  if (!neighbor) throw new Error(notFound);
  if (
    neighbor.event_id !== eventId ||
    current.display_order !== expectedOrder ||
    neighbor.display_order !== expectedNeighborOrder
  ) {
    throw new Error("ORDER_CONFLICT");
  }

  const { rows: siblings } = await client.query(
    `SELECT id FROM ${table} WHERE event_id = $1 ORDER BY display_order`,
    [eventId],
  );
  const index = siblings.findIndex((row) => row.id === id);
  const adjacent = siblings[index + (direction === "UP" ? -1 : 1)];
  if (!adjacent) throw new Error("ORDER_BOUNDARY");
  if (adjacent.id !== neighborId) throw new Error("ORDER_CONFLICT");

  const OFFSET = 1000000;
  await client.query(
    `UPDATE ${table} SET display_order = display_order + ${OFFSET}, updated_at = CURRENT_TIMESTAMP WHERE id = $1`,
    [id],
  );
  await client.query(`UPDATE ${table} SET display_order = $2, updated_at = CURRENT_TIMESTAMP WHERE id = $1`, [neighborId, expectedOrder]);
  await client.query(`UPDATE ${table} SET display_order = $2, updated_at = CURRENT_TIMESTAMP WHERE id = $1`, [id, expectedNeighborOrder]);

  const changes = [
    { id, displayOrder: expectedNeighborOrder },
    { id: neighborId, displayOrder: expectedOrder },
  ];
  const context = { eventId, direction };
  await auditEvent(client, {
    actorUserId,
    action: `${entityLabel}_REORDERED`,
    entityType: table,
    entityId: id,
    before: {
      ...context,
      changes: [
        { id, displayOrder: expectedOrder },
        { id: neighborId, displayOrder: expectedNeighborOrder },
      ],
    },
    after: { ...context, changes },
  });
  return { changes };
}