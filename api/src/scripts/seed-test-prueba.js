import "dotenv/config";
import { closePool, getPool } from "../db/pool.js";
import { migrate } from "../db/migrate.js";
import { releaseResults } from "../modules/results/results-service.js";

const EVENT_NAME = "test_prueba";

async function getOrCreateEvent(client) {
  const { rows: existing } = await client.query(
    "SELECT id FROM carnival_event WHERE name = $1",
    [EVENT_NAME],
  );
  if (existing[0]) return { id: existing[0].id, created: false };

  const { rows: [event] } = await client.query(
    "INSERT INTO carnival_event(name, status) VALUES($1, 'CONFIGURING') RETURNING id",
    [EVENT_NAME],
  );
  return { id: event.id, created: true };
}

async function seedTestCompetition() {
  await migrate();
  const pool = getPool();
  const client = await pool.connect();

  try {
    await client.query("BEGIN");
    const event = await getOrCreateEvent(client);
    if (!event.created) {
      await client.query("ROLLBACK");
      console.log(JSON.stringify({
        eventName: EVENT_NAME,
        eventId: event.id,
        created: false,
        note: "La competencia ya existe; no se duplicaron datos.",
      }, null, 2));
      return;
    }

    const { rows: [admin] } = await client.query(
      "SELECT u.id, u.email FROM \"user\" u JOIN user_role ur ON ur.user_id = u.id WHERE ur.role_code = 'ADMIN' ORDER BY u.id LIMIT 1",
    );
    const { rows: judges } = await client.query(
      `SELECT jp.id AS "profileId", jp.user_id AS "userId", jp.name, u.email
       FROM judge_profile jp
       JOIN "user" u ON u.id = jp.user_id
       WHERE jp.registration_status = 'REGISTERED'
       ORDER BY jp.created_at
       LIMIT 2`,
    );
    if (!admin || judges.length < 2) {
      throw new Error("Se necesita un ADMIN y al menos dos jurados REGISTERED para crear el fixture.");
    }

    const { rows: [night] } = await client.query(
      `INSERT INTO night(event_id, name, display_order, event_date, kind, status)
       VALUES($1, 'Noche de prueba', 1, CURRENT_DATE, 'COMPETITION', 'OPEN')
       ON CONFLICT (event_id, display_order) DO UPDATE SET name = EXCLUDED.name
       RETURNING id`,
      [event.id],
    );
    const { rows: [specialty] } = await client.query(
      `INSERT INTO event_specialty(event_id, name, code, display_order)
       VALUES($1, 'Baile', 'BAILE', 1)
       ON CONFLICT (event_id, code) DO UPDATE SET name = EXCLUDED.name
       RETURNING id`,
      [event.id],
    );
    const { rows: [category] } = await client.query(
      `INSERT INTO event_category(event_id, name, code, display_order)
       VALUES($1, 'Primera', 'PRIMERA', 1)
       ON CONFLICT (event_id, code) DO UPDATE SET name = EXCLUDED.name
       RETURNING id`,
      [event.id],
    );

    const rubrics = [];
    for (const [name, code] of [["Coreografía", "TEST_COREOGRAFIA"], ["Diseño", "TEST_DISENO"]]) {
      const { rows: [rubric] } = await client.query(
        `INSERT INTO rubric(event_id, name, code, evaluation_target, rubric_kind)
         VALUES($1,$2,$3,'TROUPE','NOMINATIVE')
         ON CONFLICT (event_id, code) DO UPDATE SET name = EXCLUDED.name
         RETURNING id`,
        [event.id, name, code],
      );
      const { rows: [item] } = await client.query(
        `INSERT INTO evaluation_item(event_id, rubric_id, specialty_id, name, code)
         VALUES($1,$2,$3,$4,$5)
         ON CONFLICT (rubric_id, code) DO UPDATE SET name = EXCLUDED.name
         RETURNING id`,
        [event.id, rubric.id, specialty.id, `${name} — ítem de prueba`, `${code}_ITEM`],
      );
      rubrics.push({ ...rubric, itemId: item.id });
    }

    const troupes = [];
    for (const name of ["Comparsa Test A", "Comparsa Test B"]) {
      const { rows: [troupe] } = await client.query(
        `INSERT INTO event_troupe(event_id, category_id, name)
         VALUES($1,$2,$3)
         RETURNING id, name`,
        [event.id, category.id, name],
      );
      troupes.push(troupe);
    }

    for (const troupe of troupes) {
      await client.query(
        `INSERT INTO night_troupe_schedule(event_id, night_id, event_troupe_id, presentation_order, status)
         VALUES($1,$2,$3,$4,'SCHEDULED')
         ON CONFLICT (night_id, event_troupe_id) DO UPDATE SET presentation_order = EXCLUDED.presentation_order
         RETURNING id`,
        [event.id, night.id, troupe.id, troupes.indexOf(troupe) + 1],
      );
    }

    await client.query(
      `INSERT INTO judge_quota(event_id, night_id, specialty_id, max_assignments)
       VALUES($1,$2,$3,2)
       ON CONFLICT (night_id, specialty_id) DO UPDATE SET max_assignments = GREATEST(judge_quota.max_assignments, 2)`,
      [event.id, night.id, specialty.id],
    );

    for (let index = 0; index < judges.length; index += 1) {
      const judge = judges[index];
      const { rows: [assignment] } = await client.query(
        `INSERT INTO judge_assignment(event_id, night_id, specialty_id, judge_profile_id, assignment_type)
         VALUES($1,$2,$3,$4,'PRIMARY')
         RETURNING id`,
        [event.id, night.id, specialty.id, judge.profileId],
      );
      const { rows: [ballot] } = await client.query(
        `INSERT INTO ballot(event_id, night_id, judge_assignment_id, judge_profile_id, specialty_id, status)
         VALUES($1,$2,$3,$4,$5,'OPEN')
         RETURNING id`,
        [event.id, night.id, assignment.id, judge.profileId, specialty.id],
      );
      const troupe = troupes[index];
      const { rows: [schedule] } = await client.query(
        "SELECT id FROM night_troupe_schedule WHERE night_id = $1 AND event_troupe_id = $2",
        [night.id, troupe.id],
      );
      for (const rubric of rubrics) {
        await client.query(
          `INSERT INTO ballot_score(ballot_id,event_id,evaluation_item_id,rubric_id,night_schedule_id,score,evaluation_state,status)
           VALUES($1,$2,$3,$4,$5,8,'SCORED','DRAFT')`,
          [ballot.id, event.id, rubric.itemId, rubric.id, schedule.id],
        );
      }
      await client.query("UPDATE ballot SET status='SUBMITTED', submitted_at=CURRENT_TIMESTAMP WHERE id=$1", [ballot.id]);
      await client.query("UPDATE ballot_score SET status='LOCKED', locked_at=CURRENT_TIMESTAMP WHERE ballot_id=$1", [ballot.id]);
    }
    await client.query("SELECT set_config('app.allow_event_open','true',true)");
    await client.query("UPDATE carnival_event SET status='OPEN' WHERE id=$1", [event.id]);
    await client.query("COMMIT");

    const { rows: releases } = await pool.query(
      "SELECT event_id FROM results_release WHERE event_id = $1",
      [event.id],
    );
    if (releases.length === 0) {
      await releaseResults({ eventId: event.id, actorUserId: admin.id });
    }

    console.log(JSON.stringify({
      eventName: EVENT_NAME,
      eventId: event.id,
      created: event.created,
      adminEmail: admin.email,
      judgeEmail: judge.email,
      judgeName: judge.name,
      routes: {
        adminEvents: `http://localhost:5173/#/admin/events`,
        resultsApi: `/api/v1/events/${event.id}/results`,
        ceremonialDrawApi: `/api/v1/events/${event.id}/tie-breaker/ceremonial-draw`,
      },
      tiedTroupes: troupes,
      rubrics: rubrics.map(({ id, name, code }) => ({ id, name, code, kind: "NOMINATIVE" })),
      note: "El fixture deja dos comparsas empatadas en Mejor Comparsa y resultados liberados.",
    }, null, 2));
  } catch (error) {
    try { await client.query("ROLLBACK"); } catch { /* preserve original */ }
    throw error;
  } finally {
    client.release();
    await closePool();
  }
}

seedTestCompetition().catch((error) => {
  console.error(`No se pudo crear ${EVENT_NAME}:`, error.message);
  process.exitCode = 1;
});
