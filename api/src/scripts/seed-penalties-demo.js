import "dotenv/config";
import { randomUUID } from "node:crypto";
import { closePool, getPool } from "../db/pool.js";
import { migrate } from "../db/migrate.js";
import { createTroupePenalty, revokeTroupePenalty } from "../modules/penalties/penalty-service.js";

const EVENT_NAME = "Competencia Oficial de Prueba - Goya 2027";

async function ensureComisarioUser(client, adminUserId) {
  const email = "demo.comisario@carnaval.local";
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
       VALUES ($1, 'Comisario Demo Goya', $2, true, true)`,
      [userId, email],
    );

    // Copiar hash de contraseña del admin para que use la misma clave de desarrollo
    const { rows: adminAccount } = await client.query(
      `SELECT password FROM account WHERE "userId" = $1 AND password IS NOT NULL LIMIT 1`,
      [adminUserId],
    );
    const password = adminAccount[0]?.password ?? "$2b$10$demoHashedPasswordFallback";

    await client.query(
      `INSERT INTO account(id, "userId", "accountId", "providerId", password, "createdAt", "updatedAt")
       VALUES ($1, $2, $2, 'credential', $3, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
      [randomUUID(), userId, password],
    );
  }

  // Asegurar registro de twoFactor requerido por Better Auth
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

  // Asegurar que accountId coincida con userId
  await client.query(
    `UPDATE account SET "accountId" = "userId" WHERE "userId" = $1 AND "providerId" = 'credential'`,
    [userId],
  );

  await client.query(
    `INSERT INTO user_role(user_id, role_code)
     VALUES ($1, 'COMISARIO')
     ON CONFLICT (user_id, role_code) DO NOTHING`,
    [userId],
  );

  return { userId, email };
}

