import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import { auditEvent } from "../audit/audit-service.js";
import { closePool, getPool } from "../db/pool.js";
import { migrate } from "../db/migrate.js";
import { verifyAuditChain } from "../scripts/verify-audit-chain.js";

const originalDatabaseUrl = process.env.DATABASE_URL;

test("Cadena de integridad de auditoría general (RF-174)", {
  skip: !process.env.TEST_DATABASE_URL,
}, async (context) => {
  context.after(async () => {
    await closePool();
    if (originalDatabaseUrl === undefined) delete process.env.DATABASE_URL;
    else process.env.DATABASE_URL = originalDatabaseUrl;
  });

  process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;
  await migrate();

  const pool = getPool();
  const client = await pool.connect();

  try {
    // 1. Insertar 3 eventos auditados sucesivos
    const event1 = await auditEvent(client, {
      actorUserId: randomUUID(),
      action: "TEST_CHAIN_EVENT_1",
      entityType: "test_entity",
      entityId: randomUUID(),
      after: { note: "First event" },
    });

    const event2 = await auditEvent(client, {
      actorUserId: randomUUID(),
      action: "TEST_CHAIN_EVENT_2",
      entityType: "test_entity",
      entityId: randomUUID(),
      after: { note: "Second event" },
    });

    const event3 = await auditEvent(client, {
      actorUserId: randomUUID(),
      action: "TEST_CHAIN_EVENT_3",
      entityType: "test_entity",
      entityId: randomUUID(),
      after: { note: "Third event" },
    });

    // 2. Verificar que los hashes están encadenados
    assert.equal(event1.hashChainVersion, 2);
    assert.equal(event2.hashChainVersion, 2);
    assert.equal(event3.hashChainVersion, 2);

    assert.equal(event2.previousHash, event1.eventHash);
    assert.equal(event3.previousHash, event2.eventHash);

    // 3. Ejecutar verificación de la cadena
    const verification = await verifyAuditChain({ pool });
    assert.equal(verification.status, "OK");
    assert.ok(verification.eventsVerified >= 3);
    assert.equal(verification.lastHash, event3.eventHash);

    // 4. Probar que una ruptura o manipulación es detectada
    // Deshabilitamos temporalmente el trigger para simular una manipulación directa en BD (ataque interno)
    await client.query("ALTER TABLE audit_event DISABLE TRIGGER USER");
    await client.query(
      `UPDATE audit_event
          SET after_data = '{"note":"Tampered payload"}'::jsonb
        WHERE id = $1`,
      [event2.id],
    );
    await client.query("ALTER TABLE audit_event ENABLE TRIGGER USER");

    await assert.rejects(
      () => verifyAuditChain({ pool }),
      /MANIPULACIÓN DETECTADA/,
    );

    // Restaurar payload para dejar limpia la base
    await client.query("ALTER TABLE audit_event DISABLE TRIGGER USER");
    await client.query(
      `UPDATE audit_event
          SET after_data = $2::jsonb
        WHERE id = $1`,
      [event2.id, JSON.stringify(event2.after)],
    );
    await client.query("ALTER TABLE audit_event ENABLE TRIGGER USER");

    // Verificar que al restaurar vuelve a estar íntegra
    const restoredVerification = await verifyAuditChain({ pool });
    assert.equal(restoredVerification.status, "OK");
  } finally {
    client.release();
  }
});
