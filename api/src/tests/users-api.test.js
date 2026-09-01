import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import { createApp } from "../app.js";
import { closePool, getPool } from "../db/pool.js";
import { migrate } from "../db/migrate.js";

test("solo un ADMIN con 2FA lista usuarios y administra privilegios", {
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
  const candidateId = randomUUID();
  const pool = getPool();
  await pool.query(
    `INSERT INTO "user"(id,name,email,"emailVerified")
     VALUES($1,'Admin',$2,true),($3,'Candidate',$4,true)`,
    [adminId, `${adminId}@example.test`, candidateId, `${candidateId}@example.test`],
  );
  await pool.query("INSERT INTO user_role(user_id,role_code) VALUES($1,'ADMIN')", [adminId]);
  await pool.query("INSERT INTO user_role(user_id,role_code) VALUES($1,'VEEDOR')", [candidateId]);

  const app = createApp({
    getSession: async ({ headers }) => ({
      admin: { user: { id: adminId, twoFactorEnabled: true } },
      candidate: { user: { id: candidateId, twoFactorEnabled: true } },
      noTwoFactor: { user: { id: adminId, twoFactorEnabled: false } },
    })[headers.get("x-test-session")] ?? null,
  });
  const server = await new Promise((resolve) => {
    const instance = app.listen(0, "127.0.0.1", () => resolve(instance));
  });
  try {
    const base = `http://127.0.0.1:${server.address().port}`;
    const headers = { "content-type": "application/json", "x-test-session": "admin" };
    assert.equal((await fetch(`${base}/api/v1/users`)).status, 401);
    assert.equal((await fetch(`${base}/api/v1/users`, { headers: { "x-test-session": "candidate" } })).status, 403);
    assert.equal((await fetch(`${base}/api/v1/users`, { headers: { "x-test-session": "noTwoFactor" } })).status, 403);

    const list = await fetch(`${base}/api/v1/users`, { headers });
    assert.equal(list.status, 200);
    assert.ok((await list.json()).some((user) => user.id === candidateId));

    const promote = await fetch(`${base}/api/v1/users/${candidateId}/roles/admin`, { method: "POST", headers });
    assert.equal(promote.status, 201);
    assert.deepEqual(await promote.json(), { created: true });

    const revokeCandidate = await fetch(`${base}/api/v1/users/${candidateId}/roles/admin`, { method: "DELETE", headers });
    assert.equal(revokeCandidate.status, 200);
    assert.deepEqual(await revokeCandidate.json(), { removed: true });
    const missingUser = await fetch(`${base}/api/v1/users/${randomUUID()}/roles/admin`, { method: "DELETE", headers });
    assert.equal(missingUser.status, 404);
    assert.deepEqual(await missingUser.json(), { code: "USER_NOT_FOUND" });
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});
