// ⚠️  AVISO (2026-09-07, revisión de Fase 0 de PLAN-maestro.md):
//
// Este script inserta `night`, `judge_assignment`, `ballot` y `voting_window`
// directamente por SQL con estado 'OPEN', sin pasar por
// `event-readiness.service.js` ni por `openVoting()` de `ballot-service.js`.
// El evento (`carnival_event`) queda en 'CONFIGURING' mientras la noche que
// crea queda 'OPEN': un estado que el trigger `require_night_change()`
// (migración 029) permite en el INSERT inicial porque solo valida el estado
// del evento, no el de la noche recién creada, pero que ningún flujo de la
// aplicación (admin UI, `openEvent`, `openVoting`) puede producir por sí
// mismo. Otro código que asuma "si hay una noche OPEN, el evento está OPEN"
// puede comportarse de forma no probada sobre los datos que este script crea.
//
// Si necesitás una planilla lista para votar con datos reproducibles,
// `npm run db:seed:goya` + `node src/scripts/seed-spec-006.js` sigue el
// flujo real (`openEvent` → `openVoting`) y no bypassea estas guardas.
//
// No se eliminó este archivo porque no tiene seguimiento en git y puede ser
// trabajo manual en curso; documentado para que quien lo use sepa qué
// invariante está evitando antes de decidir si lo conserva.
import "dotenv/config";
import { closePool, getPool } from "../db/pool.js";

