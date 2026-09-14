import pg from "pg";
import { createCredentialUser, createOrVerifyCredentialUser, revokeUserSessions, setCredentialPassword } from "../../auth/account-service.js";
import { grantRole } from "../../auth/role-service.js";
import { getPool } from "../pool.js";
import { createJudge, reissueInvitation, acceptInvitation } from "../../modules/judges/judge-service.js";
import {
  acceptOperationalInvitation, createOperationalProfile, reissueOperationalInvitation,
} from "../../modules/operational-profiles/operational-profile-service.js";

export function getSeedPassword(environment = process.env) {
  if (!["development", "test"].includes(environment.NODE_ENV)) {
    throw new Error("DEMO_USERS_SEED_REQUIRES_DEVELOPMENT_OR_TEST");
  }
  const password = environment.SEED_DEMO_PASSWORD ?? environment.SEED_ADMIN_PASSWORD;
  if (typeof password !== "string" || password.length < 8 || password.length > 128) {
    throw new Error("SEED_DEMO_PASSWORD_REQUIRED: configurar una contraseña de 8 a 128 caracteres.");
  }
  return { password };
}

export function getFullEventSeedConfig(environment = process.env) {
  const { password } = getSeedPassword(environment);
  const email = environment.SEED_ADMIN_EMAIL?.trim().toLowerCase();
  const name = environment.SEED_ADMIN_NAME?.trim();
  if (!email || !/^[^\s@,<>]+@[^\s@,<>]+\.[^\s@,<>]+$/.test(email) || !name) {
    throw new Error("SEED_ADMIN_EMAIL_AND_NAME_REQUIRED");
  }
  return { nodeEnv: environment.NODE_ENV, email, name, password };
}

async function findUser(email) {
  const { rows } = await getPool().query(
    `SELECT u.id, u.email, COALESCE((SELECT array_agg(role_code ORDER BY role_code)
      FROM user_role WHERE user_id=u.id), '{}') AS roles FROM "user" u WHERE lower(email)=$1`, [email],
  );
  return rows[0];
}

function requireRole(user, role) {
  if (!user || user.roles.length !== 1 || user.roles[0] !== role) throw new Error("DEMO_USER_ROLE_CONFLICT");
}

// Only called after verifying the fixture identity, profile and exclusive role.
async function syncPassword(user, entry, password) {
  try {
    await createOrVerifyCredentialUser({ ...entry, password });
  } catch (error) {
    if (error.message !== "ACCOUNT_ALREADY_EXISTS") throw error;
    await setCredentialPassword({ userId: user.id, password });
  }
  // Also run on replay: a previous run may have persisted the new password
  // but failed to revoke sessions. Revoke after writing the credential.
  await revokeUserSessions(user.id);
}

async function inspectProfile(entry, role) {
  const table = role === "JUDGE" ? "judge_profile" : "operational_profile";
  const { rows } = await getPool().query(
    `SELECT * FROM ${table} WHERE lower(email)=$1 OR document_number=$2`, [entry.email, entry.documentNumber],
  );
  const user = await findUser(entry.email);
  const profile = rows[0];
  if (rows.length > 1 || (profile && (profile.email.toLowerCase() !== entry.email
    || profile.document_number !== entry.documentNumber)) || (!profile && user)) {
    throw new Error("DEMO_PROFILE_IDENTITY_CONFLICT");
  }
  if (profile?.registration_status === "SUSPENDED") throw new Error("DEMO_PROFILE_SUSPENDED");
  if (profile && role !== "JUDGE") {
    const { rows: roles } = await getPool().query(
      "SELECT role_code FROM operational_profile_role WHERE operational_profile_id=$1", [profile.id],
    );
    if (roles.length !== 1 || roles[0].role_code !== role) throw new Error("DEMO_USER_ROLE_CONFLICT");
  }
  if (profile?.registration_status === "REGISTERED") {
    if (!user || profile.user_id !== user.id) throw new Error("DEMO_PROFILE_IDENTITY_CONFLICT");
    requireRole(user, role);
  } else if (user && user.roles.length > 0) {
    throw new Error("DEMO_USER_ROLE_CONFLICT");
  }
  return { profile, user };
}

async function ensureProfile(entry, role, actorUserId, password) {
  const { profile, user } = await inspectProfile(entry, role);
  if (profile?.registration_status === "REGISTERED") {
    await syncPassword(user, entry, password);
    return { email: entry.email, userId: user.id, profileId: profile.id, created: false };
  }
  let secret;
  const sendInvitation = async (invitation) => { secret = invitation.secret; };
  const input = { ...entry, actorUserId, sendInvitation };
  if (role === "JUDGE") {
    if (profile) await reissueInvitation({ ...input, judgeProfileId: profile.id });
    else await createJudge(input);
    await acceptInvitation({ secret, password });
  } else {
    if (profile) await reissueOperationalInvitation({ ...input, operationalProfileId: profile.id });
    else await createOperationalProfile({ ...input, roleCodes: [role] });
    await acceptOperationalInvitation({ secret, password });
  }
  const registered = await inspectProfile(entry, role);
  return { email: entry.email, userId: registered.user.id, profileId: registered.profile.id, created: !user };
}

export async function seedFixtureUsers({ judges: judgeEntries, auxiliaries }) {
  const config = getFullEventSeedConfig();
  const entries = [...judgeEntries, ...auxiliaries];
  if (entries.some((entry) => entry.email === config.email)
    || new Set(entries.map((entry) => entry.email)).size !== entries.length
    || auxiliaries.some((entry) => !["ESCRIBANO", "VEEDOR"].includes(entry.role))) {
    throw new Error("DEMO_FIXTURE_USERS_INVALID");
  }
  // A dedicated connection keeps the service pool available even with max=1.
  const lock = new pg.Client({ connectionString: process.env.DATABASE_URL, connectionTimeoutMillis: 3000 });
  await lock.connect();
  try {
    await lock.query("SELECT pg_advisory_lock(hashtext('carnavales2027_demo_users_seed'))");
    // Validate all pre-existing identities before resetting any credential.
    for (const entry of judgeEntries) await inspectProfile(entry, "JUDGE");
    for (const entry of auxiliaries) await inspectProfile(entry, entry.role);
    let adminUser = await findUser(config.email);
    const adminCreated = !adminUser;
    if (adminUser) {
      if (adminUser.roles.length === 0) {
        // Reconcile an interrupted bootstrap only after proof of the configured
        // credential, as in invitation acceptance. Never reset an unclaimed user.
        await createOrVerifyCredentialUser(config);
        await grantRole({ userId: adminUser.id, roleCode: "ADMIN" });
        adminUser = await findUser(config.email);
      }
      requireRole(adminUser, "ADMIN");
      await syncPassword(adminUser, config, config.password);
    } else {
      adminUser = await createCredentialUser(config);
      await grantRole({ userId: adminUser.id, roleCode: "ADMIN" });
    }
    const judges = [];
    for (const entry of judgeEntries) judges.push(await ensureProfile(entry, "JUDGE", adminUser.id, config.password));
    const operational = [];
    for (const entry of auxiliaries) operational.push({ ...await ensureProfile(entry, entry.role, adminUser.id, config.password), role: entry.role });
    return { admin: { email: adminUser.email, userId: adminUser.id, created: adminCreated }, judges, auxiliaries: operational };
  } finally {
    // Closing also releases the session-level advisory lock on failure.
    await lock.end();
  }
}