async function seedPenaltiesDemo() {
  await migrate();
  const pool = getPool();
  const client = await pool.connect();

  try {
    // 1. Obtener usuario administrador
    const { rows: [admin] } = await client.query(
      `SELECT u.id, u.email
       FROM "user" u
       JOIN user_role ur ON ur.user_id = u.id
       WHERE ur.role_code = 'ADMIN'
       ORDER BY u.id LIMIT 1`,
    );
    if (!admin) {
      throw new Error("Se requiere al menos un usuario con rol ADMIN registrado en la base de datos.");
    }

    // 2. Asegurar usuario comisario
    const comisario = await ensureComisarioUser(client, admin.id);

    // 3. Verificar si el evento ya existe
    const { rows: existingEvent } = await client.query(
      `SELECT id, name, status FROM carnival_event WHERE name = $1`,
      [EVENT_NAME],
    );

    if (existingEvent.length > 0) {
      const eventId = existingEvent[0].id;
      console.log(JSON.stringify({
        status: "ALREADY_EXISTS",
        eventName: EVENT_NAME,
        eventId,
        message: "La competencia de prueba de penalizaciones ya existe en la base de datos.",
        urls: {
          penalties: "http://localhost:5173/#/admin/penalties",
          results: "http://localhost:5173/#/admin/results",
        },
        comisarioUser: comisario.email,
        adminUser: admin.email,
      }, null, 2));
      return;
    }

    await client.query("BEGIN");

    // 4. Crear evento en configuración
    const { rows: [event] } = await client.query(
      `INSERT INTO carnival_event(name, status)
       VALUES ($1, 'CONFIGURING')
       RETURNING id`,
      [EVENT_NAME],
    );

    // 5. Crear dos noches de competencia
    const { rows: [night1] } = await client.query(
      `INSERT INTO night(event_id, name, display_order, event_date, kind, status)
       VALUES ($1, 'Noche 1 - Concurso Oficial', 1, CURRENT_DATE, 'COMPETITION', 'OPEN')
       RETURNING id`,
      [event.id],
    );
    const { rows: [night2] } = await client.query(
      `INSERT INTO night(event_id, name, display_order, event_date, kind, status)
       VALUES ($1, 'Noche 2 - Segunda Jornada', 2, CURRENT_DATE + 1, 'COMPETITION', 'OPEN')
       RETURNING id`,
      [event.id],
    );

    // 6. Especialidades
    const { rows: [specialtyBaile] } = await client.query(
      `INSERT INTO event_specialty(event_id, name, code, display_order)
       VALUES ($1, 'Baile y Coreografía', 'BAILE', 1)
       RETURNING id`,
      [event.id],
    );
    const { rows: [specialtyBateria] } = await client.query(
      `INSERT INTO event_specialty(event_id, name, code, display_order)
       VALUES ($1, 'Batería y Percusión', 'BATERIA', 2)
       RETURNING id`,
      [event.id],
    );

    // 7. Categoría y Comparsas
    const { rows: [category] } = await client.query(
      `INSERT INTO event_category(event_id, name, code, display_order)
       VALUES ($1, 'Comparsas Mayores', 'MAYORES', 1)
       RETURNING id`,
      [event.id],
    );

    const troupeNames = ["Ará Berá", "Porambá", "Itá Verá"];
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

    // 8. Programación en noche 1 y noche 2
    for (const night of [night1, night2]) {
      for (let i = 0; i < troupes.length; i++) {
        await client.query(
          `INSERT INTO night_troupe_schedule(event_id, night_id, event_troupe_id, presentation_order, status)
           VALUES ($1, $2, $3, $4, 'SCHEDULED')`,
          [event.id, night.id, troupes[i].id, i + 1],
        );
      }
    }

    // 9. Rubros e Ítems (todos nominativos para cómputo de Mejor Comparsa)
    const rubricsData = [
      { name: "Coreografía y Danza", code: "COREO", specialtyId: specialtyBaile.id, itemName: "Sincronización y Ritmo" },
      { name: "Batería", code: "BATERIA", specialtyId: specialtyBateria.id, itemName: "Cortes y Afinación" },
      { name: "Vestuario y Diseño", code: "VESTUARIO", specialtyId: specialtyBaile.id, itemName: "Creatividad y Coherencia" },
    ];

    const rubrics = [];
    for (const item of rubricsData) {
      const { rows: [rubric] } = await client.query(
        `INSERT INTO rubric(event_id, name, code, evaluation_target, rubric_kind)
         VALUES ($1, $2, $3, 'TROUPE', 'NOMINATIVE')
         RETURNING id, name, code`,
        [event.id, item.name, item.code],
      );
      const { rows: [evaluationItem] } = await client.query(
        `INSERT INTO evaluation_item(event_id, rubric_id, specialty_id, name, code)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING id`,
        [event.id, rubric.id, item.specialtyId, item.itemName, `${item.code}_ITEM`],
      );
      rubrics.push({ ...rubric, itemId: evaluationItem.id, specialtyId: item.specialtyId });
    }

    // 10. Asignación de jurados registrados
    const { rows: judges } = await client.query(
      `SELECT jp.id AS "profileId", jp.name, u.email
       FROM judge_profile jp
       JOIN "user" u ON u.id = jp.user_id
       WHERE jp.registration_status = 'REGISTERED'
       ORDER BY jp.created_at
       LIMIT 2`,
    );

    if (judges.length < 2) {
      throw new Error("Se requieren al menos 2 jurados registrados.");
    }

    // Cupos para jurados
    await client.query(
      `INSERT INTO judge_quota(event_id, night_id, specialty_id, max_assignments)
       VALUES ($1, $2, $3, 2), ($1, $2, $4, 2)`,
      [event.id, night1.id, specialtyBaile.id, specialtyBateria.id],
    );

    // Asignación de Jurado 1 (Baile) y Jurado 2 (Batería)
    const { rows: [assignment1] } = await client.query(
      `INSERT INTO judge_assignment(event_id, night_id, specialty_id, judge_profile_id, assignment_type)
       VALUES ($1, $2, $3, $4, 'PRIMARY') RETURNING id`,
      [event.id, night1.id, specialtyBaile.id, judges[0].profileId],
    );
    const { rows: [assignment2] } = await client.query(
      `INSERT INTO judge_assignment(event_id, night_id, specialty_id, judge_profile_id, assignment_type)
       VALUES ($1, $2, $3, $4, 'PRIMARY') RETURNING id`,
      [event.id, night1.id, specialtyBateria.id, judges[1].profileId],
    );

    // Planillas para ambos jurados
    const { rows: [ballot1] } = await client.query(
      `INSERT INTO ballot(event_id, night_id, judge_assignment_id, judge_profile_id, specialty_id, status)
       VALUES ($1, $2, $3, $4, $5, 'OPEN') RETURNING id`,
      [event.id, night1.id, assignment1.id, judges[0].profileId, specialtyBaile.id],
    );
    const { rows: [ballot2] } = await client.query(
      `INSERT INTO ballot(event_id, night_id, judge_assignment_id, judge_profile_id, specialty_id, status)
       VALUES ($1, $2, $3, $4, $5, 'OPEN') RETURNING id`,
      [event.id, night1.id, assignment2.id, judges[1].profileId, specialtyBateria.id],
    );

    // Puntuaciones base calibradas:
    // Ará Berá: Coreo 10, Vestuario 10, Batería 8  -> Bruto: 28 x multiplicador = 90
    // Porambá:  Coreo 9,  Vestuario 9,  Batería 10 -> Bruto: 28 x multiplicador = 87
    // Itá Verá: Coreo 8,  Vestuario 8,  Batería 8  -> Bruto: 24 x multiplicador = 82
    const scoresMatrix = {
      "Ará Berá": { COREO: 10, VESTUARIO: 10, BATERIA: 8 },
      "Porambá":  { COREO: 9,  VESTUARIO: 9,  BATERIA: 10 },
      "Itá Verá": { COREO: 8,  VESTUARIO: 8,  BATERIA: 8 },
    };

    for (const troupe of troupes) {
      const { rows: [schedule] } = await client.query(
        `SELECT id FROM night_troupe_schedule WHERE night_id = $1 AND event_troupe_id = $2`,
        [night1.id, troupe.id],
      );
      const troupeScores = scoresMatrix[troupe.name];

      for (const rubric of rubrics) {
        const isBaileRubric = rubric.specialtyId === specialtyBaile.id;
        const ballotId = isBaileRubric ? ballot1.id : ballot2.id;
        const scoreVal = troupeScores[rubric.code] ?? 8;

        await client.query(
          `INSERT INTO ballot_score(ballot_id, event_id, evaluation_item_id, rubric_id, night_schedule_id, score, evaluation_state, status)
           VALUES ($1, $2, $3, $4, $5, $6, 'SCORED', 'LOCKED')`,
          [ballotId, event.id, rubric.itemId, rubric.id, schedule.id, scoreVal],
        );
      }
    }

    // Marcar planillas como presentadas (SUBMITTED)
    await client.query(
      `UPDATE ballot SET status = 'SUBMITTED', submitted_at = CURRENT_TIMESTAMP WHERE event_id = $1`,
      [event.id],
    );

    // Cerrar ventanas de votación para que quede listo para escrutinio
    await client.query(
      `INSERT INTO voting_window(night_id, event_id, status, closed_at)
       VALUES ($1, $2, 'CLOSED', CURRENT_TIMESTAMP), ($3, $2, 'CLOSED', CURRENT_TIMESTAMP)`,
      [night1.id, event.id, night2.id],
    );

    // Habilitar y abrir el evento
    await client.query("SELECT set_config('app.allow_event_open', 'true', true)");
    await client.query("UPDATE carnival_event SET status = 'OPEN' WHERE id = $1", [event.id]);

    await client.query("COMMIT");

    // 11. Cargar penalizaciones de prueba iniciales
    // Penalización aplicada: Ará Berá (5 pts)
    const araBera = troupes.find((t) => t.name === "Ará Berá");
    const itaVera = troupes.find((t) => t.name === "Itá Verá");

    const penalty1 = await createTroupePenalty({
      eventId: event.id,
      nightId: night1.id,
      eventTroupeId: araBera.id,
      reason: "Demora de 8 minutos en salida de pista hacia desconcentración",
      penaltyPoints: 5,
      actorUserId: comisario.userId,
    });

    // Penalización revocada: Itá Verá (3 pts)
    const penalty2 = await createTroupePenalty({
      eventId: event.id,
      nightId: night1.id,
      eventTroupeId: itaVera.id,
      reason: "Bache en desfile superior a 3 minutos",
      penaltyPoints: 3,
      actorUserId: comisario.userId,
    });

    await revokeTroupePenalty({
      eventId: event.id,
      penaltyId: penalty2.id,
      revocationReason: "Descargo justificado con informe cronometrado del veedor de calzada",
      actorUserId: admin.id,
    });

    console.log(JSON.stringify({
      status: "SUCCESS",
      eventName: EVENT_NAME,
      eventId: event.id,
      message: "Competencia de prueba creada exitosamente.",
      credentials: {
        adminUser: admin.email,
        comisarioUser: comisario.email,
        note: "La contraseña es la misma que la del usuario administrador en entorno local.",
      },
      troupes: [
        { name: "Ará Berá", initialScore: "28 pts", penalty: "-5 pts", netScore: "23 pts (baja de 1º a 2º)" },
        { name: "Porambá",  initialScore: "28 pts", penalty: "0 pts",  netScore: "28 pts (sube al 1º lugar)" },
        { name: "Itá Verá", initialScore: "24 pts", penalty: "Revocada", netScore: "24 pts (3º lugar)" },
      ],
      preloadedPenalties: [
        { id: penalty1.id, troupe: "Ará Berá", points: 5, status: "APPLIED" },
        { id: penalty2.id, troupe: "Itá Verá", points: 3, status: "REVOKED" },
      ],
      resultsReleaseStatus: "PENDING_RELEASE (Resultados listos para liberar manualmente en la UI)",
      urls: {
        penaltiesPage: "http://localhost:5173/#/admin/penalties",
        resultsPage: "http://localhost:5173/#/admin/results",
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

seedPenaltiesDemo().catch((error) => {
  console.error("Error al crear la competencia de prueba de penalizaciones:", error);
  process.exitCode = 1;
});
