import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { getPool, closePool } from "../pool.js";

test("076 preserva programación histórica y permite reorden en OPEN sin mutar horarios", {
  skip: !process.env.TEST_DATABASE_URL,
}, async (t) => {
  const original = process.env.DATABASE_URL;
  process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;
  const client = await getPool().connect();
  t.after(async () => {
    await client.query("ROLLBACK"); client.release(); await closePool();
    if (original === undefined) delete process.env.DATABASE_URL; else process.env.DATABASE_URL = original;
  });
  await client.query("BEGIN");
  const schema = `schedule_history_${randomUUID().replaceAll("-", "")}`;
  await client.query(`CREATE SCHEMA ${schema}`);
  await client.query(`SET LOCAL search_path TO ${schema}, pg_catalog`);
  const migrations = ["007_events", "008_categories", "009_troupes", "010_specialties", "011_rubrics", "012_nominations",
    "013_night_schedule", "014_event_configuration_guard", "016_forbid_event_reassignment", "017_complete_event_immutability",
    "018_require_audited_event_open", "019_configuration_closure", "020_allow_unchanged_inactive_references",
    "021_guard_inactive_reference_reactivation", "029_night_operational_status", "072_schedule_order_deferrable", "074_schedule_reorder_in_open_event"];
  const apply = async (name) => client.query(await readFile(new URL(`../migrations/${name}.sql`, import.meta.url), "utf8"));
  for (const name of migrations) await apply(name);
  const { rows: [event] } = await client.query("INSERT INTO carnival_event(name) VALUES('Historical schedule') RETURNING id");
  const { rows: [category] } = await client.query("INSERT INTO event_category(event_id,name,code,display_order) VALUES($1,'C','C',1) RETURNING id", [event.id]);
  const { rows: [night] } = await client.query("INSERT INTO night(event_id,name,display_order,kind) VALUES($1,'N',1,'COMPETITION') RETURNING id", [event.id]);
  const { rows: [specialty] } = await client.query("INSERT INTO event_specialty(event_id,name,code,display_order) VALUES($1,'S','S',1) RETURNING id", [event.id]);
  const { rows: [rubric] } = await client.query("INSERT INTO rubric(event_id,name,code,evaluation_target) VALUES($1,'R','R','TROUPE') RETURNING id", [event.id]);
  await client.query("INSERT INTO evaluation_item(event_id,rubric_id,specialty_id,name,code) VALUES($1,$2,$3,'I','I')", [event.id, rubric.id, specialty.id]);
  for (let position = 1; position <= 2; position++) {
    const { rows: [troupe] } = await client.query("INSERT INTO event_troupe(event_id,category_id,name) VALUES($1,$2,$3) RETURNING id", [event.id, category.id, `T${position}`]);
    await client.query("INSERT INTO night_troupe_schedule(event_id,night_id,event_troupe_id,presentation_order) VALUES($1,$2,$3,$4)", [event.id, night.id, troupe.id, position]);
  }
  const before = (await client.query("SELECT * FROM night_troupe_schedule ORDER BY id")).rows;
  await apply("076_schedule_timestamps");
  const after = (await client.query("SELECT * FROM night_troupe_schedule ORDER BY id")).rows;
  assert.deepEqual(after, before.map((row) => ({ ...row, scheduled_at: null, scheduled_timezone: null, order_source: null })));
  await client.query("UPDATE night_troupe_schedule SET scheduled_at='2027-02-07T04:00:00Z', scheduled_timezone='America/Argentina/Cordoba' WHERE id=$1", [after[0].id]);
  await client.query("SELECT set_config('app.allow_event_open','true',true)");
  await client.query("UPDATE carnival_event SET status='OPEN' WHERE id=$1", [event.id]);
  await client.query("SET CONSTRAINTS schedule_night_order_unique DEFERRED");
  await client.query("UPDATE night_troupe_schedule SET presentation_order=3-presentation_order");
  await client.query("SET CONSTRAINTS schedule_night_order_unique IMMEDIATE");
  assert.equal((await client.query("SELECT scheduled_at FROM night_troupe_schedule WHERE id=$1", [after[0].id])).rows[0].scheduled_at.toISOString(), "2027-02-07T04:00:00.000Z");
  await client.query("SAVEPOINT forbidden");
  await assert.rejects(() => client.query("UPDATE night_troupe_schedule SET scheduled_at=scheduled_at+interval '1 minute' WHERE id=$1", [after[0].id]), /EVENT_LOCKED/);
  await client.query("ROLLBACK TO SAVEPOINT forbidden");
});
