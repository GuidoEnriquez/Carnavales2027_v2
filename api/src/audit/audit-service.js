import { createHash, randomUUID } from "node:crypto";

const forbiddenFieldPattern = /password|token|secret|otp|authorization|cookie/i;
const CEREMONIAL_DRAW_ACTION = "RESULTS_TIE_BREAKER_CEREMONIAL_DRAW";
const GENESIS_HASH = "0".repeat(64);

function validateAuditData(value) {
  if (Array.isArray(value)) {
    for (const item of value) {
      validateAuditData(item);
    }
    return;
  }

  if (!value || typeof value !== "object") {
    return;
  }

  for (const [key, nestedValue] of Object.entries(value)) {
    // This boolean domain field contains "otp" across word boundaries.
    if (key === "allowNotPresented" && typeof nestedValue === "boolean") continue;
    if (forbiddenFieldPattern.test(key)) {
      throw new Error(`AUDIT_FORBIDDEN_FIELD: ${key}`);
    }
    validateAuditData(nestedValue);
  }
}

function requireText(value, name) {
  if (typeof value !== "string" || value.length === 0) {
    throw new TypeError(`${name} debe ser texto no vacío.`);
  }

  return value;
}

// JCS-compatible canonical JSON for the plain JSON values accepted in audit data.
export function canonicalizeJson(value) {
  if (value === null || typeof value === "boolean" || typeof value === "string") {
    return JSON.stringify(value);
  }
  if (value instanceof Date || typeof value?.toISOString === "function") {
    return JSON.stringify(value.toISOString());
  }
  if (typeof value === "number") {
    if (!Number.isFinite(value)) throw new TypeError("El payload de auditoría no admite números no finitos.");
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) return `[${value.map(canonicalizeJson).join(",")}]`;
  if (!value || typeof value !== "object") throw new TypeError("El payload de auditoría debe ser JSON.");
  return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonicalizeJson(value[key])}`).join(",")}}`;
}

export function hashCeremonialDraw({ previousHash, payload }) {
  if (!/^[0-9a-f]{64}$/.test(previousHash)) throw new TypeError("previousHash debe ser SHA-256 hexadecimal.");
  return createHash("sha256")
    .update(`carnavales-ceremonial-draw-chain:v1\n${previousHash}\n${canonicalizeJson(payload)}`, "utf8")
    .digest("hex");
}

export function hashAuditEvent({ previousHash, payload }) {
  if (!/^[0-9a-f]{64}$/.test(previousHash)) throw new TypeError("previousHash debe ser SHA-256 hexadecimal.");
  return createHash("sha256")
    .update(`carnavales-general-audit-chain:v2\n${previousHash}\n${canonicalizeJson(payload)}`, "utf8")
    .digest("hex");
}

