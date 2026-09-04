import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import { closePool, getPool } from "../pool.js";
import { migrate } from "../migrate.js";

const originalDatabaseUrl = process.env.DATABASE_URL;

test("el padrón conserva historia y las invitaciones son únicas y de uso único", {
  skip: !process.env.TEST_DATABASE_URL,
}, async (context) => {
  context.after(async () => {
    await closePool();
    if (originalDatabaseUrl === undefined) delete process.env.DATABASE_URL;
    else process.env.DATABASE_URL = originalDatabaseUrl;
  });
  process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;
  await migrate();

  const client = await getPool().connect();
  try {
    await client.query("BEGIN");
    const adminId = randomUUID();
    const judgeUserId = randomUUID();
    await client.query(
      `INSERT INTO "user"(id, name, email, "emailVerified")
       VALUES ($1, 'Admin padrón', $2, true), ($3, 'Jurado padrón', $4, true)`,
      [adminId, `${adminId}@example.test`, judgeUserId, `${judgeUserId}@example.test`],
    );
    const { rows: profiles } = await client.query(
      `INSERT INTO judge_profile (name, email, document_number, created_by)
       VALUES ('Jurado invitado', $1, $2, $3)
       RETURNING id, registration_status`,
      [`judge-${randomUUID()}@example.test`, randomUUID(), adminId],
    );
    const profile = profiles[0];
    assert.equal(profile.registration_status, "INVITED");

    await client.query("SAVEPOINT premature_identity_link");
    await assert.rejects(
      () => client.query("UPDATE judge_profile SET user_id = $2 WHERE id = $1", [profile.id, judgeUserId]),
      /JUDGE_IDENTITY_LINK_REQUIRES_REGISTRATION/,
    );
    await client.query("ROLLBACK TO SAVEPOINT premature_identity_link");

    const firstHash = "a".repeat(64);
    await client.query(
      `INSERT INTO judge_invitation (judge_profile_id, secret_hash, expires_at, created_by)
       VALUES ($1, $2, CURRENT_TIMESTAMP + INTERVAL '72 hours', $3)`,
      [profile.id, firstHash, adminId],
    );
    await client.query("SAVEPOINT duplicate_pending");
    await assert.rejects(
      () => client.query(
        `INSERT INTO judge_invitation (judge_profile_id, secret_hash, expires_at, created_by)
         VALUES ($1, $2, CURRENT_TIMESTAMP + INTERVAL '72 hours', $3)`,
        [profile.id, "b".repeat(64), adminId],
      ),
      { code: "23505" },
    );
    await client.query("ROLLBACK TO SAVEPOINT duplicate_pending");

    await client.query(
      `UPDATE judge_profile
          SET user_id = $2, registration_status = 'REGISTERED'
        WHERE id = $1`,
      [profile.id, judgeUserId],
    );
    await client.query(
      "UPDATE judge_profile SET registration_status = 'SUSPENDED' WHERE id = $1",
      [profile.id],
    );
    await client.query(
      "UPDATE judge_profile SET registration_status = 'REGISTERED' WHERE id = $1",
      [profile.id],
    );

    await client.query("SAVEPOINT identity_reassignment");
    await assert.rejects(
      () => client.query("UPDATE judge_profile SET user_id = $2 WHERE id = $1", [profile.id, adminId]),
      /JUDGE_IDENTITY_REASSIGNMENT_FORBIDDEN/,
    );
    await client.query("ROLLBACK TO SAVEPOINT identity_reassignment");

    await client.query("SAVEPOINT invalid_transition");
    await assert.rejects(
      () => client.query(
        "UPDATE judge_profile SET registration_status = 'INVITED' WHERE id = $1",
        [profile.id],
      ),
      /INVALID_JUDGE_STATUS/,
    );
    await client.query("ROLLBACK TO SAVEPOINT invalid_transition");

    await client.query("SAVEPOINT profile_delete");
    await assert.rejects(
      () => client.query("DELETE FROM judge_profile WHERE id = $1", [profile.id]),
      /JUDGE_PROFILE_DELETE_FORBIDDEN/,
    );
    await client.query("ROLLBACK TO SAVEPOINT profile_delete");

    await client.query("SAVEPOINT invitation_delete");
    await assert.rejects(
      () => client.query("DELETE FROM judge_invitation WHERE judge_profile_id = $1", [profile.id]),
      /JUDGE_INVITATION_DELETE_FORBIDDEN/,
    );
    await client.query("ROLLBACK TO SAVEPOINT invitation_delete");

    await client.query("SAVEPOINT invitation_rewrite");
    await assert.rejects(
      () => client.query(
        "UPDATE judge_invitation SET secret_hash = $2 WHERE judge_profile_id = $1",
        [profile.id, "c".repeat(64)],
      ),
      /JUDGE_INVITATION_HISTORY_IMMUTABLE/,
    );
    await client.query("ROLLBACK TO SAVEPOINT invitation_rewrite");

    await client.query(
      `UPDATE judge_invitation
          SET acceptance_claim_id = $2,
              acceptance_claimed_at = CURRENT_TIMESTAMP,
              status = 'USED',
              used_at = CURRENT_TIMESTAMP
        WHERE judge_profile_id = $1`,
      [profile.id, randomUUID()],
    );
    await client.query("SAVEPOINT invitation_reopen");
    await assert.rejects(
      () => client.query(
        "UPDATE judge_invitation SET status = 'PENDING', used_at = NULL WHERE judge_profile_id = $1",
        [profile.id],
      ),
      /JUDGE_INVITATION_FINAL/,
    );
    await client.query("ROLLBACK TO SAVEPOINT invitation_reopen");
  } finally {
    await client.query("ROLLBACK");
    client.release();
  }
});

