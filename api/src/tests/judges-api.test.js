import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import { createApp } from "../app.js";
import { closePool, getPool } from "../db/pool.js";
import { migrate } from "../db/migrate.js";
import { acceptInvitation, createJudge } from "../modules/judges/judge-service.js";

test("I2-A administra padrón e invitaciones sin habilitar votación", {
  skip: !process.env.TEST_DATABASE_URL,
}, async (context) => {
  const originalDatabaseUrl = process.env.DATABASE_URL;
  context.after(async () => {
    await closePool();
    if (originalDatabaseUrl === undefined) delete process.env.DATABASE_URL;
    else process.env.DATABASE_URL = originalDatabaseUrl;
  });
  process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;
  await migrate();

  const adminId = randomUUID();
  const plainUserId = randomUUID();
  const pool = getPool();
  await pool.query(
    `INSERT INTO "user"(id, name, email, "emailVerified")
     VALUES ($1, 'Admin jurados', $2, true), ($3, 'Sin permisos', $4, true)`,
    [adminId, `${adminId}@example.test`, plainUserId, `${plainUserId}@example.test`],
  );
  await pool.query("INSERT INTO user_role(user_id, role_code) VALUES ($1, 'ADMIN')", [adminId]);

  const delivered = [];
  const revokedSessions = [];
  let failNextRevocation = true;
  const createdUserIds = [];
  const judgeEmail = `jurado-${randomUUID()}@example.test`;
  const createUser = async ({ email, name }) => {
    const id = randomUUID();
    await pool.query(
      `INSERT INTO "user"(id, name, email, "emailVerified") VALUES ($1, $2, $3, false)`,
      [id, name, email],
    );
    createdUserIds.push(id);
    return { id, name, email };
  };
  const app = createApp({
    getSession: async ({ headers }) => ({
      admin: { user: { id: adminId, name: "Admin jurados", email: `${adminId}@example.test`, twoFactorEnabled: true } },
      plain: { user: { id: plainUserId, name: "Sin permisos", email: `${plainUserId}@example.test`, twoFactorEnabled: true } },
      no2fa: { user: { id: adminId, name: "Admin jurados", email: `${adminId}@example.test`, twoFactorEnabled: false } },
      judge: createdUserIds[0] ? { user: { id: createdUserIds[0], name: "Jurado Uno", email: judgeEmail, twoFactorEnabled: true } } : null,
    })[headers.get("x-test-session")] ?? null,
    createUser,
    sendInvitation: async (message) => delivered.push(message),
    revokeSessions: async (userId) => {
      revokedSessions.push(userId);
      if (failNextRevocation) {
        failNextRevocation = false;
        throw new Error("temporary revocation failure");
      }
    },
  });
  const server = await new Promise((resolve) => {
    const instance = app.listen(0, "127.0.0.1", () => resolve(instance));
  });

  try {
    const base = `http://127.0.0.1:${server.address().port}`;
    const adminHeaders = { "content-type": "application/json", "x-test-session": "admin" };
    assert.equal((await fetch(`${base}/api/v1/judges`)).status, 401);
    assert.equal((await fetch(`${base}/api/v1/judges`, { headers: { "x-test-session": "plain" } })).status, 403);
    assert.equal((await fetch(`${base}/api/v1/judges`, { headers: { "x-test-session": "no2fa" } })).status, 403);

    const created = await fetch(`${base}/api/v1/judges`, {
      method: "POST",
      headers: adminHeaders,
      body: JSON.stringify({
        name: "Jurado Uno",
        email: judgeEmail,
        documentNumber: randomUUID(),
        actorUserId: plainUserId,
      }),
    });
    assert.equal(created.status, 201);
    const createdBody = await created.json();
    assert.equal(createdBody.judge.registrationStatus, "INVITED");
    assert.equal(createdBody.invitation.deliveryStatus, "SENT");
    assert.equal(JSON.stringify(createdBody).includes(delivered[0].secret), false);
    const profileActor = await pool.query("SELECT created_by FROM judge_profile WHERE id = $1", [createdBody.judge.id]);
    assert.equal(profileActor.rows[0].created_by, adminId);

    const inspection = await fetch(`${base}/api/v1/judge-invitations/inspect`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ secret: delivered[0].secret }),
    });
    assert.equal(inspection.status, 200);
    assert.match((await inspection.json()).maskedEmail, /^j\*+@example\.test$/);

    const reissued = await fetch(`${base}/api/v1/judges/${createdBody.judge.id}/invitations`, {
      method: "POST",
      headers: adminHeaders,
    });
    assert.equal(reissued.status, 201);
    assert.equal(delivered.length, 2);
    const oldInspection = await fetch(`${base}/api/v1/judge-invitations/inspect`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ secret: delivered[0].secret }),
    });
    assert.equal(oldInspection.status, 400);

    const acceptRequest = () => fetch(`${base}/api/v1/judge-invitations/accept`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ secret: delivered[1].secret, password: "JudgePassword-2026!" }),
    });
    const concurrentAcceptances = await Promise.all([acceptRequest(), acceptRequest()]);
    assert.deepEqual(concurrentAcceptances.map((response) => response.status).sort(), [201, 400]);
    const accepted = concurrentAcceptances.find((response) => response.status === 201);
    assert.deepEqual(await accepted.json(), { accepted: true, next: "TWO_FACTOR_SETUP" });
    const userId = createdUserIds[0];
    assert.equal((await pool.query(
      "SELECT 1 FROM user_role WHERE user_id = $1 AND role_code = 'JUDGE'",
      [userId],
    )).rows.length, 1);

    const reused = await fetch(`${base}/api/v1/judge-invitations/accept`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ secret: delivered[1].secret, password: "JudgePassword-2026!" }),
    });
    assert.equal(reused.status, 400);

    const me = await fetch(`${base}/api/v1/me`, { headers: { "x-test-session": "judge" } });
    assert.equal(me.status, 200);
    const meBody = await me.json();
    assert.deepEqual(meBody.roles, ["JUDGE"]);
    assert.equal(meBody.judgeProfile.registrationStatus, "REGISTERED");
    const ownProfile = await fetch(`${base}/api/v1/judge/profile`, { headers: { "x-test-session": "judge" } });
    assert.equal(ownProfile.status, 200);
    assert.deepEqual((await ownProfile.json()).assignments, []);

    const suspended = await fetch(`${base}/api/v1/judges/${createdBody.judge.id}/suspend`, {
      method: "POST",
      headers: adminHeaders,
    });
    assert.equal(suspended.status, 503);
    const suspendedMe = await fetch(`${base}/api/v1/me`, { headers: { "x-test-session": "judge" } });
    assert.equal((await suspendedMe.json()).judgeProfile.registrationStatus, "SUSPENDED");
    const suspendedProfile = await fetch(`${base}/api/v1/judge/profile`, { headers: { "x-test-session": "judge" } });
    assert.equal(suspendedProfile.status, 403);
    assert.deepEqual(await suspendedProfile.json(), { code: "JUDGE_SUSPENDED" });

    const retriedSuspension = await fetch(`${base}/api/v1/judges/${createdBody.judge.id}/suspend`, {
      method: "POST",
      headers: adminHeaders,
    });
    assert.equal(retriedSuspension.status, 200);
    assert.deepEqual(revokedSessions, [userId, userId]);

    const reactivated = await fetch(`${base}/api/v1/judges/${createdBody.judge.id}/reactivate`, {
      method: "POST",
      headers: adminHeaders,
    });
    assert.equal(reactivated.status, 200);
    assert.deepEqual(revokedSessions, [userId, userId, userId]);

    const auditRows = await pool.query(
      `SELECT after_data::text AS data FROM audit_event
        WHERE entity_type IN ('judge_profile', 'judge_invitation')
          AND (after_data::text ILIKE '%secret%' OR after_data::text ILIKE '%password%')`,
    );
    assert.equal(auditRows.rows.length, 0);

    const untrusted = await fetch(`${base}/api/v1/judges`, {
      method: "POST",
      headers: { ...adminHeaders, origin: "https://attacker.example" },
      body: JSON.stringify({ name: "Ataque", email: "attack@example.test", documentNumber: randomUUID() }),
    });
    assert.equal(untrusted.status, 403);
    assert.deepEqual(await untrusted.json(), { code: "UNTRUSTED_ORIGIN" });

    const recipientList = await fetch(`${base}/api/v1/judges`, {
      method: "POST",
      headers: adminHeaders,
      body: JSON.stringify({ name: "Lista", email: "one@example.test,two@example.test", documentNumber: randomUUID() }),
    });
    assert.equal(recipientList.status, 400);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});

