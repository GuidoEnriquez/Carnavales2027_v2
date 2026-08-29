import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import { createApp } from "../app.js";
import { closePool, getPool } from "../db/pool.js";
import { migrate } from "../db/migrate.js";

test("readiness y apertura exponen contrato HTTP ADMIN", { skip: !process.env.TEST_DATABASE_URL }, async (context) => {
 const original=process.env.DATABASE_URL;context.after(async()=>{await closePool();if(original===undefined)delete process.env.DATABASE_URL;else process.env.DATABASE_URL=original;});process.env.DATABASE_URL=process.env.TEST_DATABASE_URL;await migrate();const id=randomUUID(),pool=getPool();await pool.query(`INSERT INTO "user"(id,name,email,"emailVerified") VALUES($1,'Ready admin',$2,true)`,[id,`${id}@example.test`]);await pool.query("INSERT INTO user_role(user_id,role_code) VALUES($1,'ADMIN')",[id]);const app=createApp({getSession:async({headers})=>headers.get('x-test-session')==='admin'?{user:{id,twoFactorEnabled:true}}:null});const server=await new Promise(r=>{const i=app.listen(0,'127.0.0.1',()=>r(i));});try{const base=`http://127.0.0.1:${server.address().port}`,h={'content-type':'application/json','x-test-session':'admin'};const post=async(path,body)=>(await fetch(`${base}${path}`,{method:'POST',headers:h,body:JSON.stringify(body)}));const event=await (await post('/api/v1/events',{name:'HTTP readiness'})).json();const ready=await fetch(`${base}/api/v1/events/${event.id}/readiness`,{headers:h});assert.equal(ready.status,200);assert.ok((await ready.json()).missing.includes('COMPETITION_NIGHT'));const incompleteOpen=await post(`/api/v1/events/${event.id}/open`,{});assert.equal(incompleteOpen.status,409);assert.equal((await incompleteOpen.json()).error.code,'EVENT_CONFIGURATION_INCOMPLETE');
 const category=await (await post(`/api/v1/events/${event.id}/categories`,{name:'Primera',code:'PRIMERA',displayOrder:1})).json();await post(`/api/v1/events/${event.id}/troupes`,{name:'Comparsa smoke',categoryId:category.id});const specialty=await (await post(`/api/v1/events/${event.id}/specialties`,{name:'Baile',code:'BAILE',displayOrder:1})).json();const rubric=await (await post(`/api/v1/events/${event.id}/rubrics`,{name:'Coreografía',code:'COREO',evaluationTarget:'TROUPE'})).json();await post(`/api/v1/rubrics/${rubric.id}/items`,{name:'Ejecución',code:'EJECUCION',specialtyId:specialty.id});await post(`/api/v1/events/${event.id}/nights`,{name:'Noche 1',displayOrder:1,kind:'COMPETITION'});const complete=await (await fetch(`${base}/api/v1/events/${event.id}/readiness`,{headers:h})).json();assert.equal(complete.ready,true);const opened=await post(`/api/v1/events/${event.id}/open`,{});assert.equal(opened.status,200);assert.equal((await opened.json()).status,'OPEN');
 const lockedWrites = [
   post(`/api/v1/events/${event.id}/nights`,{name:'Noche bloqueada',displayOrder:2,kind:'COMPETITION'}),
   post(`/api/v1/events/${event.id}/categories`,{name:'Categoría bloqueada',code:'BLOQUEADA',displayOrder:2}),
   post(`/api/v1/events/${event.id}/troupes`,{name:'Comparsa bloqueada',categoryId:category.id}),
   post(`/api/v1/events/${event.id}/specialties`,{name:'Especialidad bloqueada',code:'BLOQUEADA',displayOrder:2}),
   post(`/api/v1/events/${event.id}/rubrics`,{name:'Rubro bloqueado',code:'BLOQUEADO',evaluationTarget:'TROUPE'}),
   post(`/api/v1/rubrics/${rubric.id}/items`,{name:'Ítem bloqueado',code:'BLOQUEADO',specialtyId:specialty.id}),
 ];
 for (const response of await Promise.all(lockedWrites)) {
   assert.equal(response.status,409);
   assert.equal((await response.json()).code,'EVENT_LOCKED');
 }
 const edit=await fetch(`${base}/api/v1/events/${event.id}`,{method:'PATCH',headers:h,body:JSON.stringify({name:'No permitido'})});assert.equal(edit.status,409);assert.equal((await edit.json()).code,'EVENT_LOCKED');}finally{await new Promise(r=>server.close(r));}
});

test("readiness y apertura de un evento inexistente responden 404", { skip: !process.env.TEST_DATABASE_URL }, async (context) => {
 const original=process.env.DATABASE_URL;context.after(async()=>{await closePool();if(original===undefined)delete process.env.DATABASE_URL;else process.env.DATABASE_URL=original;});process.env.DATABASE_URL=process.env.TEST_DATABASE_URL;await migrate();const id=randomUUID(),pool=getPool();await pool.query(`INSERT INTO "user"(id,name,email,"emailVerified") VALUES($1,'Missing event admin',$2,true)`,[id,`${id}@example.test`]);await pool.query("INSERT INTO user_role(user_id,role_code) VALUES($1,'ADMIN')",[id]);const app=createApp({getSession:async()=>({user:{id,twoFactorEnabled:true}})});const server=await new Promise(r=>{const i=app.listen(0,'127.0.0.1',()=>r(i));});try{const eventId=randomUUID(),base=`http://127.0.0.1:${server.address().port}/api/v1/events/${eventId}`;const readiness=await fetch(`${base}/readiness`);assert.equal(readiness.status,404);assert.deepEqual(await readiness.json(),{code:'EVENT_NOT_FOUND'});const response=await fetch(`${base}/open`,{method:'POST'});assert.equal(response.status,404);assert.deepEqual(await response.json(),{code:'EVENT_NOT_FOUND'});}finally{await new Promise(r=>server.close(r));}
});