async function seedEvent() {
  const pool = getPool();
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    // Existing admin
    const { rows: [admin] } = await client.query(
      `SELECT u.id, u.email FROM "user" u
       JOIN user_role ur ON ur.user_id = u.id
       WHERE ur.role_code = 'ADMIN' LIMIT 1`
    );
    if (!admin) throw new Error("No hay ADMIN registrado");

    // Existing judge
    const { rows: [judge] } = await client.query(
      `SELECT u.id, u.email, jp.id AS "profileId"
       FROM "user" u
       JOIN judge_profile jp ON jp.user_id = u.id
       WHERE jp.registration_status = 'REGISTERED' LIMIT 1`
    );
    if (!judge) throw new Error("No hay JUDGE registrado");

    // Event
    const { rows: existingEvent } = await client.query(
      "SELECT id FROM carnival_event WHERE name = $1", ["Carnaval Prueba 2027"]
    );
    let event;
    if (existingEvent[0]) {
      event = existingEvent[0];
    } else {
      const { rows: [e] } = await client.query(
        `INSERT INTO carnival_event(name, status) VALUES('Carnaval Prueba 2027', 'CONFIGURING') RETURNING id`
      );
      event = e;
    }

    // Night
    const { rows: existingNight } = await client.query(
      "SELECT id FROM night WHERE event_id = $1 AND display_order = 1", [event.id]
    );
    let night;
    if (existingNight[0]) {
      night = existingNight[0];
    } else {
      const { rows: [n] } = await client.query(
        `INSERT INTO night(event_id, name, display_order, event_date, kind, status)
         VALUES($1, 'Noche de Competencia', 1, CURRENT_DATE, 'COMPETITION', 'OPEN') RETURNING id`,
        [event.id]
      );
      night = n;
    }

    // Specialty
    const { rows: existingSpec } = await client.query(
      "SELECT id FROM event_specialty WHERE event_id = $1 AND code = 'BAILE'", [event.id]
    );
    let specialty;
    if (existingSpec[0]) {
      specialty = existingSpec[0];
    } else {
      const { rows: [s] } = await client.query(
        `INSERT INTO event_specialty(event_id, name, code, display_order)
         VALUES($1, 'Baile', 'BAILE', 1) RETURNING id`,
        [event.id]
      );
      specialty = s;
    }

    // Category
    const { rows: existingCat } = await client.query(
      "SELECT id FROM event_category WHERE event_id = $1 AND code = 'PRIMERA'", [event.id]
    );
    let category;
    if (existingCat[0]) {
      category = existingCat[0];
    } else {
      const { rows: [c] } = await client.query(
        `INSERT INTO event_category(event_id, name, code, display_order)
         VALUES($1, 'Primera', 'PRIMERA', 1) RETURNING id`,
        [event.id]
      );
      category = c;
    }

    // Rubrics + Items
    const rubrics = [];
    for (const [name, code] of [
      ["Coreografía", "COREOGRAFIA"],
      ["Vestuario", "VESTUARIO"],
      ["Música", "MUSICA"],
    ]) {
      const { rows: existingRub } = await client.query(
        "SELECT id FROM rubric WHERE event_id = $1 AND code = $2", [event.id, code]
      );
      let rubric;
      if (existingRub[0]) {
        rubric = existingRub[0];
        const { rows: [existingItem] } = await client.query(
          "SELECT id, name FROM evaluation_item WHERE rubric_id = $1 AND code = $2",
          [rubric.id, `${code}_ITEM`]
        );
        rubrics.push({ id: rubric.id, name, itemId: existingItem?.id, itemName: existingItem?.name });
      } else {
        const { rows: [r] } = await client.query(
          `INSERT INTO rubric(event_id, name, code, evaluation_target, rubric_type)
           VALUES($1, $2, $3, 'TROUPE', 'NOMINATIVE') RETURNING id`,
          [event.id, name, code]
        );
        rubric = r;
        const { rows: [item] } = await client.query(
          `INSERT INTO evaluation_item(event_id, rubric_id, specialty_id, name, code)
           VALUES($1, $2, $3, $4, $5) RETURNING id, name`,
          [event.id, rubric.id, specialty.id, `${name} — Evaluación`, `${code}_ITEM`]
        );
        rubrics.push({ id: rubric.id, name, itemId: item.id, itemName: item.name });
      }
    }

    // Troupes
    const troupes = [];
    for (const name of ["Comparsa Sol", "Comparsa Luna", "Comparsa Estrella"]) {
      const { rows: existingT } = await client.query(
        "SELECT id FROM event_troupe WHERE event_id = $1 AND name = $2", [event.id, name]
      );
      if (existingT[0]) {
        troupes.push(existingT[0]);
      } else {
        const { rows: [t] } = await client.query(
          `INSERT INTO event_troupe(event_id, category_id, name)
           VALUES($1, $2, $3) RETURNING id`,
          [event.id, category.id, name]
        );
        troupes.push(t);
      }
    }

    // Night schedule
    for (let i = 0; i < troupes.length; i++) {
      const { rows: existingS } = await client.query(
        "SELECT id FROM night_troupe_schedule WHERE night_id = $1 AND event_troupe_id = $2",
        [night.id, troupes[i].id]
      );
      if (!existingS[0]) {
        await client.query(
          `INSERT INTO night_troupe_schedule(event_id, night_id, event_troupe_id, presentation_order, status)
           VALUES($1, $2, $3, $4, 'SCHEDULED')`,
          [event.id, night.id, troupes[i].id, i + 1]
        );
      }
    }

    // Judge quota
    const { rows: existingQ } = await client.query(
      "SELECT id FROM judge_quota WHERE night_id = $1 AND specialty_id = $2",
      [night.id, specialty.id]
    );
    if (!existingQ[0]) {
      await client.query(
        `INSERT INTO judge_quota(event_id, night_id, specialty_id, max_assignments)
         VALUES($1, $2, $3, 4)`,
        [event.id, night.id, specialty.id]
      );
    }

    // Judge assignment
    const { rows: existingA } = await client.query(
      `SELECT id FROM judge_assignment WHERE judge_profile_id = $1 AND night_id = $2 AND status = 'ACTIVE'`,
      [judge.profileId, night.id]
    );
    let assignment;
    if (existingA[0]) {
      assignment = existingA[0];
    } else {
      const { rows: [a] } = await client.query(
        `INSERT INTO judge_assignment(event_id, night_id, specialty_id, judge_profile_id, assignment_type)
         VALUES($1, $2, $3, $4, 'PRIMARY') RETURNING id`,
        [event.id, night.id, specialty.id, judge.profileId]
      );
      assignment = a;
    }

    // Ballot
    const { rows: existingB } = await client.query(
      `SELECT id FROM ballot WHERE judge_profile_id = $1 AND night_id = $2 AND status <> 'REPLACED'`,
      [judge.profileId, night.id]
    );
    let ballot;
    if (existingB[0]) {
      ballot = existingB[0];
    } else {
      const { rows: [b] } = await client.query(
        `INSERT INTO ballot(event_id, night_id, judge_assignment_id, judge_profile_id, specialty_id, status)
         VALUES($1, $2, $3, $4, $5, 'OPEN') RETURNING id`,
        [event.id, night.id, assignment.id, judge.profileId, specialty.id]
      );
      ballot = b;
    }

    // Ballot scores
    for (const troupe of troupes) {
      const { rows: [schedule] } = await client.query(
        "SELECT id FROM night_troupe_schedule WHERE night_id = $1 AND event_troupe_id = $2",
        [night.id, troupe.id]
      );
      for (const rubric of rubrics) {
        const { rows: existingBS } = await client.query(
          "SELECT id FROM ballot_score WHERE ballot_id = $1 AND evaluation_item_id = $2 AND night_schedule_id = $3",
          [ballot.id, rubric.itemId, schedule.id]
        );
        if (!existingBS[0]) {
          await client.query(
            `INSERT INTO ballot_score(ballot_id, event_id, evaluation_item_id, rubric_id, night_schedule_id, evaluation_state, status)
             VALUES($1, $2, $3, $4, $5, 'PENDING', 'DRAFT')`,
            [ballot.id, event.id, rubric.itemId, rubric.id, schedule.id]
          );
        }
      }
    }

    // Voting window
    const { rows: existingVW } = await client.query(
      "SELECT night_id FROM voting_window WHERE night_id = $1", [night.id]
    );
    if (!existingVW[0]) {
      await client.query(
        `INSERT INTO voting_window(night_id, event_id, status) VALUES($1, $2, 'OPEN')`,
        [night.id, event.id]
      );
    }

    await client.query("COMMIT");

    console.log(JSON.stringify({
      event: { id: event.id, name: "Carnaval Prueba 2027" },
      night: { id: night.id, name: "Noche de Competencia" },
      specialty: { id: specialty.id, name: "Baile" },
      category: { id: category.id, name: "Primera" },
      rubrics: rubrics.map(r => ({ id: r.id, name: r.name, itemId: r.itemId, itemName: r.itemName })),
      troupes: troupes.map(t => ({ id: t.id, name: t.name })),
      ballot: { id: ballot.id, status: "OPEN" },
      judge: { email: judge.email, profileId: judge.profileId },
      admin: { email: admin.email },
    }, null, 2));
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
    await closePool();
  }
}

seedEvent().catch((error) => {
  console.error("Error:", error.message);
  process.exitCode = 1;
});
