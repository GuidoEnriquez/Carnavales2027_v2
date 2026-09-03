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

async function setupScrutinyRecordTestData() {
  const suffix = Math.random().toString(36).slice(2, 8);
  const userId = randomUUID();

  // Crear usuario certificante (Escribano / Escrutinio)
  await client.query(
    `INSERT INTO "user"(id, name, email, "emailVerified")
     VALUES ($1, $2, $3, true)`,
    [userId, "Escribano Público Test", `escribano-${suffix}@carnaval.test`],
  );

  const { rows: [event] } = await client.query(
    "INSERT INTO carnival_event(name) VALUES($1) RETURNING id",
    [`Test Event Scrutiny ${suffix}`],
  );

  const validHash = "a".repeat(64);
  const validPayload = {
    eventName: `Test Event Scrutiny ${suffix}`,
    overallRanking: [{ rank: 1, troupeName: "Comparsa Ganadora", netScore: 100 }],
  };

  return {
    userId,
    eventId: event.id,
    validHash,
    validPayload,
  };
}

describe("official_scrutiny_record DB", () => {
  it("rechaza insertar acta si los resultados NO están liberados (RESULTS_NOT_RELEASED)", async () => {
    const data = await setupScrutinyRecordTestData();

    await assert.rejects(
      async () => {
        await client.query(
          `INSERT INTO official_scrutiny_record(event_id, record_number, certified_by, certified_role, record_hash, payload)
           VALUES ($1, 'ACTA-001', $2, 'ESCRIBANO', $3, $4)`,
          [data.eventId, data.userId, data.validHash, JSON.stringify(data.validPayload)],
        );
      },
      (err) => {
        assert.ok(err.message.includes("RESULTS_NOT_RELEASED"));
        return true;
      },
    );
  });

  it("permite insertar un acta válida cuando los resultados están liberados", async () => {
    const data = await setupScrutinyRecordTestData();

    // Liberar resultados previamente
    await client.query(
      "INSERT INTO results_release(event_id, released_by) VALUES($1, $2)",
      [data.eventId, data.userId],
    );

    const { rows } = await client.query(
      `INSERT INTO official_scrutiny_record(event_id, record_number, certified_by, certified_role, record_hash, payload)
       VALUES ($1, 'ACTA-2027-GOYA-001', $2, 'ESCRIBANO', $3, $4)
       RETURNING id, event_id, record_number, certified_role, record_hash, created_at`,
      [data.eventId, data.userId, data.validHash, JSON.stringify(data.validPayload)],
    );

    assert.equal(rows.length, 1);
    assert.equal(rows[0].record_number, "ACTA-2027-GOYA-001");
    assert.equal(rows[0].certified_role, "ESCRIBANO");
    assert.equal(rows[0].record_hash, data.validHash);
    assert.ok(rows[0].created_at);
  });

  it("permite certificar con rol SCRUTINEER", async () => {
    const data = await setupScrutinyRecordTestData();

    await client.query(
      "INSERT INTO results_release(event_id, released_by) VALUES($1, $2)",
      [data.eventId, data.userId],
    );

    const { rows } = await client.query(
      `INSERT INTO official_scrutiny_record(event_id, record_number, certified_by, certified_role, record_hash, payload)
       VALUES ($1, 'ACTA-2027-SCRUTINEER-001', $2, 'SCRUTINEER', $3, $4)
       RETURNING certified_role`,
      [data.eventId, data.userId, data.validHash, JSON.stringify(data.validPayload)],
    );

    assert.equal(rows[0].certified_role, "SCRUTINEER");
  });

  it("rechaza roles certificantes no autorizados (ej. ADMIN o JUDGE)", async () => {
    const data = await setupScrutinyRecordTestData();

    await client.query(
      "INSERT INTO results_release(event_id, released_by) VALUES($1, $2)",
      [data.eventId, data.userId],
    );

    await assert.rejects(
      async () => {
        await client.query(
          `INSERT INTO official_scrutiny_record(event_id, record_number, certified_by, certified_role, record_hash, payload)
           VALUES ($1, 'ACTA-001', $2, 'ADMIN', $3, $4)`,
          [data.eventId, data.userId, data.validHash, JSON.stringify(data.validPayload)],
        );
      },
      /check constraint/i,
    );
  });

  it("rechaza hashes con longitud distinta a 64 caracteres", async () => {
    const data = await setupScrutinyRecordTestData();

    await client.query(
      "INSERT INTO results_release(event_id, released_by) VALUES($1, $2)",
      [data.eventId, data.userId],
    );

    await assert.rejects(
      async () => {
        await client.query(
          `INSERT INTO official_scrutiny_record(event_id, record_number, certified_by, certified_role, record_hash, payload)
           VALUES ($1, 'ACTA-001', $2, 'ESCRIBANO', 'hash_invalido_corto', $3)`,
          [data.eventId, data.userId, JSON.stringify(data.validPayload)],
        );
      },
      /check constraint|value too long/i,
    );
  });

  it("impide duplicar acta para el mismo evento (unicidad)", async () => {
    const data = await setupScrutinyRecordTestData();

    await client.query(
      "INSERT INTO results_release(event_id, released_by) VALUES($1, $2)",
      [data.eventId, data.userId],
    );

    await client.query(
      `INSERT INTO official_scrutiny_record(event_id, record_number, certified_by, certified_role, record_hash, payload)
       VALUES ($1, 'ACTA-001', $2, 'ESCRIBANO', $3, $4)`,
      [data.eventId, data.userId, data.validHash, JSON.stringify(data.validPayload)],
    );

    await assert.rejects(
      async () => {
        await client.query(
          `INSERT INTO official_scrutiny_record(event_id, record_number, certified_by, certified_role, record_hash, payload)
           VALUES ($1, 'ACTA-002', $2, 'ESCRIBANO', $3, $4)`,
          [data.eventId, data.userId, data.validHash, JSON.stringify(data.validPayload)],
        );
      },
      (err) => {
        assert.ok(err.message.includes("uq_official_scrutiny_event") || err.code === "23505");
        return true;
      },
    );
  });

  it("impide modificar un acta emitida (inmutabilidad estricta)", async () => {
    const data = await setupScrutinyRecordTestData();

    await client.query(
      "INSERT INTO results_release(event_id, released_by) VALUES($1, $2)",
      [data.eventId, data.userId],
    );

    const { rows: [record] } = await client.query(
      `INSERT INTO official_scrutiny_record(event_id, record_number, certified_by, certified_role, record_hash, payload)
       VALUES ($1, 'ACTA-001', $2, 'ESCRIBANO', $3, $4)
       RETURNING id`,
      [data.eventId, data.userId, data.validHash, JSON.stringify(data.validPayload)],
    );

    await assert.rejects(
      async () => {
        await client.query(
          "UPDATE official_scrutiny_record SET record_number = 'ACTA-MODIFICADA' WHERE id = $1",
          [record.id],
        );
      },
      (err) => {
        assert.ok(err.message.includes("OFFICIAL_RECORD_IMMUTABLE"));
        return true;
      },
    );
  });

  it("impide borrar físicamente un acta emitida (inmutabilidad estricta)", async () => {
    const data = await setupScrutinyRecordTestData();

    await client.query(
      "INSERT INTO results_release(event_id, released_by) VALUES($1, $2)",
      [data.eventId, data.userId],
    );

    const { rows: [record] } = await client.query(
      `INSERT INTO official_scrutiny_record(event_id, record_number, certified_by, certified_role, record_hash, payload)
       VALUES ($1, 'ACTA-001', $2, 'ESCRIBANO', $3, $4)
       RETURNING id`,
      [data.eventId, data.userId, data.validHash, JSON.stringify(data.validPayload)],
    );

    await assert.rejects(
      async () => {
        await client.query(
          "DELETE FROM official_scrutiny_record WHERE id = $1",
          [record.id],
        );
      },
      (err) => {
        assert.ok(err.message.includes("OFFICIAL_RECORD_IMMUTABLE"));
        return true;
      },
    );
  });

  it("computeRecordHash genera 64 caracteres hexadecimales consistentes con canonicalizeJson", async () => {
    const { computeRecordHash } = await import("../../modules/scrutiny-records/scrutiny-record-service.js");
    const payloadA = { b: 2, a: 1 };
    const payloadB = { a: 1, b: 2 };
    const hashA = computeRecordHash(payloadA);
    const hashB = computeRecordHash(payloadB);
    assert.equal(hashA.length, 64);
    assert.equal(hashA, hashB);
  });

  it("verifyRecordIntegrity valida hash original y detecta alteración de payload", async () => {
    const { computeRecordHash, verifyRecordIntegrity, getOfficialScrutinyRecord } = await import("../../modules/scrutiny-records/scrutiny-record-service.js");
    const data = await setupScrutinyRecordTestData();

    await client.query(
      "INSERT INTO results_release(event_id, released_by) VALUES($1, $2)",
      [data.eventId, data.userId],
    );

    const hash = computeRecordHash(data.validPayload);
    await client.query(
      `INSERT INTO official_scrutiny_record(event_id, record_number, certified_by, certified_role, record_hash, payload)
       VALUES ($1, 'ACTA-001', $2, 'ESCRIBANO', $3, $4)`,
      [data.eventId, data.userId, hash, JSON.stringify(data.validPayload)],
    );

    const record = await getOfficialScrutinyRecord({ eventId: data.eventId, client });
    assert.ok(record);
    assert.equal(record.integrityVerified, true);

    // Si el payload fuera manipulado
    const tampered = { ...record, payload: { ...record.payload, extra: "malicious" } };
    assert.equal(verifyRecordIntegrity(tampered), false);
  });
});
