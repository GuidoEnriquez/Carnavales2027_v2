import { auditEvent } from "../../audit/audit-service.js";
import { getPool } from "../../db/pool.js";

export async function getReadiness({ client = getPool(), eventId }) {
  const event = await client.query("SELECT 1 FROM carnival_event WHERE id=$1", [eventId]);
  if (!event.rows[0]) throw new Error("EVENT_NOT_FOUND");
  const missing=[];
  const scalar=async(sql)=>Number((await client.query(sql,[eventId])).rows[0].count);
  if(!await scalar("SELECT COUNT(*) FROM night WHERE event_id=$1 AND kind='COMPETITION'")) missing.push('COMPETITION_NIGHT');
  if(!await scalar("SELECT COUNT(*) FROM event_troupe WHERE event_id=$1 AND active")) missing.push('ACTIVE_TROUPE');
  if(!await scalar("SELECT COUNT(*) FROM event_specialty WHERE event_id=$1 AND active")) missing.push('ACTIVE_SPECIALTY');
  if(!await scalar("SELECT COUNT(*) FROM rubric WHERE event_id=$1 AND active")) missing.push('ACTIVE_RUBRIC');
  const {rows:incompleteTroupes}=await client.query(`SELECT t.id,t.name FROM event_troupe t LEFT JOIN event_category c ON c.id=t.category_id WHERE t.event_id=$1 AND t.active AND (c.id IS NULL OR NOT c.active)`,[eventId]);
  const { rows: incompleteRubrics } = await client.query(
    `SELECT r.id, r.code
       FROM rubric r
      WHERE r.event_id = $1
        AND r.active
        AND (
          NOT EXISTS (
            SELECT 1 FROM evaluation_item i
             WHERE i.rubric_id = r.id AND i.active
          )
          OR EXISTS (
            SELECT 1
              FROM evaluation_item i
              JOIN event_specialty s ON s.id = i.specialty_id
             WHERE i.rubric_id = r.id
               AND i.active
               AND NOT s.active
          )
        )`,
    [eventId],
  );
  return {ready:missing.length===0&&incompleteTroupes.length===0&&incompleteRubrics.length===0,missing,incompleteTroupes,incompleteRubrics};
}

export async function openEvent({ client = null, eventId, actorUserId = null }) {
 const owned=!client; const db=client??await getPool().connect();
 try{if(owned)await db.query('BEGIN');const {rows}=await db.query("SELECT id,status FROM carnival_event WHERE id=$1 FOR UPDATE",[eventId]);if(!rows[0])throw new Error('EVENT_NOT_FOUND');if(rows[0].status!=='CONFIGURING')throw new Error('EVENT_LOCKED');const readiness=await getReadiness({client:db,eventId});if(!readiness.ready){const error=new Error('EVENT_CONFIGURATION_INCOMPLETE');error.readiness=readiness;throw error;}await db.query("SELECT set_config('app.allow_event_open','true',true)");const {rows:updated}=await db.query("UPDATE carnival_event SET status='OPEN',updated_at=CURRENT_TIMESTAMP WHERE id=$1 RETURNING id,name,status",[eventId]);await auditEvent(db,{actorUserId,action:'EVENT_OPENED',entityType:'carnival_event',entityId:eventId,after:{status:'OPEN'}});if(owned)await db.query('COMMIT');return updated[0];}catch(error){if(owned)await db.query('ROLLBACK');throw error;}finally{if(owned)db.release();}
}
