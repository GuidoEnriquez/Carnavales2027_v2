import { getPool } from "../pool.js";

const DEFAULT_EVENT_NAME = "Carnavales de Goya 2027";
const DEFAULT_SEED_KEY = "goya-2027";
const NIGHTS = [
  [1, "Noche 1", "COMPETITION"],
  [2, "Noche 2", "COMPETITION"],
  [3, "Noche 3", "COMPETITION"],
  [4, "Noche de premios", "AWARDS"],
];
const SPECIALTIES = [
  [1, "Baile", "BAILE"],
  [2, "Vestuario", "VESTUARIO"],
  [3, "Batería", "BATERIA"],
];

export async function seedGoya2027({ eventName = DEFAULT_EVENT_NAME, seedKey = DEFAULT_SEED_KEY } = {}) {
  if (process.env.NODE_ENV === "production") {
    throw new Error("GOYA_SEED_FORBIDDEN_IN_PRODUCTION");
  }

  const client = await getPool().connect();
  try {
    await client.query("BEGIN");
    await client.query("SELECT pg_advisory_xact_lock(hashtext($1))", [`carnavales2027_goya_seed:${seedKey}`]);

    let { rows } = await client.query(
      "SELECT event_id AS id FROM configuration_seed WHERE seed_key = $1",
      [seedKey],
    );
    let eventId = rows[0]?.id;
    if (eventId) {
      await client.query("COMMIT");
      return { eventId };
    }

    ({ rows } = await client.query(
      "SELECT id FROM carnival_event WHERE name = $1 ORDER BY created_at LIMIT 1",
      [eventName],
    ));
    eventId = rows[0]?.id;
    if (!eventId) {
      ({ rows } = await client.query(
        "INSERT INTO carnival_event(name) VALUES($1) RETURNING id",
        [eventName],
      ));
      eventId = rows[0].id;
    }
    await client.query("INSERT INTO configuration_seed(seed_key,event_id) VALUES($1,$2)", [seedKey, eventId]);

    for (const [displayOrder, name, kind] of NIGHTS) {
      await client.query(
        `INSERT INTO night(event_id, name, display_order, kind)
         VALUES($1, $2, $3, $4)
         ON CONFLICT(event_id, display_order) DO NOTHING`,
        [eventId, name, displayOrder, kind],
      );
    }

    await client.query(
      `INSERT INTO event_category(event_id, name, code, display_order)
       VALUES($1, 'Primera categoría', 'PRIMERA', 1)
       ON CONFLICT(event_id, code) DO NOTHING`,
      [eventId],
    );

    for (const [displayOrder, name, code] of SPECIALTIES) {
      await client.query(
        `INSERT INTO event_specialty(event_id, name, code, display_order)
         VALUES($1, $2, $3, $4)
         ON CONFLICT(event_id, code) DO NOTHING`,
        [eventId, name, code, displayOrder],
      );
    }

    await client.query("COMMIT");
    return { eventId };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}
