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

  const { rows } = await client.query(
    `INSERT INTO audit_event (
      actor_user_id,
      action,
      entity_type,
      entity_id,
      before_data,
      after_data
    ) VALUES ($1, $2, $3, $4, $5::jsonb, $6::jsonb)
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
      actorUserId,
      requireText(action, "action"),
      requireText(entityType, "entityType"),
      requireText(entityId, "entityId"),
      JSON.stringify(before),
      JSON.stringify(after),
    ],
  );

  return rows[0];
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
