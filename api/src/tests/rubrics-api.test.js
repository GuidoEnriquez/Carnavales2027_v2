import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import { createApp } from "../app.js";
import { closePool, getPool } from "../db/pool.js";
import { migrate } from "../db/migrate.js";

test("API ADMIN crea ítems y devuelve especialidades derivadas", { skip: !process.env.TEST_DATABASE_URL }, async (context) => {
  const original=process.env.DATABASE_URL; context.after(async()=>{await closePool(); if(original===undefined) delete process.env.DATABASE_URL; else process.env.DATABASE_URL=original;}); process.env.DATABASE_URL=process.env.TEST_DATABASE_URL; await migrate();
  const adminId=randomUUID(), pool=getPool(); await pool.query(`INSERT INTO "user"(id,name,email,"emailVerified") VALUES($1,'Rubric admin',$2,true)`,[adminId,`${adminId}@example.test`]); await pool.query("INSERT INTO user_role(user_id,role_code) VALUES($1,'ADMIN')",[adminId]);
  const app=createApp({getSession:async({headers})=>headers.get('x-test-session')==='admin'?{user:{id:adminId,twoFactorEnabled:true}}:null}); const server=await new Promise(r=>{const i=app.listen(0,'127.0.0.1',()=>r(i));});
  try { const base=`http://127.0.0.1:${server.address().port}`, headers={'content-type':'application/json','x-test-session':'admin'};
    const createEvent=async name=>(await fetch(`${base}/api/v1/events`,{method:'POST',headers,body:JSON.stringify({name})})).json(); const event=await createEvent('Rubros API');
    const specialty=await (await fetch(`${base}/api/v1/events/${event.id}/specialties`,{method:'POST',headers,body:JSON.stringify({name:'Especialidad',code:'ESP',displayOrder:1})})).json();
    const rubric=await (await fetch(`${base}/api/v1/events/${event.id}/rubrics`,{method:'POST',headers,body:JSON.stringify({name:'Rubro',code:'RUB',evaluationTarget:'TROUPE'})})).json();
    const invalidNomination=await fetch(`${base}/api/v1/events/${event.id}/rubrics`,{method:'POST',headers,body:JSON.stringify({name:'Reina inválida',code:'REINA_INVALIDA',evaluationTarget:'NOMINATION'})});assert.equal(invalidNomination.status,400);
    const nominationResponse=await fetch(`${base}/api/v1/events/${event.id}/rubrics`,{method:'POST',headers,body:JSON.stringify({name:'Reina',code:'REINA',evaluationTarget:'NOMINATION',expectedSubjectType:'PERSON'})});assert.equal(nominationResponse.status,201);const nomination=await nominationResponse.json();assert.equal(nomination.expectedSubjectType,'PERSON');
    const listed=await fetch(`${base}/api/v1/events/${event.id}/rubrics`,{headers}); assert.equal(listed.status,200); assert.deepEqual((await listed.json()).map(({id,code})=>({id,code})),[{id:nomination.id,code:'REINA'},{id:rubric.id,code:'RUB'}]);
    const inactiveSpecialty=await (await fetch(`${base}/api/v1/events/${event.id}/specialties`,{method:'POST',headers,body:JSON.stringify({name:'Especialidad inactiva',code:'ESP_OFF',displayOrder:2})})).json();
    await pool.query("UPDATE event_specialty SET active=false WHERE id=$1",[inactiveSpecialty.id]);
    const invalidItem=await fetch(`${base}/api/v1/rubrics/${rubric.id}/items`,{method:'POST',headers,body:JSON.stringify({name:'Ítem inválido',code:'ITEM_OFF',specialtyId:inactiveSpecialty.id})}); assert.equal(invalidItem.status,409); assert.deepEqual(await invalidItem.json(),{code:'SPECIALTY_INACTIVE'});
    const item=await fetch(`${base}/api/v1/rubrics/${rubric.id}/items`,{method:'POST',headers,body:JSON.stringify({name:'Ítem',code:'ITEM',specialtyId:specialty.id})}); assert.equal(item.status,201);
    const read=await fetch(`${base}/api/v1/rubrics/${rubric.id}`,{headers}); const body=await read.json(); assert.deepEqual(body.specialties,[{id:specialty.id,code:'ESP',name:'Especialidad'}]);
    const direct=await fetch(`${base}/api/v1/rubrics/${rubric.id}/specialties`,{method:'POST',headers,body:'{}'}); assert.equal(direct.status,404);
  } finally { await new Promise(r=>server.close(r)); }
});
