import assert from "node:assert/strict";
import test from "node:test";
import { getReadiness, openEvent } from "../modules/events/event-readiness.service.js";
import { closePool, getPool } from "../db/pool.js";
import { migrate } from "../db/migrate.js";
import { createEvent, createNight } from "../modules/events/event-service.js";

test("readiness identifica faltantes y abre transaccionalmente una configuración completa", { skip: !process.env.TEST_DATABASE_URL }, async (context) => {
 const original=process.env.DATABASE_URL;context.after(async()=>{await closePool();if(original===undefined)delete process.env.DATABASE_URL;else process.env.DATABASE_URL=original;});process.env.DATABASE_URL=process.env.TEST_DATABASE_URL;await migrate();const c=await getPool().connect();
 try{await c.query('BEGIN');const e=await createEvent({client:c,name:'Ready'});const empty=await getReadiness({client:c,eventId:e.id});assert.ok(empty.missing.includes('COMPETITION_NIGHT'));
 await createNight({client:c,eventId:e.id,name:'Noche',displayOrder:1,kind:'COMPETITION'});const {rows:cat}=await c.query(`INSERT INTO event_category(event_id,name,code,display_order) VALUES($1,'Cat','CAT',1) RETURNING id`,[e.id]);await c.query(`INSERT INTO event_troupe(event_id,category_id,name) VALUES($1,$2,'Troupe')`,[e.id,cat[0].id]);const {rows:s}=await c.query(`INSERT INTO event_specialty(event_id,name,code,display_order) VALUES($1,'Spec','SPEC',1) RETURNING id`,[e.id]);const {rows:r}=await c.query(`INSERT INTO rubric(event_id,name,code,evaluation_target) VALUES($1,'Rub','RUB','TROUPE') RETURNING id`,[e.id]);await c.query(`INSERT INTO evaluation_item(event_id,rubric_id,specialty_id,name,code) VALUES($1,$2,$3,'Item','ITEM')`,[e.id,r[0].id,s[0].id]);const ready=await getReadiness({client:c,eventId:e.id});assert.equal(ready.ready,true);const opened=await openEvent({client:c,eventId:e.id});assert.equal(opened.status,'OPEN');}finally{await c.query('ROLLBACK');c.release();}
});
