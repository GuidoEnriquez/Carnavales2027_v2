import assert from "node:assert/strict";
import test from "node:test";
import { createEvent, createNight, updateNight } from "../../modules/events/event-service.js";
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

test("modela eventos configurables y jornadas ordenadas cronologicamente por fecha", {
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
      name: "Noche 2",
      kind: "COMPETITION",
      eventDate: "2027-02-07",
    });
    const awardsNight = await createNight({
      client,
      eventId: event.id,
      name: "Noche de premios",
      kind: "AWARDS",
      eventDate: "2027-02-12",
    });

    assert.equal(competitionNight.kind, "COMPETITION");
    assert.equal(competitionNight.status, "DRAFT");
    assert.equal(awardsNight.kind, "AWARDS");
    assert.equal(awardsNight.eventDate.toISOString().slice(0, 10), "2027-02-12");
    assert.equal(competitionNight.displayOrder, 1);
    assert.equal(awardsNight.displayOrder, 2);

    const orders = async () => (await client.query(
      "SELECT display_order FROM night WHERE event_id=$1 ORDER BY display_order",
      [event.id],
    )).rows.map(({ display_order }) => display_order);
    assert.deepEqual(await orders(), [1, 2]);

    const earlierNight = await createNight({
      client,
      eventId: event.id,
      name: "Noche 0",
      kind: "COMPETITION",
      eventDate: "2027-02-04",
    });
    assert.equal(earlierNight.displayOrder, 1, "crear una noche mas temprana la coloca primera");
    assert.deepEqual(await orders(), [1, 2, 3]);

    await client.query("SAVEPOINT duplicate_night_date");
    await assert.rejects(
      () => createNight({
        client,
        eventId: event.id,
        name: "Fecha repetida",
        kind: "COMPETITION",
        eventDate: "2027-02-07",
      }),
      /NIGHT_DATE_DUPLICATE/,
    );
    await client.query("ROLLBACK TO SAVEPOINT duplicate_night_date");

    await client.query("SAVEPOINT missing_night_date");
    await assert.rejects(
      () => createNight({
        client,
        eventId: event.id,
        name: "Sin fecha",
        kind: "COMPETITION",
        eventDate: null,
      }),
      /NIGHT_DATE_REQUIRED/,
    );
    await client.query("ROLLBACK TO SAVEPOINT missing_night_date");

    await client.query("SAVEPOINT invalid_night_date");
    await assert.rejects(
      () => createNight({
        client,
        eventId: event.id,
        name: "Fecha invalida",
        kind: "COMPETITION",
        eventDate: "2027-02-30",
      }),
      /NIGHT_DATE_INVALID/,
    );
    await client.query("ROLLBACK TO SAVEPOINT invalid_night_date");

    await client.query("SAVEPOINT invalid_night_kind");
    await assert.rejects(
      () => createNight({
        client,
        eventId: event.id,
        name: "Tipo inválido",
        kind: "OTHER",
        eventDate: "2027-02-14",
      }),
      /check/i,
    );
    await client.query("ROLLBACK TO SAVEPOINT invalid_night_kind");

    await client.query("SAVEPOINT reorder_on_edit");
    const reordered = await updateNight({
      client,
      nightId: competitionNight.id,
      name: "Noche 1",
      kind: "COMPETITION",
      eventDate: "2027-02-05",
    });
    assert.equal(reordered.displayOrder, 2, "editar la fecha reordena el conjunto");
    assert.deepEqual(await orders(), [1, 2, 3]);
    await client.query("ROLLBACK TO SAVEPOINT reorder_on_edit");

    const destinationEvent = await createEvent({ client, name: "Destino configurable" });
    await client.query("SAVEPOINT event_reassignment");
    await assert.rejects(
      () => client.query("UPDATE night SET event_id=$2 WHERE id=$1", [competitionNight.id, destinationEvent.id]),
      /EVENT_REASSIGNMENT_FORBIDDEN/,
    );
    await client.query("ROLLBACK TO SAVEPOINT event_reassignment");
  } finally {
    await client.query("ROLLBACK");
    client.release();
  }
});
