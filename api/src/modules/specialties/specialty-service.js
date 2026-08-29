import { getPool } from "../../db/pool.js";
const text = (v, n) => { if (typeof v !== "string" || !v.trim()) throw new TypeError(`${n} debe ser texto no vacío.`); return v.trim(); };
const order = (v) => { if (!Number.isInteger(v) || v <= 0) throw new TypeError("displayOrder debe ser entero positivo."); return v; };
export async function createSpecialty({ client = getPool(), eventId, name, code, displayOrder }) {
  const { rows } = await client.query(`INSERT INTO event_specialty (event_id,name,code,display_order) VALUES ($1,$2,$3,$4) RETURNING id,event_id AS "eventId",name,code,display_order AS "displayOrder",active`, [text(eventId,"eventId"),text(name,"name"),text(code,"code"),order(displayOrder)]); return rows[0];
}
export async function listSpecialties({ client = getPool(), eventId }) { const { rows } = await client.query(`SELECT id,event_id AS "eventId",name,code,display_order AS "displayOrder",active FROM event_specialty WHERE event_id=$1 ORDER BY display_order`, [text(eventId,"eventId")]); return rows; }
export async function updateSpecialty({ client = getPool(), specialtyId, active }) { const { rows } = await client.query(`UPDATE event_specialty s SET active=$2,updated_at=CURRENT_TIMESTAMP FROM carnival_event e WHERE s.id=$1 AND s.event_id=e.id AND e.status='CONFIGURING' RETURNING s.id,s.event_id AS "eventId",s.name,s.code,s.display_order AS "displayOrder",s.active`, [text(specialtyId,"specialtyId"),Boolean(active)]); if (!rows[0]) throw new Error("EVENT_LOCKED"); return rows[0]; }
