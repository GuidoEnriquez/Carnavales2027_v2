import assert from "node:assert/strict";
import test from "node:test";
import { closePool, getPool } from "../pool.js";
import { migrate } from "../migrate.js";
import { createEvent } from "../../modules/events/event-service.js";

test("los ítems derivan especialidades activas del rubro sin relación directa", { skip: !process.env.TEST_DATABASE_URL }, async (context) => {
  const original = process.env.DATABASE_URL;
  context.after(async () => { await closePool(); if (original === undefined) delete process.env.DATABASE_URL; else process.env.DATABASE_URL = original; });
  process.env.DATABASE_URL = process.env.TEST_DATABASE_URL; await migrate();
  const client = await getPool().connect();
  try {
    await client.query("BEGIN");
    const eventA = await createEvent({ client, name: "Rubros A" }); const eventB = await createEvent({ client, name: "Rubros B" });
    const { rows: specialties } = await client.query(`INSERT INTO event_specialty(event_id,name,code,display_order) VALUES ($1,'Especialidad A','A',1),($2,'Especialidad B','B',1) RETURNING id,event_id`, [eventA.id,eventB.id]);
    const specialtyA = specialties.find((s) => s.event_id === eventA.id); const specialtyB = specialties.find((s) => s.event_id === eventB.id);
    const { rows: rubrics } = await client.query(`INSERT INTO rubric(event_id,name,code,evaluation_target) VALUES ($1,'Rubro A','RUBRO_A','TROUPE') RETURNING id`, [eventA.id]);
    await client.query(`INSERT INTO evaluation_item(event_id,rubric_id,specialty_id,name,code) VALUES ($1,$2,$3,'Ítem A','ITEM_A')`, [eventA.id,rubrics[0].id,specialtyA.id]);
    const { rows: derived } = await client.query(`SELECT DISTINCT s.code FROM evaluation_item i JOIN event_specialty s ON s.id=i.specialty_id WHERE i.rubric_id=$1 AND i.active AND s.active`, [rubrics[0].id]);
    assert.deepEqual(derived,[{code:"A"}]);
    await client.query("SAVEPOINT cross_event_specialty");
    await assert.rejects(() => client.query(`INSERT INTO evaluation_item(event_id,rubric_id,specialty_id,name,code) VALUES ($1,$2,$3,'Ajeno','AJENO')`, [eventA.id,rubrics[0].id,specialtyB.id]), /foreign key/i);
    await client.query("ROLLBACK TO SAVEPOINT cross_event_specialty");
    await client.query("UPDATE event_specialty SET active=false WHERE id=$1", [specialtyA.id]);
    await client.query("SAVEPOINT inactive_specialty");
    await assert.rejects(() => client.query(`INSERT INTO evaluation_item(event_id,rubric_id,specialty_id,name,code) VALUES ($1,$2,$3,'Inactivo','INACTIVO')`, [eventA.id,rubrics[0].id,specialtyA.id]), /SPECIALTY_INACTIVE/);
    await client.query("ROLLBACK TO SAVEPOINT inactive_specialty");
    const { rows: forbidden } = await client.query("SELECT to_regclass('public.rubro_especialidad') AS name"); assert.equal(forbidden[0].name,null);
  } finally { await client.query("ROLLBACK"); client.release(); }
});
