import { randomUUID } from "node:crypto";

export async function getAdminCredentialHash(client, adminUserId) {
  const { rows } = await client.query(
    `SELECT password FROM account
      WHERE "userId" = $1 AND "providerId" = 'credential' AND password IS NOT NULL
      LIMIT 1`,
    [adminUserId],
  );
  const passwordHash = rows[0]?.password;
  if (typeof passwordHash !== "string" || !passwordHash.includes(":")) {
    throw new Error("ADMIN_CREDENTIAL_HASH_INVALID: ejecutá primero npm run db:seed.");
  }
  return passwordHash;
}

export async function syncCredentialHash(client, userId, passwordHash) {
  const result = await client.query(
    `UPDATE account SET password = $2, "updatedAt" = CURRENT_TIMESTAMP
      WHERE "userId" = $1 AND "providerId" = 'credential'`,
    [userId, passwordHash],
  );
  if (result.rowCount > 0) return;

  await client.query(
    `INSERT INTO account(id, "userId", "accountId", "providerId", password, "createdAt", "updatedAt")
     VALUES ($1, $2, $2, 'credential', $3, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
    [randomUUID(), userId, passwordHash],
  );
}
