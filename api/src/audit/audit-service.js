const forbiddenFieldPattern = /password|token|secret|otp|authorization|cookie/i;

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