test("los cupos y asignaciones preservan integridad, capacidad e historia", {
  skip: !process.env.TEST_DATABASE_URL,
}, async (context) => {
  context.after(async () => closePool());
  process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;
  await migrate();
  const client = await getPool().connect();
  try {
    await client.query("BEGIN");
    const adminId = randomUUID();
    const firstUserId = randomUUID();
    const secondUserId = randomUUID();
    await client.query(
      `INSERT INTO "user"(id, name, email, "emailVerified") VALUES
       ($1, 'Admin asignaciones', $2, true), ($3, 'Jurado uno', $4, true), ($5, 'Jurado dos', $6, true)`,
      [adminId, `${adminId}@example.test`, firstUserId, `${firstUserId}@example.test`, secondUserId, `${secondUserId}@example.test`],
    );
    const eventId = randomUUID();
    const nightId = randomUUID();
    const specialtyId = randomUUID();
    await client.query("INSERT INTO carnival_event(id,name) VALUES($1,'Evento asignaciones')", [eventId]);
    await client.query(
      `INSERT INTO night(id,event_id,name,display_order,kind) VALUES($1,$2,'Noche uno',1,'COMPETITION')`,
      [nightId, eventId],
    );
    await client.query(
      `INSERT INTO event_specialty(id,event_id,name,code,display_order) VALUES($1,$2,'Baile','BAILE',1)`,
      [specialtyId, eventId],
    );
    const profileIds = [randomUUID(), randomUUID()];
    for (const [profileId, userId, name] of [[profileIds[0], firstUserId, "Jurado uno"], [profileIds[1], secondUserId, "Jurado dos"]]) {
      await client.query(
        `INSERT INTO judge_profile(id,user_id,name,email,document_number,registration_status,created_by)
         VALUES($1,$2,$3,$4,$5,'REGISTERED',$6)`,
        [profileId, userId, name, `${userId}@example.test`, randomUUID(), adminId],
      );
    }
    const quotaId = randomUUID();
    await client.query(
      `INSERT INTO judge_quota(id,event_id,night_id,specialty_id,max_assignments) VALUES($1,$2,$3,$4,1)`,
      [quotaId, eventId, nightId, specialtyId],
    );
    const assignmentId = randomUUID();
    await client.query(
      `INSERT INTO judge_assignment(id,event_id,night_id,specialty_id,judge_profile_id)
       VALUES($1,$2,$3,$4,$5)`,
      [assignmentId, eventId, nightId, specialtyId, profileIds[0]],
    );
    await client.query("SAVEPOINT full_quota");
    await assert.rejects(
      () => client.query(
        `INSERT INTO judge_assignment(event_id,night_id,specialty_id,judge_profile_id)
         VALUES($1,$2,$3,$4)`,
        [eventId, nightId, specialtyId, profileIds[1]],
      ),
      /JUDGE_QUOTA_FULL/,
    );
    await client.query("ROLLBACK TO SAVEPOINT full_quota");
    await client.query("SAVEPOINT lower_quota");
    await assert.rejects(
      () => client.query("UPDATE judge_quota SET max_assignments = 0 WHERE id = $1", [quotaId]),
      /JUDGE_QUOTA_BELOW_ASSIGNMENTS/,
    );
    await client.query("ROLLBACK TO SAVEPOINT lower_quota");
    await client.query(
      `UPDATE judge_assignment SET status='REVOKED', reason='Cambio operativo', revoked_at=CURRENT_TIMESTAMP, revoked_by=$2 WHERE id=$1`,
      [assignmentId, adminId],
    );
    const replacementId = randomUUID();
    await client.query(
      `INSERT INTO judge_assignment(id,event_id,night_id,specialty_id,judge_profile_id,assignment_type,reason,replaced_assignment_id)
       VALUES($1,$2,$3,$4,$5,'PRIMARY','Cambio operativo',$6)`,
      [replacementId, eventId, nightId, specialtyId, profileIds[1], assignmentId],
    );
    await client.query("SAVEPOINT history");
    await assert.rejects(
      () => client.query("UPDATE judge_assignment SET judge_profile_id = $2 WHERE id = $1", [replacementId, profileIds[0]]),
      /JUDGE_ASSIGNMENT_HISTORY_IMMUTABLE/,
    );
    await client.query("ROLLBACK TO SAVEPOINT history");
    await client.query("UPDATE night SET status = 'OPEN' WHERE id = $1", [nightId]);
    await client.query("UPDATE night SET status = 'CLOSED' WHERE id = $1", [nightId]);
    await client.query("SAVEPOINT closed_night");
    await assert.rejects(
      () => client.query("UPDATE night SET name = 'Noche cerrada' WHERE id = $1", [nightId]),
      /NIGHT_CLOSED/,
    );
    await client.query("ROLLBACK TO SAVEPOINT closed_night");
  } finally {
    await client.query("ROLLBACK");
    client.release();
  }
});
