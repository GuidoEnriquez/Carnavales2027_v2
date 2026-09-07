import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { after, before, test } from "node:test";
import { migrate } from "../migrate.js";
import { closePool, getPool } from "../pool.js";

const originalDatabaseUrl = process.env.DATABASE_URL;
let client;

before(async () => {
  process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;
  await migrate();
  client = await getPool().connect();
});

after(async () => {
  client?.release();
  await closePool();
  if (originalDatabaseUrl === undefined) delete process.env.DATABASE_URL;
  else process.env.DATABASE_URL = originalDatabaseUrl;
});

test("Spec 017 conserva una unica clasificacion de rubro y no duplica tipos de participacion", async () => {
  const { rows: columns } = await client.query(
    `SELECT column_name FROM information_schema.columns
      WHERE table_schema = current_schema() AND table_name = 'rubric'
        AND column_name IN ('rubric_kind', 'rubric_type')
      ORDER BY column_name`,
  );
  assert.deepEqual(columns.map(({ column_name }) => column_name), ["rubric_type"]);

  const { rows: duplicateCatalog } = await client.query(
    `SELECT table_name FROM information_schema.tables
      WHERE table_schema = current_schema() AND table_name = 'participation_type'`,
  );
  assert.deepEqual(duplicateCatalog, []);
});

test("Spec 017 asigna ordenes positivos compatibles a items que omiten display_order", async () => {
  const eventId = randomUUID();
  await client.query("INSERT INTO carnival_event(id, name) VALUES($1, $2)", [eventId, `Orden ${eventId}`]);
  const { rows: [specialty] } = await client.query(
    "INSERT INTO event_specialty(event_id, name, code, display_order) VALUES($1, 'Especialidad', $2, 1) RETURNING id",
    [eventId, `ESP_${eventId}`],
  );
  const { rows: [rubric] } = await client.query(
    `INSERT INTO rubric(event_id, name, code, evaluation_target, rubric_type, resolution_method)
     VALUES($1, 'Rubro', $2, 'TROUPE', 'GENERAL', 'COMMITTEE') RETURNING id`,
    [eventId, `RUB_${eventId}`],
  );

  const { rows: [first] } = await client.query(
    "INSERT INTO evaluation_item(event_id, rubric_id, specialty_id, name, code) VALUES($1,$2,$3,'Primero',$4) RETURNING display_order",
    [eventId, rubric.id, specialty.id, `I1_${eventId}`],
  );
  const { rows: [second] } = await client.query(
    "INSERT INTO evaluation_item(event_id, rubric_id, specialty_id, name, code) VALUES($1,$2,$3,'Segundo',$4) RETURNING display_order",
    [eventId, rubric.id, specialty.id, `I2_${eventId}`],
  );

  assert.equal(first.display_order, 1);
  assert.equal(second.display_order, 2);
});

test("Spec 017 impide vincular un criterio a un item de otro rubro", async () => {
  const eventId = randomUUID();
  await client.query("INSERT INTO carnival_event(id, name) VALUES($1, $2)", [eventId, `Criterios ${eventId}`]);
  const { rows: [specialty] } = await client.query(
    "INSERT INTO event_specialty(event_id, name, code, display_order) VALUES($1, 'Especialidad', $2, 1) RETURNING id",
    [eventId, `ESP_${eventId}`],
  );
  const { rows: rubrics } = await client.query(
    `INSERT INTO rubric(event_id, name, code, evaluation_target, rubric_type)
     VALUES($1, 'Rubro A', $2, 'TROUPE', 'NOMINATIVE'),
           ($1, 'Rubro B', $3, 'TROUPE', 'SPECIAL')
     RETURNING id`,
    [eventId, `RA_${eventId}`, `RB_${eventId}`],
  );
  const { rows: [item] } = await client.query(
    "INSERT INTO evaluation_item(event_id, rubric_id, specialty_id, name, code) VALUES($1,$2,$3,'Item',$4) RETURNING id",
    [eventId, rubrics[0].id, specialty.id, `ITEM_${eventId}`],
  );

  await assert.rejects(
    client.query(
      `INSERT INTO rubric_criterion(event_id, rubric_id, scoring_item_id, description, display_order)
       VALUES($1,$2,$3,'Cruce invalido',1)`,
      [eventId, rubrics[1].id, item.id],
    ),
    { code: "23503" },
  );
});
