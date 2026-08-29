import assert from "node:assert/strict";
import test from "node:test";
import { createEvent, createNight } from "../../modules/events/event-service.js";
import { closePool, getPool } from "../pool.js";
import { migrate } from "../migrate.js";

const originalDatabaseUrl = process.env.DATABASE_URL;

function restoreDatabaseUrl() {
  if (originalDatabaseUrl === undefined) {
    delete process.env.DATABASE_URL;
    return;
  }

  process.env.DATABASE_URL = originalDatabaseUrl;
}

test("modela eventos configurables y jornadas competitivas o de premios", {
  skip: !process.env.TEST_DATABASE_URL,
}, async (context) => {
  context.after(async () => {
    await closePool();
    restoreDatabaseUrl();
  });

  process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;
  await migrate();

  const client = await getPool().connect();
  try {
    await client.query("BEGIN");
    const event = await createEvent({ client, name: "Carnavales de prueba" });
    assert.equal(event.status, "CONFIGURING");

    const competitionNight = await createNight({
      client,
      eventId: event.id,
      name: "Noche 1",
      displayOrder: 1,
      kind: "COMPETITION",
    });
    const awardsNight = await createNight({
      client,
      eventId: event.id,
      name: "Noche de premios",
      displayOrder: 2,
      kind: "AWARDS",
    });

    assert.equal(competitionNight.kind, "COMPETITION");
    assert.equal(competitionNight.status, "DRAFT");
    assert.equal(awardsNight.kind, "AWARDS");

    await client.query("SAVEPOINT duplicate_night_order");
    await assert.rejects(
      () => createNight({
        client,
        eventId: event.id,
        name: "Orden repetido",
        displayOrder: 1,
        kind: "COMPETITION",
      }),
      /unique|duplicate/i,
    );
    await client.query("ROLLBACK TO SAVEPOINT duplicate_night_order");
    await client.query("SAVEPOINT invalid_night_kind");
    await assert.rejects(
      () => createNight({
        client,
        eventId: event.id,
        name: "Tipo inválido",
        displayOrder: 3,
        kind: "OTHER",
      }),
      /check/i,
    );
  } finally {
    await client.query("ROLLBACK");
    client.release();
  }
});
