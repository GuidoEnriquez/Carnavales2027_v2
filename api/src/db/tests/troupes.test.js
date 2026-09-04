import assert from "node:assert/strict";
import test from "node:test";
import { closePool, getPool } from "../pool.js";
import { migrate } from "../migrate.js";
import { createEvent } from "../../modules/events/event-service.js";

const originalDatabaseUrl = process.env.DATABASE_URL;

test("una participación exige categoría activa del mismo evento y nunca texto libre", {
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
    const firstEvent = await createEvent({ client, name: "Evento comparsas A" });
    const secondEvent = await createEvent({ client, name: "Evento comparsas B" });
    const { rows: categories } = await client.query(
      `INSERT INTO event_category (event_id, name, code, display_order)
       VALUES ($1, 'Categoría A', 'A', 1), ($2, 'Categoría B', 'B', 1)
       RETURNING id, event_id`,
      [firstEvent.id, secondEvent.id],
    );
    const firstCategory = categories.find((category) => category.event_id === firstEvent.id);
    const secondCategory = categories.find((category) => category.event_id === secondEvent.id);
    await client.query(
      `INSERT INTO event_troupe (event_id, category_id, name)
       VALUES ($1, $2, 'Comparsa válida')`,
      [firstEvent.id, firstCategory.id],
    );
    await client.query("SAVEPOINT other_event_category");
    await assert.rejects(
      () => client.query(
        `INSERT INTO event_troupe (event_id, category_id, name)
         VALUES ($1, $2, 'Categoría ajena')`,
        [firstEvent.id, secondCategory.id],
      ), { code: "23503" },
    );
    await client.query("ROLLBACK TO SAVEPOINT other_event_category");
    await client.query("UPDATE event_category SET active = false WHERE id = $1", [firstCategory.id]);
    await client.query("SAVEPOINT inactive_category");
    await assert.rejects(
      () => client.query(
        `INSERT INTO event_troupe (event_id, category_id, name)
         VALUES ($1, $2, 'Categoría inactiva')`,
        [firstEvent.id, firstCategory.id],
      ), /CATEGORY_INACTIVE/,
    );
    await client.query("ROLLBACK TO SAVEPOINT inactive_category");
    await client.query("SAVEPOINT missing_category");
    await assert.rejects(
      () => client.query(
        `INSERT INTO event_troupe (event_id, name)
         VALUES ($1, 'Sin categoría')`, [firstEvent.id],
      ), { code: "23502" },
    );
    await client.query("ROLLBACK TO SAVEPOINT missing_category");
  } finally {
    await client.query("ROLLBACK");
    client.release();
  }
});
