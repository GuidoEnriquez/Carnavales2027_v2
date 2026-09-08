import { describe, it, before, after, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { getPool, closePool } from "../pool.js";
import { migrate } from "../migrate.js";

let client;

before(async () => {
  await migrate();
  client = await getPool().connect();
});

after(async () => {
  client?.release();
  await closePool();
});

beforeEach(async () => {
  await client.query("BEGIN");
});

afterEach(async () => {
  await client.query("ROLLBACK");
});

describe("results_snapshot DB (Spec 024)", () => {
  it("permite insertar un snapshot válido y recuperarlo ordenado por versión", async () => {
    const { rows: [event] } = await client.query(
      "INSERT INTO carnival_event(name) VALUES($1) RETURNING id",
      ["Evento Snapshot Test"],
    );

    const payloadV1 = { eventId: event.id, overallRanking: [{ rank: 1, troupeName: "Porambá" }] };
    const hashV1 = "a".repeat(64);

    const { rows: inserted } = await client.query(
      `INSERT INTO results_snapshot(event_id, version, snapshot_hash, payload)
       VALUES ($1, $2, $3, $4)
       RETURNING id, event_id, version, snapshot_hash, payload, created_at`,
      [event.id, 1, hashV1, JSON.stringify(payloadV1)],
    );

    assert.equal(inserted.length, 1);
    assert.equal(inserted[0].version, 1);
    assert.equal(inserted[0].snapshot_hash, hashV1);
    assert.deepEqual(inserted[0].payload, payloadV1);

    // Insertar versión 2
    const payloadV2 = { eventId: event.id, overallRanking: [{ rank: 1, troupeName: "Porambá" }], officialRecord: { recordNumber: "ACTA-001" } };
    const hashV2 = "b".repeat(64);

    await client.query(
      `INSERT INTO results_snapshot(event_id, version, snapshot_hash, payload)
       VALUES ($1, $2, $3, $4)`,
      [event.id, 2, hashV2, JSON.stringify(payloadV2)],
    );

    // Consulta de la versión más reciente (idx_results_snapshot_event_latest)
    const { rows: latest } = await client.query(
      `SELECT version, snapshot_hash, payload
       FROM results_snapshot
       WHERE event_id = $1
       ORDER BY version DESC
       LIMIT 1`,
      [event.id],
    );

    assert.equal(latest.length, 1);
    assert.equal(latest[0].version, 2);
    assert.equal(latest[0].snapshot_hash, hashV2);
    assert.equal(latest[0].payload.officialRecord.recordNumber, "ACTA-001");
  });

  it("rechaza duplicar la misma versión para un evento (unicidad uq_results_snapshot_event_version)", async () => {
    const { rows: [event] } = await client.query(
      "INSERT INTO carnival_event(name) VALUES($1) RETURNING id",
      ["Evento Unicidad Snapshot"],
    );

    await client.query(
      `INSERT INTO results_snapshot(event_id, version, snapshot_hash, payload)
       VALUES ($1, $2, $3, $4)`,
      [event.id, 1, "c".repeat(64), JSON.stringify({ ok: 1 })],
    );

    await assert.rejects(
      async () => {
        await client.query(
          `INSERT INTO results_snapshot(event_id, version, snapshot_hash, payload)
           VALUES ($1, $2, $3, $4)`,
          [event.id, 1, "d".repeat(64), JSON.stringify({ ok: 2 })],
        );
      },
      /unique|uq_results_snapshot_event_version/i,
    );
  });

  it("impide modificar un snapshot emitido (inmutabilidad estricta trg_results_snapshot_immutable)", async () => {
    const { rows: [event] } = await client.query(
      "INSERT INTO carnival_event(name) VALUES($1) RETURNING id",
      ["Evento Inmutable Snapshot"],
    );

    const { rows: [snap] } = await client.query(
      `INSERT INTO results_snapshot(event_id, version, snapshot_hash, payload)
       VALUES ($1, $2, $3, $4) RETURNING id`,
      [event.id, 1, "e".repeat(64), JSON.stringify({ ok: 1 })],
    );

    await assert.rejects(
      async () => {
        await client.query(
          "UPDATE results_snapshot SET snapshot_hash = $1 WHERE id = $2",
          ["f".repeat(64), snap.id],
        );
      },
      /RESULTS_SNAPSHOT_IMMUTABLE_NO_UPDATE/,
    );
  });

  it("impide borrar físicamente un snapshot emitido (inmutabilidad estricta trg_results_snapshot_immutable)", async () => {
    const { rows: [event] } = await client.query(
      "INSERT INTO carnival_event(name) VALUES($1) RETURNING id",
      ["Evento Borrado Snapshot"],
    );

    const { rows: [snap] } = await client.query(
      `INSERT INTO results_snapshot(event_id, version, snapshot_hash, payload)
       VALUES ($1, $2, $3, $4) RETURNING id`,
      [event.id, 1, "9".repeat(64), JSON.stringify({ ok: 1 })],
    );

    await assert.rejects(
      async () => {
        await client.query("DELETE FROM results_snapshot WHERE id = $1", [snap.id]);
      },
      /RESULTS_SNAPSHOT_IMMUTABLE_NO_DELETE/,
    );
  });
});
