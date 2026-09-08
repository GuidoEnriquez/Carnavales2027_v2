import "dotenv/config";
import { getPool, closePool } from "../db/pool.js";
import { hashAuditEvent, hashCeremonialDraw } from "../audit/audit-service.js";

const GENESIS_HASH = "0".repeat(64);

export async function verifyAuditChain({ pool = getPool() } = {}) {
  const client = await pool.connect();
  try {
    // 1. Verificar cadena general (versión 2)
    const { rows: events } = await client.query(
      `SELECT id, actor_user_id, action, entity_type, entity_id,
              before_data, after_data, hash_chain_version, previous_hash, event_hash, created_at
         FROM audit_event
        WHERE hash_chain_version = 2`,
    );

    const { rows: headRows } = await client.query(
      "SELECT last_hash FROM general_audit_hash_chain_head WHERE singleton = TRUE",
    );
    const headHash = headRows[0]?.last_hash?.trim() || GENESIS_HASH;

    if (events.length === 0) {
      if (headHash !== GENESIS_HASH) {
        throw new Error(
          `DISCREPANCIA CON CABECERA: general_audit_hash_chain_head apunta a '${headHash}' pero no hay eventos registrados.`,
        );
      }
      return {
        status: "OK",
        eventsVerified: 0,
        lastHash: GENESIS_HASH,
      };
    }

    // Indexar por previous_hash para ordenar la cadena de forma determinista
    const eventsByPrev = new Map();
    for (const event of events) {
      const prev = event.previous_hash ? event.previous_hash.trim() : "";
      if (eventsByPrev.has(prev)) {
        const collision = eventsByPrev.get(prev);
        throw new Error(
          `BIFURCACIÓN DETECTADA: Dos eventos (${collision.id} y ${event.id}) reclaman el mismo previous_hash '${prev}'.`,
        );
      }
      eventsByPrev.set(prev, event);
    }

    let currentHash = GENESIS_HASH;
    let verifiedCount = 0;

    while (eventsByPrev.has(currentHash)) {
      const event = eventsByPrev.get(currentHash);
      const evHash = event.event_hash ? event.event_hash.trim() : "";

      const normalizedPayload = {
        id: event.id,
        actorUserId: event.actor_user_id,
        action: event.action,
        entityType: event.entity_type,
        entityId: event.entity_id,
        before: event.before_data,
        after: event.after_data,
        hashChainVersion: 2,
      };

      const calculatedHash = hashAuditEvent({
        previousHash: currentHash,
        payload: normalizedPayload,
      });

      if (calculatedHash !== evHash) {
        throw new Error(
          `MANIPULACIÓN DETECTADA en evento #${verifiedCount + 1} (${event.id}): event_hash '${evHash}' no coincide con el hash recalculado '${calculatedHash}'.`,
        );
      }

      currentHash = evHash;
      verifiedCount++;
    }

    if (verifiedCount !== events.length) {
      throw new Error(
        `RUPTURA DE ENLACE: Se verificaron ${verifiedCount} eventos de un total de ${events.length}. Existen ${events.length - verifiedCount} eventos huérfanos o desconectados en la cadena.`,
      );
    }

    // Verificar concordancia con la cabecera
    if (headHash !== currentHash) {
      throw new Error(
        `DISCREPANCIA CON CABECERA: general_audit_hash_chain_head apunta a '${headHash}' pero el último evento de la cadena tiene '${currentHash}'.`,
      );
    }

    return {
      status: "OK",
      eventsVerified: events.length,
      lastHash: currentHash,
    };
  } finally {
    client.release();
  }
}

// Ejecución directa por CLI
if (process.argv[1]?.endsWith("verify-audit-chain.js")) {
  try {
    const result = await verifyAuditChain();
    console.log(`✅ Cadena de auditoría íntegra: ${result.eventsVerified} eventos verificados correctamente.`);
    console.log(`Último hash: ${result.lastHash}`);
    await closePool();
    process.exit(0);
  } catch (error) {
    console.error(`❌ ERROR DE INTEGRIDAD EN AUDITORÍA:\n${error.message}`);
    await closePool();
    process.exit(1);
  }
}
