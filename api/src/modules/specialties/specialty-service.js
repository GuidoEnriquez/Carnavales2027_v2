import { getPool } from "../../db/pool.js";
import { requireConfiguringEvent, requireEventExists } from "../events/event-service.js";
import { nextDisplayOrder, reorderAdjacentEntity } from "../competition/order-utils.js";
const text = (v, n) => { if (typeof v !== "string" || !v.trim()) throw new TypeError(`${n} debe ser texto no vacío.`); return v.trim(); };
export async function createSpecialty({ client = getPool(), eventId, name, code }) {
  await requireConfiguringEvent({ client, eventId });
  const normalizedEventId = text(eventId, "eventId");
  await client.query("SELECT pg_advisory_xact_lock(hashtext($1))", [`specialty_order:${normalizedEventId}`]);
  const displayOrder = await nextDisplayOrder({ client, table: "event_specialty", eventId: normalizedEventId });
  const { rows } = await client.query(`INSERT INTO event_specialty (event_id,name,code,display_order) VALUES ($1,$2,$3,$4) RETURNING id,event_id AS "eventId",name,code,display_order AS "displayOrder",active`, [normalizedEventId, text(name, "name"), text(code, "code"), displayOrder]); return rows[0];
}
export async function listSpecialties({ client = getPool(), eventId }) { await requireEventExists({ client, eventId }); const { rows } = await client.query(`SELECT id,event_id AS "eventId",name,code,display_order AS "displayOrder",active FROM event_specialty WHERE event_id=$1 ORDER BY display_order`, [text(eventId, "eventId")]); return rows; }
export async function updateSpecialty({ client = getPool(), specialtyId, name, code, active }) {
  const nextName = name === undefined ? null : text(name, "name");
  const nextCode = code === undefined ? null : text(code, "code");
  if (active !== undefined && typeof active !== "boolean") throw new TypeError("active debe ser booleano.");
  const nextActive = active === undefined ? null : active;
  const { rows } = await client.query(
    `UPDATE event_specialty s
        SET name=COALESCE($2,s.name),
            code=COALESCE($3,s.code),
            active=COALESCE($4,s.active),
            updated_at=CURRENT_TIMESTAMP
      WHERE s.id=$1
      RETURNING s.id,s.event_id AS "eventId",s.name,s.code,s.display_order AS "displayOrder",s.active`,
    [text(specialtyId,"specialtyId"),nextName,nextCode,nextActive],
  );
  if (!rows[0]) throw new Error("SPECIALTY_NOT_FOUND");
  return rows[0];
}
export function reorderSpecialty({ client = null, specialtyId, ...input }) {
  return reorderAdjacentEntity({
    table: "event_specialty",
    entityLabel: "SPECIALTY",
    advisoryKey: "specialty_order:",
    client,
    id: specialtyId,
    ...input,
  });
}