test("la entrega puede finalizar después de que la invitación fue aceptada", {
  skip: !process.env.TEST_DATABASE_URL,
}, async (context) => {
  const originalDatabaseUrl = process.env.DATABASE_URL;
  context.after(async () => {
    await closePool();
    if (originalDatabaseUrl === undefined) delete process.env.DATABASE_URL;
    else process.env.DATABASE_URL = originalDatabaseUrl;
  });
  process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;
  await migrate();
  const pool = getPool();
  const adminId = randomUUID();
  await pool.query(
    `INSERT INTO "user"(id, name, email, "emailVerified") VALUES ($1, 'Admin carrera', $2, true)`,
    [adminId, `${adminId}@example.test`],
  );
  await pool.query("INSERT INTO user_role(user_id,role_code) VALUES($1,'ADMIN')", [adminId]);
  const email = `delivery-race-${randomUUID()}@example.test`;
  const createUser = async ({ name }) => {
    const id = randomUUID();
    await pool.query(
      `INSERT INTO "user"(id, name, email, "emailVerified") VALUES ($1, $2, $3, false)`,
      [id, name, email],
    );
    return { id, name, email };
  };
  const result = await createJudge({
    actorUserId: adminId,
    name: "Jurado carrera",
    email,
    documentNumber: randomUUID(),
    sendInvitation: async ({ secret }) => {
      await acceptInvitation({
        secret,
        password: "RacePassword-2026!",
        createUser,
      });
    },
  });
  assert.equal(result.invitation.status, "USED");
  assert.equal(result.invitation.deliveryStatus, "SENT");
  const { rows } = await pool.query(
    "SELECT status, delivery_status FROM judge_invitation WHERE id = $1",
    [result.invitation.id],
  );
  assert.deepEqual(rows[0], { status: "USED", delivery_status: "SENT" });
});

