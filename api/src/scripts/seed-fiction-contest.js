import "dotenv/config";
import { randomUUID } from "node:crypto";
import { closePool, getPool } from "../db/pool.js";
import { migrate } from "../db/migrate.js";
import { getAdminCredentialHash, syncCredentialHash } from "./credential-seed-helpers.js";

const EVENT_NAME = "Concurso de Ficción - Prueba Jurado";
const SEED_KEY = "fiction-contest-jurado";
const DEMO_JUDGE_EMAILS = [
  "jurado.alpha@carnaval.local",
  "jurado.beta@carnaval.local",
];

async function repairFictionCredentials(client, adminUserId) {
  const adminPasswordHash = await getAdminCredentialHash(client, adminUserId);
  const { rows: adminTwoFactor } = await client.query(
    `SELECT secret, "backupCodes" FROM "twoFactor" WHERE "userId" = $1 LIMIT 1`,
    [adminUserId],
  );
  if (adminTwoFactor.length === 0) {
    throw new Error("ADMIN_TWO_FACTOR_CONFIGURATION_INVALID: ejecutá primero npm run db:seed.");
  }

  for (const email of DEMO_JUDGE_EMAILS) {
    const { rows } = await client.query('SELECT id FROM "user" WHERE email = $1', [email]);
    if (!rows[0]) continue;

    const userId = rows[0].id;
    await syncCredentialHash(client, userId, adminPasswordHash);
    await client.query('UPDATE "user" SET "twoFactorEnabled" = true WHERE id = $1', [userId]);
    await client.query(
      `INSERT INTO "twoFactor" (id, secret, "backupCodes", "userId", verified)
       SELECT $1, secret, "backupCodes", $2, true
         FROM "twoFactor"
        WHERE "userId" = $3
          AND NOT EXISTS (SELECT 1 FROM "twoFactor" WHERE "userId" = $2)`,
      [randomUUID().replace(/-/g, "").substring(0, 32), userId, adminUserId],
    );
  }
}

async function ensureJudgeUser(client, adminUserId, { name, email, documentNumber }) {
  const adminPasswordHash = await getAdminCredentialHash(client, adminUserId);
  const { rows: existing } = await client.query(
    `SELECT u.id, u.email FROM "user" u WHERE u.email = $1`,
    [email],
  );

  let userId;
  if (existing.length > 0) {
    userId = existing[0].id;
  } else {
    userId = randomUUID();
    await client.query(
      `INSERT INTO "user"(id, name, email, "emailVerified", "twoFactorEnabled")
       VALUES ($1, $2, $3, true, true)`,
      [userId, name, email],
    );

    const { rows: adminTf } = await client.query(
      `SELECT secret, "backupCodes" FROM "twoFactor" WHERE "userId" = $1 LIMIT 1`,
      [adminUserId],
    );
    if (adminTf.length > 0) {
      const { rows: existingTf } = await client.query(
        `SELECT id FROM "twoFactor" WHERE "userId" = $1`,
        [userId],
      );
      if (existingTf.length === 0) {
        const tfId = randomUUID().replace(/-/g, "").substring(0, 32);
        await client.query(
          `INSERT INTO "twoFactor" (id, secret, "backupCodes", "userId", verified)
           VALUES ($1, $2, $3, $4, false)`,
          [tfId, adminTf[0].secret, adminTf[0].backupCodes, userId],
        );
      }
    }

    await client.query(
      `UPDATE account SET "accountId" = "userId" WHERE "userId" = $1 AND "providerId" = 'credential'`,
      [userId],
    );
  }

  await syncCredentialHash(client, userId, adminPasswordHash);

  await client.query(
    `INSERT INTO user_role(user_id, role_code)
     VALUES ($1, 'JUDGE')
     ON CONFLICT (user_id, role_code) DO NOTHING`,
    [userId],
  );

  const { rows: existingProfile } = await client.query(
    `SELECT id FROM judge_profile WHERE email = $1`,
    [email],
  );

  let profileId;
  if (existingProfile.length > 0) {
    profileId = existingProfile[0].id;
    await client.query(
      `UPDATE judge_profile SET user_id = $2, registration_status = 'REGISTERED', name = $3
       WHERE id = $1 AND registration_status != 'REGISTERED'`,
      [profileId, userId, name],
    );
  } else {
    const { rows: [profile] } = await client.query(
      `INSERT INTO judge_profile(name, email, document_number, user_id, registration_status, created_by)
       VALUES ($1, $2, $3, $4, 'REGISTERED', $5)
       RETURNING id`,
      [name, email, documentNumber, userId, adminUserId],
    );
    profileId = profile.id;
  }

  return { userId, profileId, email };
}

