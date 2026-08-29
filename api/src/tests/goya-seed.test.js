import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import { seedGoya2027 } from "../db/seeds/goya-2027.js";
import { closePool, getPool } from "../db/pool.js";
import { migrate } from "../db/migrate.js";

test("seed Goya 2027 carga sugerencias una sola vez, preserva ediciones y rechaza producción", { skip: !process.env.TEST_DATABASE_URL }, async (context) => {
  const original = { url: process.env.DATABASE_URL, node: process.env.NODE_ENV };
  context.after(async () => {
    await closePool();
    if (original.url === undefined) delete process.env.DATABASE_URL;
    else process.env.DATABASE_URL = original.url;
    if (original.node === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = original.node;
  });
  process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;
  process.env.NODE_ENV = "test";
  await migrate();

  const eventName = `Goya seed test ${randomUUID()}`;
  const seedKey = `goya-seed-test:${randomUUID()}`;
  const first = await seedGoya2027({ eventName, seedKey });
  await getPool().query(
    "UPDATE event_category SET code = 'PERSONALIZADA' WHERE event_id = $1 AND code = 'PRIMERA'",
    [first.eventId],
  );
  await getPool().query(
    "UPDATE event_specialty SET code = 'BAILE_PERSONALIZADO' WHERE event_id = $1 AND code = 'BAILE'",
    [first.eventId],
  );
  await getPool().query(
    "UPDATE night SET display_order = 10 WHERE event_id = $1 AND display_order = 1",
    [first.eventId],
  );
  await getPool().query(
    "UPDATE carnival_event SET name = $2 WHERE id = $1",
    [first.eventId, `${eventName} personalizado`],
  );

  const second = await seedGoya2027({ eventName, seedKey });
  assert.equal(first.eventId, second.eventId);
  const eventCount = await getPool().query(
    "SELECT count(*) FROM carnival_event WHERE id = $1 OR name = $2",
    [first.eventId, eventName],
  );
  assert.equal(eventCount.rows[0].count, "1");
  const { rows } = await getPool().query(
    `SELECT (SELECT count(*) FROM night WHERE event_id=$1) AS nights,
            (SELECT count(*) FROM event_category WHERE event_id=$1) AS categories,
            (SELECT count(*) FROM event_specialty WHERE event_id=$1) AS specialties,
            (SELECT count(*) FROM event_troupe WHERE event_id=$1) AS troupes,
            (SELECT count(*) FROM rubric WHERE event_id=$1) AS rubrics`,
    [first.eventId],
  );
  assert.deepEqual(rows, [{ nights: "4", categories: "1", specialties: "3", troupes: "0", rubrics: "0" }]);

  const adoptedEventName = `Goya seed adoptado ${randomUUID()}`;
  const adoptedSeedKey = `goya-seed-adopted:${randomUUID()}`;
  const { rows: adoptedEvents } = await getPool().query(
    "INSERT INTO carnival_event(name) VALUES($1) RETURNING id",
    [adoptedEventName],
  );
  const adopted = await seedGoya2027({ eventName: adoptedEventName, seedKey: adoptedSeedKey });
  assert.equal(adopted.eventId, adoptedEvents[0].id);
  const adoptedConfiguration = await getPool().query(
    `SELECT (SELECT count(*) FROM night WHERE event_id=$1) AS nights,
            (SELECT count(*) FROM event_category WHERE event_id=$1) AS categories,
            (SELECT count(*) FROM event_specialty WHERE event_id=$1) AS specialties`,
    [adopted.eventId],
  );
  assert.deepEqual(adoptedConfiguration.rows, [{ nights: "4", categories: "1", specialties: "3" }]);

  process.env.NODE_ENV = "production";
  await assert.rejects(() => seedGoya2027(), /GOYA_SEED_FORBIDDEN_IN_PRODUCTION/);
});
