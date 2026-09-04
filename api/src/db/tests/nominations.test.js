import assert from "node:assert/strict";
import test from "node:test";
import { closePool, getPool } from "../pool.js";
import { migrate } from "../migrate.js";
import { createEvent } from "../../modules/events/event-service.js";

test("las nominaciones se vinculan a comparsa y rubro del mismo evento sin rutas operativas", { skip: !process.env.TEST_DATABASE_URL }, async (context) => {
  const original=process.env.DATABASE_URL; context.after(async()=>{await closePool();if(original===undefined)delete process.env.DATABASE_URL;else process.env.DATABASE_URL=original;}); process.env.DATABASE_URL=process.env.TEST_DATABASE_URL;await migrate();const c=await getPool().connect();
  try {await c.query('BEGIN');const a=await createEvent({client:c,name:'Nom A'}),b=await createEvent({client:c,name:'Nom B'});const {rows:cats}=await c.query(`INSERT INTO event_category(event_id,name,code,display_order) VALUES($1,'A','A',1),($2,'B','B',1) RETURNING id,event_id`,[a.id,b.id]);const ca=cats.find(x=>x.event_id===a.id);const {rows:troupes}=await c.query(`INSERT INTO event_troupe(event_id,category_id,name) VALUES($1,$2,'Troupe') RETURNING id`,[a.id,ca.id]);const {rows:rubrics}=await c.query(`INSERT INTO rubric(event_id,name,code,evaluation_target,expected_subject_type) VALUES($1,'Nominativo','NOM','NOMINATION','PERSON') RETURNING id`,[a.id]);await c.query(`INSERT INTO troupe_nomination(event_id,event_troupe_id,rubric_id,subject_type,display_name) VALUES($1,$2,$3,'PERSON','Figura')`,[a.id,troupes[0].id,rubrics[0].id]);await c.query('SAVEPOINT nom_other_event');await assert.rejects(()=>c.query(`INSERT INTO troupe_nomination(event_id,event_troupe_id,rubric_id,subject_type,display_name) VALUES($1,$2,$3,'PERSON','Ajena')`,[b.id,troupes[0].id,rubrics[0].id]),{ code: "23503" });await c.query('ROLLBACK TO SAVEPOINT nom_other_event');}finally{await c.query('ROLLBACK');c.release();}
});
