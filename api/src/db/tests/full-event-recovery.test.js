import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import test from "node:test";
import { createCredentialUser } from "../../auth/account-service.js";
import { createJudge } from "../../modules/judges/judge-service.js";
import { createOperationalProfile } from "../../modules/operational-profiles/operational-profile-service.js";
import { FULL_JUDGES, FULL_AUXILIARIES } from "../seeds/full-event.fixture.js";
import { seedFixtureUsers } from "../seeds/full-event.users.js";
import { migrate } from "../migrate.js";
import { prepareDemoSeedTest } from "./demo-seed-test-environment.js";

const provisionUsers = () => seedFixtureUsers({ judges: FULL_JUDGES, auxiliaries: FULL_AUXILIARIES });

test("seed recupera bootstrap e invitaciones interrumpidas sin adoptar cuentas ajenas", {
  skip: !process.env.TEST_DATABASE_URL,
}, async (t) => {
  const { pool, password, createAuth } = await prepareDemoSeedTest(t);
  await migrate();
  const admin = await createCredentialUser({ email: process.env.SEED_ADMIN_EMAIL, name: "Admin Demo", password });
  // Simulate a process interrupted after identity creation, before role grant.
  assert.equal((await pool.query("SELECT count(*)::int AS n FROM user_role")).rows[0].n, 0);
  const sendInvitation = async () => { throw new Error("TEST_DELIVERY_INTERRUPTED"); };
  await assert.rejects(() => createJudge({ ...FULL_JUDGES[0], actorUserId: admin.id, sendInvitation }), /INVITATION_DELIVERY_FAILED/);
  const escribano = FULL_AUXILIARIES.find((entry) => entry.role === "ESCRIBANO");
  await assert.rejects(() => createOperationalProfile({ ...escribano, actorUserId: admin.id, roleCodes: ["ESCRIBANO"], sendInvitation }), /INVITATION_DELIVERY_FAILED/);
  const before = (await pool.query("SELECT id FROM judge_profile")).rows[0];
  const result = await provisionUsers();
  assert.equal(result.admin.userId, admin.id);
  assert.equal(result.judges[0].profileId, before.id);
  assert.equal((await pool.query("SELECT count(*)::int AS n FROM judge_invitation WHERE status='REVOKED'")).rows[0].n, 1);
  assert.equal((await pool.query("SELECT count(*)::int AS n FROM operational_invitation WHERE status='REVOKED'")).rows[0].n, 1);
  assert.equal((await pool.query("SELECT count(*)::int AS n FROM operational_invitation WHERE status='USED'")).rows[0].n, 2);

  // A persisted credential with a session left by interrupted revocation is
  // completed on replay even when the password itself already matches.
  const auth = createAuth({ sendOtp: async () => {} });
  await auth.api.signInEmail({ body: { email: escribano.email, password } });
  assert.equal((await pool.query('SELECT count(*)::int AS n FROM session')).rows[0].n, 1);
  await provisionUsers();
  assert.equal((await pool.query('SELECT count(*)::int AS n FROM session')).rows[0].n, 0);

  const incompatible = { name: "Perfil incompatible", email: "incompatible-veedor@example.test", documentNumber: "79000001" };
  await assert.rejects(() => createOperationalProfile({ ...incompatible, actorUserId: admin.id,
    roleCodes: ["ESCRIBANO"], sendInvitation }), /INVITATION_DELIVERY_FAILED/);
  const invitationSnapshot = (await pool.query("SELECT * FROM operational_invitation ORDER BY id")).rows;
  await assert.rejects(() => seedFixtureUsers({ judges: [], auxiliaries: [{ ...incompatible, role: "VEEDOR" }] }), /DEMO_USER_ROLE_CONFLICT/);
  assert.deepEqual((await pool.query("SELECT * FROM operational_invitation ORDER BY id")).rows, invitationSnapshot);
  assert.equal((await pool.query('SELECT count(*)::int AS n FROM "user" WHERE email=$1', [incompatible.email])).rows[0].n, 0);

  const foreignEmail = "foreign-admin@example.test";
  const foreign = await createCredentialUser({ email: foreignEmail, name: "Foreign", password: randomBytes(12).toString("hex") });
  process.env.SEED_ADMIN_EMAIL = foreignEmail;
  await assert.rejects(provisionUsers, /ACCOUNT_ALREADY_EXISTS/);
  assert.equal((await pool.query("SELECT count(*)::int AS n FROM user_role WHERE user_id=$1", [foreign.id])).rows[0].n, 0);
});