test("un worker que pierde su claim no elimina una identidad ya registrada", {
  skip: !process.env.TEST_DATABASE_URL,
}, async (context) => {
  const originalDatabaseUrl = process.env.DATABASE_URL;
  context.after(async () => {
    await closePool();
    if (originalDatabaseUrl === undefined) delete process.env.DATABASE_URL;
    else process.env.DATABASE_URL = originalDatabaseUrl;
  });
  process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;
  await migrate();
  const pool = getPool();
  const adminId = randomUUID();
  await pool.query(
    `INSERT INTO "user"(id, name, email, "emailVerified") VALUES ($1, 'Admin takeover', $2, true)`,
    [adminId, `${adminId}@example.test`],
  );
  await pool.query("INSERT INTO user_role(user_id,role_code) VALUES($1,'ADMIN')", [adminId]);
  let secret;
  const email = `takeover-${randomUUID()}@example.test`;
  await createJudge({
    actorUserId: adminId,
    name: "Jurado takeover",
    email,
    documentNumber: randomUUID(),
    sendInvitation: async (message) => { secret = message.secret; },
  });

  const user = { id: randomUUID(), name: "Jurado takeover", email };
  let releaseFirst;
  let notifyFirstStarted;
  const firstStarted = new Promise((resolve) => { notifyFirstStarted = resolve; });
  const firstCanFinish = new Promise((resolve) => { releaseFirst = resolve; });
  let calls = 0;
  const createUser = async () => {
    calls += 1;
    if (calls === 1) {
      await pool.query(
        `INSERT INTO "user"(id, name, email, "emailVerified") VALUES ($1, $2, $3, false)`,
        [user.id, user.name, user.email],
      );
      notifyFirstStarted();
      await firstCanFinish;
      return user;
    }
    return { user, created: false };
  };
  const first = acceptInvitation({
    secret,
    password: "TakeoverPassword-2026!",
    createUser,
  });
  await firstStarted;
  await pool.query(
    `UPDATE judge_invitation
        SET acceptance_claimed_at = clock_timestamp() - INTERVAL '6 minutes'
      WHERE status = 'PENDING' AND acceptance_claim_id IS NOT NULL`,
  );
  const second = await acceptInvitation({
    secret,
    password: "TakeoverPassword-2026!",
    createUser,
  });
  releaseFirst();
  const firstResult = await first;

  assert.deepEqual(second, { accepted: true, next: "TWO_FACTOR_SETUP" });
  assert.deepEqual(firstResult, { accepted: true, next: "TWO_FACTOR_SETUP" });
  assert.equal((await pool.query('SELECT 1 FROM "user" WHERE id = $1', [user.id])).rows.length, 1);
});

