import assert from "node:assert/strict";
import test from "node:test";
import { closePool, getPool } from "../pool.js";
import { migrate } from "../migrate.js";
import { createEvent, createNight } from "../../modules/events/event-service.js";

test("la programación nocturna impide duplicar comparsa u orden dentro de una noche", { skip: !process.env.TEST_DATABASE_URL }, async (context) => {
  const original=process.env.DATABASE_URL;context.after(async()=>{await closePool();if(original===undefined)delete process.env.DATABASE_URL;else process.env.DATABASE_URL=original;});process.env.DATABASE_URL=process.env.TEST_DATABASE_URL;await migrate();const c=await getPool().connect();
  try{await c.query('BEGIN');const e=await createEvent({client:c,name:'Schedule'});const n=await createNight({client:c,eventId:e.id,name:'Noche',displayOrder:1,kind:'COMPETITION'});const {rows:cat}=await c.query(`INSERT INTO event_category(event_id,name,code,display_order) VALUES($1,'Cat','CAT',1) RETURNING id`,[e.id]);const {rows:t}=await c.query(`INSERT INTO event_troupe(event_id,category_id,name) VALUES($1,$2,'Comparsa') RETURNING id`,[e.id,cat[0].id]);await c.query(`INSERT INTO night_troupe_schedule(event_id,night_id,event_troupe_id,presentation_order) VALUES($1,$2,$3,1)`,[e.id,n.id,t[0].id]);await c.query('SAVEPOINT duplicate_troupe');await assert.rejects(()=>c.query(`INSERT INTO night_troupe_schedule(event_id,night_id,event_troupe_id,presentation_order) VALUES($1,$2,$3,2)`,[e.id,n.id,t[0].id]),/unique|duplicate/i);await c.query('ROLLBACK TO SAVEPOINT duplicate_troupe');await c.query('SAVEPOINT duplicate_order');await assert.rejects(()=>c.query(`INSERT INTO night_troupe_schedule(event_id,night_id,event_troupe_id,presentation_order) VALUES($1,$2,$3,1)`,[e.id,n.id,t[0].id]),/unique|duplicate/i);await c.query('ROLLBACK TO SAVEPOINT duplicate_order');}finally{await c.query('ROLLBACK');c.release();}
});
