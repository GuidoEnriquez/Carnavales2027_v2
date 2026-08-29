import assert from "node:assert/strict";
import test from "node:test";
import { closePool, getPool } from "../pool.js";
import { migrate } from "../migrate.js";
import { createEvent } from "../../modules/events/event-service.js";

const originalDatabaseUrl = process.env.DATABASE_URL;

test("las categorías son únicas por evento y solo admiten soft-disable", {
  skip: !process.env.TEST_DATABASE_URL,
}, async (context) => {
  context.after(async () => {
    await closePool();
    if (originalDatabaseUrl === undefined) delete process.env.DATABASE_URL;
    else process.env.DATABASE_URL = originalDatabaseUrl;
  });
  process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;
  await migrate();
  const client = await getPool().connect();
  try {
    await client.query("BEGIN");
    const firstEvent = await createEvent({ client, name: "Evento categorías A" });
    const secondEvent = await createEvent({ client, name: "Evento categorías B" });
    const { rows: categoryRows } = await client.query(
      `INSERT INTO event_category (event_id, name, code, display_order)
       VALUES ($1, 'Primera categoría', 'PRIMERA', 1)
       RETURNING id, active`,
      [firstEvent.id],
    );
    assert.equal(categoryRows[0].active, true);
    await client.query("SAVEPOINT duplicate_category_code");
    await assert.rejects(
      () => client.query(
        `INSERT INTO event_category (event_id, name, code, display_order)
         VALUES ($1, 'Duplicada', 'PRIMERA', 2)`, [firstEvent.id],
      ), /unique|duplicate/i,
    );
    await client.query("ROLLBACK TO SAVEPOINT duplicate_category_code");
    await client.query(
      `INSERT INTO event_category (event_id, name, code, display_order)
       VALUES ($1, 'Mismo código otro evento', 'PRIMERA', 1)`, [secondEvent.id],
    );
    await client.query("UPDATE event_category SET active = false WHERE id = $1", [categoryRows[0].id]);
    await client.query("SAVEPOINT physical_category_delete");
    await assert.rejects(
      () => client.query("DELETE FROM event_category WHERE id = $1", [categoryRows[0].id]),
      /CATEGORY_DELETE_FORBIDDEN/,
    );
    await client.query("ROLLBACK TO SAVEPOINT physical_category_delete");
  } finally {
    await client.query("ROLLBACK");
    client.release();
  }
});
