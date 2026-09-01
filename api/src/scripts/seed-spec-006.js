import "dotenv/config";
import { randomUUID } from "node:crypto";
import { closePool, getPool } from "../db/pool.js";
import { seedGoya2027 } from "../db/seeds/goya-2027.js";
import { openVoting } from "../modules/ballots/ballot-service.js";

async function main() {
  const pool = getPool();
  try {
    // Check if judge exists, else create one (need a proper user for UI login)
    // The user 'jurado.prueba.01@example.test' from tests is good if exists, otherwise admin user is fine just to exist in DB.
    let judgeUserId;
    const { rows: judgeUsers } = await pool.query("SELECT user_id FROM user_role WHERE role_code = 'JUDGE' LIMIT 1");
    if (judgeUsers.length > 0) {
      judgeUserId = judgeUsers[0].user_id;
    } else {
      console.log("No judge user found. We need a JUDGE role user.");
      return;
    }

    const { eventId } = await seedGoya2027();
    console.log(`Event ID: ${eventId}`);

    const client = await pool.connect();
    try {
      await client.query("BEGIN");

      const { rows: [night] } = await client.query("SELECT id FROM night WHERE event_id = $1 AND display_order = 1", [eventId]);
      const { rows: [specialty] } = await client.query("SELECT id FROM event_specialty WHERE event_id = $1 AND code = 'BAILE'", [eventId]);
      const { rows: [category] } = await client.query("SELECT id FROM event_category WHERE event_id = $1 AND code = 'PRIMERA'", [eventId]);

      let rubricId;
      const { rows: existingRubric } = await client.query("SELECT id FROM rubric WHERE event_id = $1 AND code = 'SPEC006'", [eventId]);
      if (existingRubric.length > 0) {
        rubricId = existingRubric[0].id;
      } else {
        const res = await client.query(
          "INSERT INTO rubric(event_id, name, code, evaluation_target) VALUES($1, $2, $3, $4) RETURNING id",
          [eventId, "Rubro Spec 006 (Lista Extensa)", "SPEC006", "TROUPE"]
        );
        rubricId = res.rows[0].id;
      }

      for (let i = 1; i <= 50; i++) {
        await client.query(
          "INSERT INTO evaluation_item(event_id, rubric_id, specialty_id, name, code) VALUES($1,$2,$3,$4,$5) ON CONFLICT(rubric_id, code) DO NOTHING",
          [eventId, rubricId, specialty.id, `Item Pendiente de Prueba ${i}`, `ITEM_P_${i}`]
        );
      }

      let troupeId;
      const { rows: existingTroupe } = await client.query("SELECT id FROM event_troupe WHERE event_id = $1 AND name = 'Comparsa Spec 006'", [eventId]);
      if (existingTroupe.length > 0) {
        troupeId = existingTroupe[0].id;
      } else {
        const res = await client.query(
          "INSERT INTO event_troupe(event_id, category_id, name) VALUES($1, $2, $3) RETURNING id",
          [eventId, category.id, "Comparsa Spec 006"]
        );
        troupeId = res.rows[0].id;

        await client.query(
          "INSERT INTO night_troupe_schedule(event_id, night_id, event_troupe_id, presentation_order, status) VALUES($1,$2,$3,$4,$5)",
          [eventId, night.id, troupeId, 99, "SCHEDULED"]
        );
      }

      const { rows: [adminUser] } = await client.query("SELECT user_id FROM user_role WHERE role_code = 'ADMIN' LIMIT 1");

      // Ensure Quota exists
      await client.query(
        "INSERT INTO judge_quota(event_id, night_id, specialty_id, max_assignments) VALUES($1,$2,$3,$4) ON CONFLICT(night_id, specialty_id) DO UPDATE SET max_assignments = judge_quota.max_assignments + 1",
        [eventId, night.id, specialty.id, 50]
      );

      let judgeProfileId;
      const { rows: existingJudge } = await client.query("SELECT id FROM judge_profile WHERE user_id = $1", [judgeUserId]);
      if (existingJudge.length > 0) {
        judgeProfileId = existingJudge[0].id;
        await client.query("UPDATE judge_profile SET registration_status = 'REGISTERED' WHERE id = $1", [judgeProfileId]);
      } else {
        const res = await client.query(
          "INSERT INTO judge_profile(name, email, document_number, registration_status, user_id, created_by) VALUES($1,$2,$3,$4,$5,$6) RETURNING id",
          ["Jurado Spec 006", `juez-spec006@test.com`, `SPEC006DOC`, "REGISTERED", judgeUserId, adminUser.user_id]
        );
        judgeProfileId = res.rows[0].id;
      }

      // Attempt to insert assignment if not assigned yet
      const { rows: existingAssignment } = await client.query("SELECT id FROM judge_assignment WHERE event_id = $1 AND night_id = $2 AND judge_profile_id = $3", [eventId, night.id, judgeProfileId]);
      if (existingAssignment.length === 0) {
          await client.query(
            "INSERT INTO judge_assignment(event_id, night_id, specialty_id, judge_profile_id, assignment_type) VALUES($1,$2,$3,$4,$5)",
            [eventId, night.id, specialty.id, judgeProfileId, "PRIMARY"]
          );
      }

      await client.query("SELECT set_config('app.allow_event_open','true',true)");
      await client.query("UPDATE carnival_event SET status = 'OPEN' WHERE id = $1", [eventId]);
      await client.query("UPDATE night SET status = 'OPEN' WHERE id = $1", [night.id]);

      await client.query("COMMIT");

      try {
        await openVoting({
          eventId,
          nightId: night.id,
          actorUserId: adminUser.user_id
        });
        console.log("Votación abierta y planillas creadas. Se generaron 50 ítems pendientes.");
      } catch (err) {
        if (err.code === "VOTING_ALREADY_OPEN") {
          console.log("La votación ya estaba abierta. Planillas existentes.");
        } else {
          throw err;
        }
      }

      console.log("Seed completado exitosamente.");
    } catch (e) {
      await client.query("ROLLBACK");
      throw e;
    } finally {
      client.release();
    }
  } catch (error) {
    console.error(error);
  } finally {
    await closePool();
  }
}

main();