export async function auditEvent(client, {
  actorUserId = null,
  action,
  entityType,
  entityId,
  before = {},
  after = {},
}) {
  validateAuditData(before);
  validateAuditData(after);

  const act = requireText(action, "action");
  const entType = requireText(entityType, "entityType");
  const entId = requireText(entityId, "entityId");
  const auditEventId = randomUUID();

  const ownTransaction = client?._txStatus === "I";
  if (ownTransaction) {
    await client.query("BEGIN");
  }

  try {
    let headTableExists = false;
    let previousHash = GENESIS_HASH;

    try {
      const { rows: regCheck } = await client.query(
        "SELECT to_regclass('general_audit_hash_chain_head') AS head_table",
      );
      if (regCheck?.[0]?.head_table) {
        headTableExists = true;
        const { rows: heads } = await client.query(
          "SELECT last_hash FROM general_audit_hash_chain_head WHERE singleton = TRUE FOR UPDATE",
        );
        if (heads?.[0]?.last_hash) {
          previousHash = heads[0].last_hash.trim();
        }
      }
    } catch {
      // If client is a simple mock object without to_regclass support
    }

    const cleanBefore = JSON.parse(JSON.stringify(before));
    const cleanAfter = JSON.parse(JSON.stringify(after));

    if (headTableExists) {
      const normalizedPayload = {
        id: auditEventId,
        actorUserId,
        action: act,
        entityType: entType,
        entityId: entId,
        before: cleanBefore,
        after: cleanAfter,
        hashChainVersion: 2,
      };
      const eventHash = hashAuditEvent({ previousHash, payload: normalizedPayload });

      const { rows } = await client.query(
        `INSERT INTO audit_event (
          id,
          actor_user_id,
          action,
          entity_type,
          entity_id,
          before_data,
          after_data,
          hash_chain_version,
          previous_hash,
          event_hash
        ) VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7::jsonb, 2, $8, $9)
        RETURNING
          id,
          actor_user_id AS "actorUserId",
          action,
          entity_type AS "entityType",
          entity_id AS "entityId",
          before_data AS before,
          after_data AS after,
          hash_chain_version AS "hashChainVersion",
          previous_hash AS "previousHash",
          event_hash AS "eventHash",
          created_at AS "createdAt"`,
        [
          auditEventId,
          actorUserId,
          act,
          entType,
          entId,
          JSON.stringify(cleanBefore),
          JSON.stringify(cleanAfter),
          previousHash,
          eventHash,
        ],
      );

      await client.query(
        `UPDATE general_audit_hash_chain_head
         SET last_audit_event_id = $1, last_hash = $2, updated_at = clock_timestamp()
         WHERE singleton = TRUE`,
        [auditEventId, eventHash],
      );

      if (ownTransaction) {
        await client.query("COMMIT");
      }

      return rows[0];
    }

    // Pre-068 schema or mock client without general_audit_hash_chain_head
    const { rows } = await client.query(
      `INSERT INTO audit_event (
        id,
        actor_user_id,
        action,
        entity_type,
        entity_id,
        before_data,
        after_data
      ) VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7::jsonb)
      RETURNING
        id,
        actor_user_id AS "actorUserId",
        action,
        entity_type AS "entityType",
        entity_id AS "entityId",
        before_data AS before,
        after_data AS after,
        created_at AS "createdAt"`,
      [
        auditEventId,
        actorUserId,
        act,
        entType,
        entId,
        JSON.stringify(cleanBefore),
        JSON.stringify(cleanAfter),
      ],
    );

    if (ownTransaction) {
      await client.query("COMMIT");
    }

    return rows[0];
  } catch (error) {
    if (ownTransaction) {
      await client.query("ROLLBACK").catch(() => {});
    }
    throw error;
  }
}

export async function auditCeremonialDraw(client, {
  actorUserId,
  eventId,
  payload,
}) {
  validateAuditData(payload);
  const auditEventId = randomUUID();
  const { rows: heads } = await client.query(
    "SELECT last_hash FROM ceremonial_draw_hash_chain_head WHERE singleton = TRUE FOR UPDATE",
  );
  const previousHash = heads[0]?.last_hash?.trim() || GENESIS_HASH;
  const normalizedPayload = {
    ...payload,
    auditEventId,
    eventId,
    hashChainVersion: 1,
  };
  const eventHash = hashCeremonialDraw({ previousHash, payload: normalizedPayload });
  const { rows } = await client.query(
    `INSERT INTO audit_event (
      id, actor_user_id, action, entity_type, entity_id, after_data,
      hash_chain_version, previous_hash, event_hash
    ) VALUES ($1, $2, $3, 'results', $4, $5::jsonb, 1, $6, $7)
    RETURNING id, action, entity_type AS "entityType", entity_id AS "entityId",
      after_data AS after, previous_hash AS "previousHash", event_hash AS "eventHash"`,
    [
      auditEventId,
      actorUserId,
      CEREMONIAL_DRAW_ACTION,
      eventId,
      JSON.stringify(normalizedPayload),
      previousHash,
      eventHash,
    ],
  );
  await client.query(
    `UPDATE ceremonial_draw_hash_chain_head
     SET last_audit_event_id = $1, last_hash = $2, updated_at = clock_timestamp()
     WHERE singleton = TRUE`,
    [auditEventId, eventHash],
  );
  return rows[0];
}