test("ADMIN gestiona cupos y asignaciones, y JUDGE consulta solo las propias", {
  skip: !process.env.TEST_DATABASE_URL,
}, async (context) => {
  const originalDatabaseUrl = process.env.DATABASE_URL;
  context.after(async () => {
    await closePool();
    if (originalDatabaseUrl === undefined) delete process.env.DATABASE_URL;
    else process.env.DATABASE_URL = originalDatabaseUrl;
  });
  process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;
  await migrate();
  const pool = getPool();
  const adminId = randomUUID();
  const firstUserId = randomUUID();
  const secondUserId = randomUUID();
  await pool.query(
    `INSERT INTO "user"(id,name,email,"emailVerified") VALUES
     ($1,'Admin cupos',$2,true),($3,'Jurado A',$4,true),($5,'Jurado B',$6,true)`,
    [adminId, `${adminId}@example.test`, firstUserId, `${firstUserId}@example.test`, secondUserId, `${secondUserId}@example.test`],
  );
  await pool.query("INSERT INTO user_role(user_id,role_code) VALUES($1,'ADMIN'),($2,'JUDGE'),($3,'JUDGE')", [adminId, firstUserId, secondUserId]);
  const eventId = randomUUID();
  const nightId = randomUUID();
  const specialtyId = randomUUID();
  const firstProfileId = randomUUID();
  const secondProfileId = randomUUID();
  await pool.query("INSERT INTO carnival_event(id,name) VALUES($1,'Evento cupos')", [eventId]);
  await pool.query(
    "INSERT INTO night(id,event_id,name,display_order,kind) VALUES($1,$2,'Noche cupos',1,'COMPETITION')",
    [nightId, eventId],
  );
  await pool.query(
    "INSERT INTO event_specialty(id,event_id,name,code,display_order) VALUES($1,$2,'Baile','BAILE',1)",
    [specialtyId, eventId],
  );
  await pool.query(
    `INSERT INTO judge_profile(id,user_id,name,email,document_number,registration_status,created_by) VALUES
     ($1,$2,'Jurado A',$3,$4,'REGISTERED',$5),($6,$7,'Jurado B',$8,$9,'REGISTERED',$5)`,
    [firstProfileId, firstUserId, `${firstUserId}@example.test`, randomUUID(), adminId, secondProfileId, secondUserId, `${secondUserId}@example.test`, randomUUID()],
  );
  const sessions = {
    admin: { user: { id: adminId, name: "Admin cupos", email: `${adminId}@example.test`, twoFactorEnabled: true } },
    first: { user: { id: firstUserId, name: "Jurado A", email: `${firstUserId}@example.test`, twoFactorEnabled: true } },
  };
  const app = createApp({
    getSession: async ({ headers }) => sessions[headers.get("x-test-session")] ?? null,
  });
  const server = await new Promise((resolve) => {
    const instance = app.listen(0, "127.0.0.1", () => resolve(instance));
  });
  try {
    const base = `http://127.0.0.1:${server.address().port}`;
    const adminHeaders = { "content-type": "application/json", "x-test-session": "admin" };
    const firstHeaders = { "x-test-session": "first" };
    const quota = await fetch(`${base}/api/v1/events/${eventId}/nights/${nightId}/specialties/${specialtyId}/judge-quota`, {
      method: "PUT", headers: adminHeaders, body: JSON.stringify({ maxAssignments: 1 }),
    });
    assert.equal(quota.status, 200);
    const assignment = await fetch(`${base}/api/v1/events/${eventId}/judge-assignments`, {
      method: "POST", headers: adminHeaders, body: JSON.stringify({ nightId, specialtyId, judgeProfileId: firstProfileId }),
    });
    assert.equal(assignment.status, 201);
    const assignmentBody = await assignment.json();
    const own = await fetch(`${base}/api/v1/judge/assignments`, { headers: firstHeaders });
    assert.equal(own.status, 200);
    assert.equal((await own.json()).length, 1);
    const full = await fetch(`${base}/api/v1/events/${eventId}/judge-assignments`, { headers: adminHeaders });
    assert.equal(full.status, 200);
    assert.equal((await full.json()).assignments.length, 1);
    const duplicateNight = await fetch(`${base}/api/v1/events/${eventId}/judge-assignments`, {
      method: "POST", headers: adminHeaders, body: JSON.stringify({ nightId, specialtyId, judgeProfileId: secondProfileId }),
    });
    assert.deepEqual({ status: duplicateNight.status, body: await duplicateNight.json() }, { status: 409, body: { code: "JUDGE_QUOTA_FULL" } });
    const replacement = await fetch(`${base}/api/v1/judge-assignments/${assignmentBody.id}/replace`, {
      method: "POST", headers: adminHeaders, body: JSON.stringify({ replacementJudgeProfileId: secondProfileId, assignmentType: "PRIMARY", reason: "Reemplazo operativo" }),
    });
    assert.equal(replacement.status, 201);
    const replacementBody = await replacement.json();
    assert.equal(replacementBody.replacedAssignmentId, assignmentBody.id);
    const listed = await fetch(`${base}/api/v1/events/${eventId}/judge-assignments`, { headers: adminHeaders });
    const listedBody = await listed.json();
    assert.equal(listedBody.assignments.length, 2);
    assert.equal(listedBody.assignments.filter((item) => item.status === "ACTIVE").length, 1);
    const revoke = await fetch(`${base}/api/v1/judge-assignments/${replacementBody.id}/revoke`, {
      method: "POST", headers: adminHeaders, body: JSON.stringify({ reason: "Fin de cobertura" }),
    });
    assert.equal(revoke.status, 200);
    const concurrent = await Promise.all([firstProfileId, secondProfileId].map((judgeProfileId) => fetch(`${base}/api/v1/events/${eventId}/judge-assignments`, {
      method: "POST", headers: adminHeaders, body: JSON.stringify({ nightId, specialtyId, judgeProfileId }),
    })));
    assert.deepEqual(concurrent.map((response) => response.status).sort(), [201, 409]);
    assert.equal((await pool.query(
      "SELECT count(*)::int AS count FROM judge_assignment WHERE night_id = $1 AND specialty_id = $2 AND status = 'ACTIVE'",
      [nightId, specialtyId],
    )).rows[0].count, 1);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});

test("un fallo de entrega conserva la invitación sin exponer su secreto", {
  skip: !process.env.TEST_DATABASE_URL,
}, async (context) => {
  const originalDatabaseUrl = process.env.DATABASE_URL;
  context.after(async () => {
    await closePool();
    if (originalDatabaseUrl === undefined) delete process.env.DATABASE_URL;
    else process.env.DATABASE_URL = originalDatabaseUrl;
  });
  process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;
  await migrate();
  const adminId = randomUUID();
  await getPool().query(
    `INSERT INTO "user"(id, name, email, "emailVerified") VALUES ($1, 'Admin delivery', $2, true)`,
    [adminId, `${adminId}@example.test`],
  );
  await getPool().query("INSERT INTO user_role(user_id, role_code) VALUES($1,'ADMIN')", [adminId]);
  const app = createApp({
    getSession: async () => ({ user: { id: adminId, twoFactorEnabled: true } }),
    sendInvitation: async () => { throw new Error("SMTP unavailable"); },
  });
  const server = await new Promise((resolve) => {
    const instance = app.listen(0, "127.0.0.1", () => resolve(instance));
  });
  try {
    const base = `http://127.0.0.1:${server.address().port}`;
    const response = await fetch(`${base}/api/v1/judges`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        name: "Jurado sin correo",
        email: `failed-${randomUUID()}@example.test`,
        documentNumber: randomUUID(),
      }),
    });
    assert.equal(response.status, 502);
    assert.deepEqual(await response.json(), { code: "INVITATION_DELIVERY_FAILED" });
    const { rows } = await getPool().query(
      "SELECT delivery_status FROM judge_invitation ORDER BY created_at DESC LIMIT 1",
    );
    assert.equal(rows[0].delivery_status, "FAILED");
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});
