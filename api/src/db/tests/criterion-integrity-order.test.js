import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import test from "node:test";
import { migrate } from "../migrate.js";
import { closePool, getPool } from "../pool.js";
import { getOrphanedCriteria, reorderCriterion, updateCriterion } from "../../modules/rubrics/rubric-service.js";
import { openEvent } from "../../modules/events/event-readiness.service.js";

test("067 upgrades historical criteria without losing NULLs, guards identity and keeps FK keys immediate", {
  skip: !process.env.TEST_DATABASE_URL,
}, async (t) => {
  process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;
  await migrate();
  const client = await getPool().connect();
  t.after(async () => { await client.query("ROLLBACK"); client.release(); await closePool(); });
  await client.query("BEGIN");
  const schema = `spec017_history_${randomUUID().replaceAll("-", "")}`;
  await client.query(`CREATE SCHEMA ${schema}`);
  await client.query(`SET LOCAL search_path TO ${schema}, pg_catalog`);
  await client.query('CREATE TABLE "user" (LIKE public."user" INCLUDING ALL)');
  const directory = new URL("../migrations/", import.meta.url);
  const files = (await readdir(directory)).sort();
  const apply = async (version) => {
    const filename = files.find((name) => name.startsWith(`${version}_`));
    await client.query(await readFile(new URL(filename, directory), "utf8"));
  };
  // Relevant pre-066 schema, using unchanged SQL, not the migration runner or its ledger.
  await apply("003");
  for (let version = 7; version <= 21; version++) await apply(String(version).padStart(3, "0"));
  await apply("053");

  const { rows: [event] } = await client.query("INSERT INTO carnival_event(name) VALUES('Historical criteria') RETURNING id");
  const { rows: [specialty] } = await client.query("INSERT INTO event_specialty(event_id,name,code,display_order) VALUES($1,'S','S',1) RETURNING id", [event.id]);
  const fixtures = [];
  for (const [code, states] of [["NONE", []], ["ONE", [true, false]], ["MANY", [true, true]], ["INACTIVE", [false]]]) {
    const { rows: [rubric] } = await client.query("INSERT INTO rubric(event_id,name,code,evaluation_target) VALUES($1,$2,$2,'TROUPE') RETURNING id", [event.id, code]);
    const items = [];
    for (const [index, active] of states.entries()) {
      const { rows: [item] } = await client.query("INSERT INTO evaluation_item(event_id,rubric_id,specialty_id,name,code,active) VALUES($1,$2,$3,$4,$4,$5) RETURNING *", [event.id, rubric.id, specialty.id, `I${index}`, active]);
      items.push(item);
    }
    const { rows: [criterion] } = await client.query("INSERT INTO rubric_criterion(event_id,rubric_id,description,display_order,active) VALUES($1,$2,$3,7,false) RETURNING *", [event.id, rubric.id, code]);
    fixtures.push({ code, rubric, items, criterion });
  }
  // Also exercise backfill through the existing OPEN guard without disabling it in tests.
  const { rows: [opened] } = await client.query("INSERT INTO carnival_event(name) VALUES('Historical OPEN') RETURNING id");
  await client.query("INSERT INTO night(event_id,name,display_order,kind) VALUES($1,'N',1,'COMPETITION')", [opened.id]);
  const { rows: [category] } = await client.query("INSERT INTO event_category(event_id,name,code,display_order) VALUES($1,'C','C',1) RETURNING id", [opened.id]);
  await client.query("INSERT INTO event_troupe(event_id,category_id,name) VALUES($1,$2,'T')", [opened.id, category.id]);
  const { rows: [openSpecialty] } = await client.query("INSERT INTO event_specialty(event_id,name,code,display_order) VALUES($1,'S','S',1) RETURNING id", [opened.id]);
  const { rows: [openRubric] } = await client.query("INSERT INTO rubric(event_id,name,code,evaluation_target) VALUES($1,'R','R','TROUPE') RETURNING id", [opened.id]);
  const { rows: [openItem] } = await client.query("INSERT INTO evaluation_item(event_id,rubric_id,specialty_id,name,code) VALUES($1,$2,$3,'I','I') RETURNING id", [opened.id, openRubric.id, openSpecialty.id]);
  const { rows: [openCriterion] } = await client.query("INSERT INTO rubric_criterion(event_id,rubric_id,description,display_order) VALUES($1,$2,'Open criterion',3) RETURNING id", [opened.id, openRubric.id]);
  await openEvent({ client, eventId: opened.id });

  await apply("066");
  const before067 = (await client.query("SELECT * FROM rubric_criterion ORDER BY id")).rows;
  await apply("067");
  assert.deepEqual((await client.query("SELECT * FROM rubric_criterion ORDER BY id")).rows, before067);
  for (const fixture of fixtures) {
    const current = before067.find((row) => row.id === fixture.criterion.id);
    assert.deepEqual(current, { ...fixture.criterion, scoring_item_id: fixture.code === "ONE" ? fixture.items[0].id : null });
  }
  assert.equal(before067.find((row) => row.id === openCriterion.id).scoring_item_id, openItem.id);
  const orphans = await getOrphanedCriteria({ client, eventId: event.id });
  assert.deepEqual(orphans.map((row) => row.rubricId).sort(), fixtures.filter((f) => f.code !== "ONE").map((f) => f.rubric.id).sort());

  const reject = async (operation, expected) => {
    await client.query("SAVEPOINT rejected_write");
    await assert.rejects(operation(), expected);
    await client.query("ROLLBACK TO SAVEPOINT rejected_write");
  };
  const orphan = fixtures.find((f) => f.code === "MANY");
  const assigned = fixtures.find((f) => f.code === "ONE");
  await reject(() => client.query("INSERT INTO rubric_criterion(event_id,rubric_id,description,display_order) VALUES($1,$2,'New NULL',99)", [event.id, orphan.rubric.id]), /CRITERION_REASSIGNMENT_REQUIRED/);
  await reject(() => client.query("UPDATE rubric_criterion SET scoring_item_id=NULL WHERE id=$1", [assigned.criterion.id]), /CRITERION_REASSIGNMENT_REQUIRED/);
  await reject(() => client.query("UPDATE rubric_criterion SET id=$2 WHERE id=$1", [orphan.criterion.id, randomUUID()]), /CRITERION_REASSIGNMENT_REQUIRED/);
  await reject(() => client.query("UPDATE rubric_criterion SET rubric_id=$2 WHERE id=$1", [orphan.criterion.id, assigned.rubric.id]), /CRITERION_REASSIGNMENT_REQUIRED/);
  await reject(() => client.query("UPDATE rubric_criterion SET event_id=$2,rubric_id=$3 WHERE id=$1", [orphan.criterion.id, opened.id, openRubric.id]), /EVENT_REASSIGNMENT_FORBIDDEN/);
  await reject(() => client.query("UPDATE rubric_criterion SET scoring_item_id=$2 WHERE id=$1", [orphan.criterion.id, assigned.items[0].id]), { code: "23503" });
  await reject(() => reorderCriterion({ client, criterionId: orphan.criterion.id, direction: "UP", neighborId: assigned.criterion.id, expectedOrder: 7, expectedNeighborOrder: 7 }), /CRITERION_REASSIGNMENT_REQUIRED/);
  await updateCriterion({ client, criterionId: orphan.criterion.id, description: "Preserved orphan", active: true });
  assert.equal((await client.query("SELECT scoring_item_id FROM rubric_criterion WHERE id=$1", [orphan.criterion.id])).rows[0].scoring_item_id, null);
  const reassigned = await updateCriterion({ client, criterionId: orphan.criterion.id, scoringItemId: orphan.items[0].id });
  assert.equal(reassigned.displayOrder, 7);
  await reject(() => client.query("UPDATE rubric_criterion SET scoring_item_id=NULL WHERE id=$1", [orphan.criterion.id]), /CRITERION_REASSIGNMENT_REQUIRED/);
  await reject(() => client.query("INSERT INTO rubric_criterion(event_id,rubric_id,description,display_order) VALUES($1,$2,'Locked NULL',99)", [opened.id, openRubric.id]), /EVENT_LOCKED/);

  const constraints = (await client.query(`SELECT conname, condeferrable, condeferred FROM pg_constraint
    WHERE connamespace=$1::regnamespace AND conname IN (
      'evaluation_item_rubric_display_order_unique', 'rubric_criterion_rubric_order_unique',
      'evaluation_item_id_rubric_event_unique') ORDER BY conname`, [schema])).rows;
  assert.deepEqual(constraints, [
    { conname: "evaluation_item_id_rubric_event_unique", condeferrable: false, condeferred: false },
    { conname: "evaluation_item_rubric_display_order_unique", condeferrable: true, condeferred: false },
    { conname: "rubric_criterion_rubric_order_unique", condeferrable: true, condeferred: false },
  ]);
  await reject(() => client.query("UPDATE evaluation_item SET display_order=1 WHERE id=$1", [orphan.items[1].id]), { code: "23505" });
  await client.query("INSERT INTO rubric_criterion(event_id,rubric_id,scoring_item_id,description,display_order) VALUES($1,$2,$3,'Another item',12)", [event.id, orphan.rubric.id, orphan.items[1].id]);
  await reject(() => client.query("UPDATE rubric_criterion SET display_order=7 WHERE rubric_id=$1 AND display_order=12", [orphan.rubric.id]), { code: "23505" });
});
