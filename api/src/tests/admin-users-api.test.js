import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import { createApp } from "../app.js";
import { getPool, closePool } from "../db/pool.js";
import { migrate } from "../db/migrate.js";

test("ADMIN emite y un invitado acepta un acceso operativo seguro", {
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
  let releaseConcurrentCreate;
  let notifyConcurrentCreate;
  const concurrentCreateStarted = new Promise((resolve) => { notifyConcurrentCreate = resolve; });
  const concurrentCreateCanFinish = new Promise((resolve) => { releaseConcurrentCreate = resolve; });
  let concurrentCreateCalls = 0;
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
      const isConcurrent = invitedEmail.startsWith("concurrent-");
      if (isConcurrent) {
        concurrentCreateCalls += 1;
        notifyConcurrentCreate();
        await concurrentCreateCanFinish;
      }
      const id = invitedEmail === email ? invitedUserId : randomUUID();
      await pool.query(
        `INSERT INTO "user"(id, name, email, "emailVerified")
         VALUES ($1, $2, $3, false)`,
        [id, name, invitedEmail],
      );
      return { id };
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
    assert.match(invitation.token, /^[A-Za-z0-9_-]{43}$/);

    const { rows: invitationRows } = await pool.query(
      "SELECT token_hash, status FROM role_invitation WHERE id = $1",
      [invitation.id],
    );
    assert.equal(invitationRows[0].status, "PENDING");
    assert.notEqual(invitationRows[0].token_hash, invitation.token);
    const { rows: tokenColumns } = await pool.query(
      "SELECT column_name FROM information_schema.columns WHERE table_name = 'role_invitation' AND column_name = 'token'",
    );
    assert.equal(tokenColumns.length, 0);

    const inspectResponse = await fetch(`${base}/api/v1/invitations/role/inspect`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ token: invitation.token }),
    });
    assert.equal(inspectResponse.status, 200);
    const inspection = await inspectResponse.json();
    assert.match(inspection.maskedEmail, /^c\*+@example\.test$/);
    assert.equal(inspection.roleCode, "COMISARIO");
    assert.equal(inspection.expiresAt, invitation.expiresAt);

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

    const forbiddenResponse = await fetch(`${base}/api/v1/users/invitations`, {
      method: "POST",
      headers: adminHeaders,
      body: JSON.stringify({ email: `admin-${randomUUID()}@example.test`, roleCode: "ADMIN" }),
    });
    assert.equal(forbiddenResponse.status, 400);
    assert.deepEqual(await forbiddenResponse.json(), { code: "INVALID_OPERATIONAL_ROLE" });

    const escribanoResponse = await fetch(`${base}/api/v1/users/invitations`, {
      method: "POST",
      headers: adminHeaders,
      body: JSON.stringify({ email: `escribano-${randomUUID()}@example.test`, roleCode: "ESCRIBANO" }),
    });
    assert.equal(escribanoResponse.status, 201);
    assert.equal((await escribanoResponse.json()).roleCode, "ESCRIBANO");

    const expiredResponse = await fetch(`${base}/api/v1/users/invitations`, {
      method: "POST",
      headers: adminHeaders,
      body: JSON.stringify({ email: `expired-${randomUUID()}@example.test`, roleCode: "VEEDOR" }),
    });
    const expiredInvitation = await expiredResponse.json();
    await pool.query(
      `UPDATE role_invitation
          SET created_at = clock_timestamp() - INTERVAL '73 hours',
              expires_at = clock_timestamp() - INTERVAL '1 minute'
        WHERE id = $1`,
      [expiredInvitation.id],
    );
    const inspectExpired = await fetch(`${base}/api/v1/invitations/role/inspect`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ token: expiredInvitation.token }),
    });
    assert.equal(inspectExpired.status, 400);
    assert.deepEqual(await inspectExpired.json(), { code: "INVITATION_INVALID" });

    const concurrentResponse = await fetch(`${base}/api/v1/users/invitations`, {
      method: "POST",
      headers: adminHeaders,
      body: JSON.stringify({ email: `concurrent-${randomUUID()}@example.test`, roleCode: "SCRUTINEER" }),
    });
    const concurrentInvitation = await concurrentResponse.json();
    const firstAcceptance = fetch(`${base}/api/v1/invitations/role/accept`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ token: concurrentInvitation.token, password: "password-de-prueba" }),
    });
    await concurrentCreateStarted;
    const losingAcceptance = await fetch(`${base}/api/v1/invitations/role/accept`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ token: concurrentInvitation.token, password: "password-de-prueba" }),
    });
    releaseConcurrentCreate();
    const winningAcceptance = await firstAcceptance;
    assert.equal(winningAcceptance.status, 201);
    assert.equal(losingAcceptance.status, 400);
    assert.deepEqual(await losingAcceptance.json(), { code: "INVITATION_INVALID" });
    assert.equal(concurrentCreateCalls, 1);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});
