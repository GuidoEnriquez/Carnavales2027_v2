import assert from "node:assert/strict";
import test from "node:test";
import { openEvent } from "../../modules/events/event-readiness.service.js";
import { createEvent, createNight } from "../../modules/events/event-service.js";
import { migrate } from "../migrate.js";
import { closePool, getPool } from "../pool.js";

test("criterios, nominaciones y programación quedan bloqueados al abrir", {
  skip: !process.env.TEST_DATABASE_URL,
}, async (context) => {
  const original = process.env.DATABASE_URL;
  context.after(async () => {
    await closePool();
    if (original === undefined) delete process.env.DATABASE_URL;
    else process.env.DATABASE_URL = original;
  });
  process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;
  await migrate();

  const client = await getPool().connect();
  try {
    await client.query("BEGIN");
    const event = await createEvent({ client, name: "Cierre de configuración" });
    const night = await createNight({
      client,
      eventId: event.id,
      name: "Noche competitiva",
      displayOrder: 1,
      kind: "COMPETITION",
    });
    const { rows: categories } = await client.query(
      "INSERT INTO event_category(event_id,name,code,display_order) VALUES($1,'Primera','PRIMERA',1) RETURNING id",
      [event.id],
    );
    const { rows: troupes } = await client.query(
      "INSERT INTO event_troupe(event_id,category_id,name) VALUES($1,$2,'Comparsa') RETURNING id",
      [event.id, categories[0].id],
    );
    const { rows: specialties } = await client.query(
      "INSERT INTO event_specialty(event_id,name,code,display_order) VALUES($1,'Baile','BAILE',1) RETURNING id",
      [event.id],
    );
    const { rows: rubrics } = await client.query(
      "INSERT INTO rubric(event_id,name,code,evaluation_target,expected_subject_type) VALUES($1,'Reina','REINA','NOMINATION','PERSON') RETURNING id",
      [event.id],
    );
    const { rows: items } = await client.query(
      "INSERT INTO evaluation_item(event_id,rubric_id,specialty_id,name,code) VALUES($1,$2,$3,'Presentación','PRESENTACION') RETURNING id",
      [event.id, rubrics[0].id, specialties[0].id],
    );
    const { rows: criteria } = await client.query(
      "INSERT INTO rubric_criterion(event_id,rubric_id,scoring_item_id,description,display_order) VALUES($1,$2,$3,'Descripción reglamentaria',1) RETURNING id",
      [event.id, rubrics[0].id, items[0].id],
    );
    const { rows: nominations } = await client.query(
      "INSERT INTO troupe_nomination(event_id,event_troupe_id,rubric_id,subject_type,display_name) VALUES($1,$2,$3,'PERSON','Figura') RETURNING id",
      [event.id, troupes[0].id, rubrics[0].id],
    );
    const { rows: schedules } = await client.query(
      "INSERT INTO night_troupe_schedule(event_id,night_id,event_troupe_id,presentation_order) VALUES($1,$2,$3,1) RETURNING id",
      [event.id, night.id, troupes[0].id],
    );

    const { rows: columns } = await client.query(
      "SELECT column_name FROM information_schema.columns WHERE table_name='rubric_criterion' ORDER BY column_name",
    );
    assert.equal(columns.some(({ column_name }) => column_name.includes("score")), false);

    await openEvent({ client, eventId: event.id });
    await client.query("COMMIT");

    const assertLocked = async (sql, parameters) => {
      await client.query("BEGIN");
      await assert.rejects(client.query(sql, parameters), /EVENT_LOCKED/);
      await client.query("ROLLBACK");
    };
    await assertLocked("UPDATE rubric_criterion SET description='Cambio' WHERE id=$1", [criteria[0].id]);
    await assertLocked("DELETE FROM rubric_criterion WHERE id=$1", [criteria[0].id]);
    await assertLocked("INSERT INTO rubric_criterion(event_id,rubric_id,description,display_order) VALUES($1,$2,'Otro',2)", [event.id, rubrics[0].id]);
    await assertLocked("UPDATE troupe_nomination SET display_name='Cambio' WHERE id=$1", [nominations[0].id]);
    await assertLocked("DELETE FROM troupe_nomination WHERE id=$1", [nominations[0].id]);
    await assertLocked("INSERT INTO troupe_nomination(event_id,event_troupe_id,rubric_id,subject_type,display_name) VALUES($1,$2,$3,'PERSON','Otra')", [event.id, troupes[0].id, rubrics[0].id]);
    await assertLocked("UPDATE night_troupe_schedule SET status='CANCELLED' WHERE id=$1", [schedules[0].id]);
    await assertLocked("DELETE FROM night_troupe_schedule WHERE id=$1", [schedules[0].id]);
    await assertLocked("INSERT INTO night_troupe_schedule(event_id,night_id,event_troupe_id,presentation_order) VALUES($1,$2,$3,2)", [event.id, night.id, troupes[0].id]);
  } finally {
    await client.query("ROLLBACK").catch(() => {});
    client.release();
  }
});
