import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import { createApp } from "../app.js";
import { getPool, closePool } from "../db/pool.js";
import { migrate } from "../db/migrate.js";

test("ADMIN emite y un invitado acepta un acceso operativo", {
  skip: !process.env.TEST_DATABASE_URL,
}, async (context) => {
  const original = process.env.DATABASE_URL;
  context.after(async () => {
    await closePool();
    if (original === undefined) delete process.env.DATABASE_URL;
    else process.env.DATABASE_URL = original;
  });
  process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;
  await migrate();

  const adminId = randomUUID();
  const invitedUserId = randomUUID();
  const email = `comisario-${randomUUID()}@example.test`;
  const pool = getPool();
  await pool.query(
    `INSERT INTO "user"(id, name, email, "emailVerified")
     VALUES ($1, 'Admin', $2, true)`,
    [adminId, `${adminId}@example.test`],
  );
  await pool.query("INSERT INTO user_role(user_id, role_code) VALUES($1, 'ADMIN')", [adminId]);

  const app = createApp({
    getSession: async ({ headers }) => headers.get("x-test-session") === "admin"
      ? { user: { id: adminId, twoFactorEnabled: true } }
      : null,
    createUser: async ({ email: invitedEmail, name }) => {
      await pool.query(
        `INSERT INTO "user"(id, name, email, "emailVerified")
         VALUES ($1, $2, $3, false)`,
        [invitedUserId, name, invitedEmail],
      );
      return { id: invitedUserId };
    },
  });
  const server = await new Promise((resolve) => {
    const instance = app.listen(0, "127.0.0.1", () => resolve(instance));
  });
  try {
    const base = `http://127.0.0.1:${server.address().port}`;
    const adminHeaders = {
      "content-type": "application/json",
      "x-test-session": "admin",
    };
    const inviteResponse = await fetch(`${base}/api/v1/users/invitations`, {
      method: "POST",
      headers: adminHeaders,
      body: JSON.stringify({ email, roleCode: "COMISARIO" }),
    });
    assert.equal(inviteResponse.status, 201);
    const invitation = await inviteResponse.json();

    const inspectResponse = await fetch(`${base}/api/v1/invitations/role/${invitation.token}`);
    assert.equal(inspectResponse.status, 200);
    assert.deepEqual(await inspectResponse.json(), {
      id: invitation.id,
      email,
      roleCode: "COMISARIO",
      expiresAt: invitation.expiresAt,
    });

    const acceptResponse = await fetch(`${base}/api/v1/invitations/role/accept`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ token: invitation.token, password: "password-de-prueba" }),
    });
    assert.equal(acceptResponse.status, 201);
    assert.deepEqual(await acceptResponse.json(), { userId: invitedUserId, roleCode: "COMISARIO" });

    const { rows: roles } = await pool.query(
      "SELECT role_code FROM user_role WHERE user_id = $1",
      [invitedUserId],
    );
    assert.deepEqual(roles, [{ role_code: "COMISARIO" }]);
    const { rows: audit } = await pool.query(
      "SELECT action, after_data AS after FROM audit_event WHERE actor_user_id = $1",
      [invitedUserId],
    );
    assert.deepEqual(audit, [{ action: "USER_ROLE_GRANTED", after: { roleCode: "COMISARIO", fromInvitation: invitation.id } }]);

    const reusedResponse = await fetch(`${base}/api/v1/invitations/role/accept`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ token: invitation.token, password: "password-de-prueba" }),
    });
    assert.equal(reusedResponse.status, 400);
    assert.deepEqual(await reusedResponse.json(), { code: "INVITATION_INVALID" });
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});