async function seedFictionContest() {
  await migrate();
  const pool = getPool();
  const client = await pool.connect();

  try {
    const { rows: [admin] } = await client.query(
      `SELECT u.id, u.email
       FROM "user" u
       JOIN user_role ur ON ur.user_id = u.id
       JOIN account a ON a."userId" = u.id
       WHERE ur.role_code = 'ADMIN'
         AND a."providerId" = 'credential'
         AND a.password IS NOT NULL
         AND position(':' IN a.password) > 0
       ORDER BY u.id LIMIT 1`,
    );
    if (!admin) {
      throw new Error("Se requiere al menos un usuario con rol ADMIN registrado.");
    }

    const { rows: existingSeed } = await client.query(
      `SELECT event_id AS "eventId" FROM configuration_seed WHERE seed_key = $1`,
      [SEED_KEY],
    );
    if (existingSeed.length > 0) {
      await repairFictionCredentials(client, admin.id);
      console.log(JSON.stringify({
        status: "ALREADY_EXISTS",
        eventName: EVENT_NAME,
        eventId: existingSeed[0].eventId,
        message: "El concurso de ficción ya existe.",
      }, null, 2));
      return;
    }

    const { rows: existingEvent } = await client.query(
      `SELECT id, name, status FROM carnival_event WHERE name = $1`,
      [EVENT_NAME],
    );
    if (existingEvent.length > 0) {
      await repairFictionCredentials(client, admin.id);
      console.log(JSON.stringify({
        status: "ALREADY_EXISTS",
        eventName: EVENT_NAME,
        eventId: existingEvent[0].id,
        message: "El concurso de ficción ya existe.",
      }, null, 2));
      return;
    }

    await client.query("BEGIN");

    const { rows: [event] } = await client.query(
      `INSERT INTO carnival_event(name, status)
       VALUES ($1, 'CONFIGURING')
       RETURNING id`,
      [EVENT_NAME],
    );

    await client.query(
      `INSERT INTO configuration_seed(seed_key, event_id) VALUES ($1, $2)`,
      [SEED_KEY, event.id],
    );

    const { rows: [night] } = await client.query(
      `INSERT INTO night(event_id, name, display_order, event_date, kind, status)
       VALUES ($1, 'Noche Final', 1, CURRENT_DATE, 'COMPETITION', 'OPEN')
       RETURNING id`,
      [event.id],
    );

    const { rows: [specialty] } = await client.query(
      `INSERT INTO event_specialty(event_id, name, code, display_order)
       VALUES ($1, 'Baile y Coreografía', 'BAILE', 1)
       RETURNING id`,
      [event.id],
    );

    const { rows: [category] } = await client.query(
      `INSERT INTO event_category(event_id, name, code, display_order)
       VALUES ($1, 'Primera Categoría', 'PRIMERA', 1)
       RETURNING id`,
      [event.id],
    );

    const troupeNames = ["Comparsa Alpha", "Comparsa Beta"];
    const troupes = [];
    for (const name of troupeNames) {
      const { rows: [troupe] } = await client.query(
        `INSERT INTO event_troupe(event_id, category_id, name)
         VALUES ($1, $2, $3)
         RETURNING id, name`,
        [event.id, category.id, name],
      );
      troupes.push(troupe);
    }

    for (let i = 0; i < troupes.length; i++) {
      await client.query(
        `INSERT INTO night_troupe_schedule(event_id, night_id, event_troupe_id, presentation_order, status)
         VALUES ($1, $2, $3, $4, 'SCHEDULED')`,
        [event.id, night.id, troupes[i].id, i + 1],
      );
    }

    const { rows: [rubric] } = await client.query(
      `INSERT INTO rubric(event_id, name, code, evaluation_target, rubric_kind)
       VALUES ($1, 'Coreografía y Danza', 'COREO', 'TROUPE', 'NOMINATIVE')
       RETURNING id`,
      [event.id],
    );

    const { rows: [evalItem] } = await client.query(
      `INSERT INTO evaluation_item(event_id, rubric_id, specialty_id, name, code)
       VALUES ($1, $2, $3, 'Sincronización y Ritmo', 'COREO_SYNC')
       RETURNING id`,
      [event.id, rubric.id, specialty.id],
    );

    const { rows: [rubric2] } = await client.query(
      `INSERT INTO rubric(event_id, name, code, evaluation_target, rubric_kind)
       VALUES ($1, 'Vestuario y Diseño', 'VESTUARIO', 'TROUPE', 'NOMINATIVE')
       RETURNING id`,
      [event.id],
    );

    const { rows: [evalItem2] } = await client.query(
      `INSERT INTO evaluation_item(event_id, rubric_id, specialty_id, name, code)
       VALUES ($1, $2, $3, 'Creatividad y Coherencia', 'VEST_ITEM')
       RETURNING id`,
      [event.id, rubric2.id, specialty.id],
    );

    const judgesData = [
      { name: "Jurado Demo Alpha", email: "jurado.alpha@carnaval.local", documentNumber: "30000001" },
      { name: "Jurado Demo Beta", email: "jurado.beta@carnaval.local", documentNumber: "30000002" },
    ];

    const judges = [];
    for (const jd of judgesData) {
      const judge = await ensureJudgeUser(client, admin.id, jd);
      judges.push(judge);
    }

    await client.query(
      `INSERT INTO judge_quota(event_id, night_id, specialty_id, max_assignments)
       VALUES ($1, $2, $3, 2)`,
      [event.id, night.id, specialty.id],
    );

    const assignments = [];
    for (const judge of judges) {
      const { rows: [assignment] } = await client.query(
        `INSERT INTO judge_assignment(event_id, night_id, specialty_id, judge_profile_id, assignment_type)
         VALUES ($1, $2, $3, $4, 'PRIMARY')
         RETURNING id`,
        [event.id, night.id, specialty.id, judge.profileId],
      );
      assignments.push({ ...assignment, judgeProfileId: judge.profileId });
    }

    await client.query("SELECT set_config('app.allow_event_open', 'true', true)");
    await client.query("UPDATE carnival_event SET status = 'OPEN' WHERE id = $1", [event.id]);

    await client.query(
      `INSERT INTO voting_window(night_id, event_id, status)
       VALUES ($1, $2, 'OPEN')`,
      [night.id, event.id],
    );

    const ballots = [];
    for (const assignment of assignments) {
      const { rows: [ballot] } = await client.query(
        `INSERT INTO ballot(event_id, night_id, judge_assignment_id, judge_profile_id, specialty_id, status)
         VALUES ($1, $2, $3, $4, $5, 'OPEN')
         RETURNING id`,
        [event.id, night.id, assignment.id, assignment.judgeProfileId, specialty.id],
      );

      const { rows: items } = await client.query(
        `SELECT ei.id AS "itemId", ei.rubric_id AS "rubricId"
         FROM evaluation_item ei
         WHERE ei.event_id = $1 AND ei.specialty_id = $2 AND ei.active = true`,
        [event.id, specialty.id],
      );

      const { rows: schedules } = await client.query(
        `SELECT id AS "scheduleId"
         FROM night_troupe_schedule
         WHERE event_id = $1 AND night_id = $2 AND status = 'SCHEDULED'`,
        [event.id, night.id],
      );

      for (const schedule of schedules) {
        for (const item of items) {
          await client.query(
            `INSERT INTO ballot_score(ballot_id, event_id, evaluation_item_id, rubric_id, night_schedule_id)
             VALUES ($1, $2, $3, $4, $5)
             ON CONFLICT (ballot_id, evaluation_item_id, night_schedule_id) DO NOTHING`,
            [ballot.id, event.id, item.itemId, item.rubricId, schedule.scheduleId],
          );
        }
      }

      ballots.push({ id: ballot.id, judgeProfileId: assignment.judgeProfileId });
    }

    await client.query("COMMIT");

    const judgeCredentials = judges.map((j) => ({
      name: j.name,
      email: j.email,
      profileId: j.profileId,
      userId: j.userId,
      password: "misma contraseña del admin",
    }));

    console.log(JSON.stringify({
      status: "SUCCESS",
      eventName: EVENT_NAME,
      eventId: event.id,
      nightId: night.id,
      message: "Concurso de ficción creado. Los jurados pueden votar inmediatamente.",
      credentials: {
        adminUser: admin.email,
        judges: judgeCredentials,
        note: "La contraseña de los jurados es la misma que la del administrador.",
      },
      contest: {
        night: "Noche Final",
        specialty: "Baile y Coreografía",
        category: "Primera Categoría",
        troupes: troupes.map((t) => t.name),
        rubrics: ["Coreografía y Danza", "Vestuario y Diseño"],
        items: ["Sincronización y Ritmo", "Creatividad y Coherencia"],
      },
      urls: {
        judgeHome: "http://localhost:5173/#/judge",
        adminVoting: "http://localhost:5173/#/admin/voting",
        adminAssignments: "http://localhost:5173/#/admin/assignments",
      },
    }, null, 2));

  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    throw error;
  } finally {
    client.release();
    await closePool();
  }
}

seedFictionContest().catch((error) => {
  console.error("Error al crear el concurso de ficción:", error);
  process.exitCode = 1;
});
