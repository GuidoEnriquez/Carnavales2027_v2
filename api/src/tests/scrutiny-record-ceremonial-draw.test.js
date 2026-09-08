import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import { createApp } from "../app.js";
import { closePool, getPool } from "../db/pool.js";
import { migrate } from "../db/migrate.js";

// Regresión: certifyScrutinyRecord() comprobaba `bestTroupe.status ===
// "REQUIRES_CEREMONIAL_DRAW"`, pero determineBestTroupe() nunca devuelve esa
// forma -- ante un empate no resuelto, resolveTieBreaker() LANZA
// TIE_BREAKER_REQUIRES_MANUAL_DRAW. La rama que buscaba un sorteo ya
// registrado era código muerto: un evento que necesitó sorteo ceremonial
// nunca podía certificar su Acta Oficial, incluso después de sortear.

const originalDatabaseUrl = process.env.DATABASE_URL;

async function withServer(app, run) {
  const server = await new Promise((resolve) => {
    const instance = app.listen(0, "127.0.0.1", () => resolve(instance));
  });
  try {
    await run(`http://127.0.0.1:${server.address().port}`);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
}

// Dos rubros nominativos, ambas comparsas empatadas 8-8 en los dos, sin rubro
// BATERIA: los criterios 1 y 2 de desempate no resuelven nada y el 3
// (sorteo ceremonial) queda pendiente. Mismo patrón probado en
// results-ceremonial-draw.test.js.
async function createTiedScrutinyFixture(pool) {
  const { rows: [event] } = await pool.query(
    "INSERT INTO carnival_event(name) VALUES($1) RETURNING id",
    [`Scrutiny Ceremonial Draw ${randomUUID()}`],
  );
  const { rows: [night] } = await pool.query(
    "INSERT INTO night(event_id, name, display_order, kind, status) VALUES($1,'Noche 1',1,'COMPETITION','OPEN') RETURNING id",
    [event.id],
  );
  const { rows: [specialty] } = await pool.query(
    "INSERT INTO event_specialty(event_id, name, code, display_order) VALUES($1,'Baile','BAILE',1) RETURNING id",
    [event.id],
  );
  const rubrics = [];
  for (const [name, code] of [["Coreografía", "COREOGRAFIA"], ["Diseño", "DISENO"]]) {
    const { rows: [rubric] } = await pool.query(
      "INSERT INTO rubric(event_id, name, code, evaluation_target, rubric_type) VALUES($1,$2,$3,'TROUPE','NOMINATIVE') RETURNING id",
      [event.id, name, code],
    );
    const { rows: [item] } = await pool.query(
      "INSERT INTO evaluation_item(event_id, rubric_id, specialty_id, name, code) VALUES($1,$2,$3,$4,$5) RETURNING id",
      [event.id, rubric.id, specialty.id, `${name} item`, `${code}_ITEM`],
    );
    rubrics.push({ ...rubric, itemId: item.id });
  }
  const { rows: [category] } = await pool.query(
    "INSERT INTO event_category(event_id, name, code, display_order) VALUES($1,'Primera','PRIMERA',1) RETURNING id",
    [event.id],
  );
  const troupes = [];
  for (const name of ["Comparsa A", "Comparsa B"]) {
    const { rows: [troupe] } = await pool.query(
      "INSERT INTO event_troupe(event_id, category_id, name) VALUES($1,$2,$3) RETURNING id",
      [event.id, category.id, name],
    );
    troupes.push(troupe);
  }

  const adminId = randomUUID();
  const scrutineerId = randomUUID();
  const escribanoId = randomUUID();
  const judgeUserId = randomUUID();
  await pool.query(
    `INSERT INTO "user"(id, name, email, "emailVerified") VALUES
     ($1,'Admin',$5,true), ($2,'Scrutineer',$6,true), ($3,'Escribano',$7,true), ($4,'Judge',$8,true)`,
    [
      adminId, scrutineerId, escribanoId, judgeUserId,
      `${adminId}@test.local`, `${scrutineerId}@test.local`,
      `${escribanoId}@test.local`, `${judgeUserId}@test.local`,
    ],
  );
  for (const [id, role] of [[adminId, "ADMIN"], [scrutineerId, "SCRUTINEER"], [escribanoId, "ESCRIBANO"]]) {
    await pool.query("INSERT INTO user_role(user_id, role_code) VALUES($1,$2)", [id, role]);
  }

  const { rows: [profile] } = await pool.query(
    "INSERT INTO judge_profile(name, email, document_number, registration_status, created_by, user_id) VALUES('Jurado',$1,$2,'REGISTERED',$3,$4) RETURNING id",
    [`${randomUUID()}@test.local`, `DOC-${randomUUID()}`, adminId, judgeUserId],
  );
  await pool.query(
    "INSERT INTO judge_quota(event_id, night_id, specialty_id, max_assignments) VALUES($1,$2,$3,2)",
    [event.id, night.id, specialty.id],
  );
  const { rows: [assignment] } = await pool.query(
    "INSERT INTO judge_assignment(event_id, night_id, specialty_id, judge_profile_id, assignment_type) VALUES($1,$2,$3,$4,'PRIMARY') RETURNING id",
    [event.id, night.id, specialty.id, profile.id],
  );
  const { rows: [ballot] } = await pool.query(
    "INSERT INTO ballot(event_id, night_id, judge_assignment_id, judge_profile_id, specialty_id, status) VALUES($1,$2,$3,$4,$5,'OPEN') RETURNING id",
    [event.id, night.id, assignment.id, profile.id, specialty.id],
  );

  for (const troupe of troupes) {
    const { rows: [schedule] } = await pool.query(
      "INSERT INTO night_troupe_schedule(event_id, night_id, event_troupe_id, presentation_order, status) VALUES($1,$2,$3,$4,'SCHEDULED') RETURNING id",
      [event.id, night.id, troupe.id, troupes.indexOf(troupe) + 1],
    );
    for (const rubric of rubrics) {
      await pool.query(
        `INSERT INTO ballot_score(ballot_id, event_id, evaluation_item_id, rubric_id, night_schedule_id, score, evaluation_state, status)
         VALUES ($1,$2,$3,$4,$5,8,'SCORED','LOCKED')`,
        [ballot.id, event.id, rubric.itemId, rubric.id, schedule.id],
      );
    }
  }
  await pool.query(
    "UPDATE ballot SET status = 'SUBMITTED', submitted_at = CURRENT_TIMESTAMP WHERE id = $1",
    [ballot.id],
  );
  await pool.query(
    "INSERT INTO results_release(event_id, released_by) VALUES($1,$2)",
    [event.id, adminId],
  );

  return {
    eventId: event.id,
    scrutineerId,
    escribanoId,
    troupeIds: troupes.map((t) => t.id),
  };
}

test("Acta Oficial: certifica tras un sorteo ceremonial ya registrado (regresión de rama muerta)", {
  skip: !process.env.TEST_DATABASE_URL,
}, async (context) => {
  context.after(async () => {
    await closePool();
    if (originalDatabaseUrl === undefined) delete process.env.DATABASE_URL;
    else process.env.DATABASE_URL = originalDatabaseUrl;
  });

  process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;
  await migrate();
  const pool = getPool();
  const fixture = await createTiedScrutinyFixture(pool);

  const app = createApp({
    getSession: async ({ headers }) => {
      const caller = headers.get("x-test-caller");
      if (caller === "scrutineer") return { user: { id: fixture.scrutineerId, twoFactorEnabled: true } };
      if (caller === "escribano") return { user: { id: fixture.escribanoId, twoFactorEnabled: true } };
      return null;
    },
  });

  await withServer(app, async (baseUrl) => {
    const scrutinyPath = `${baseUrl}/api/v1/events/${fixture.eventId}/scrutiny-record`;
    const drawPath = `${baseUrl}/api/v1/events/${fixture.eventId}/tie-breaker/ceremonial-draw`;

    // 1. Empate sin sortear: certificar debe rechazarse con 409 TIE_BREAKER_PENDING
    //    (Spec 015 RF-121), no con un error crudo ni con el código de "hace falta
    //    sortear" que usa el endpoint de consolidación de resultados.
    const beforeDraw = await fetch(scrutinyPath, {
      method: "POST",
      headers: { "x-test-caller": "escribano" },
    });
    assert.equal(beforeDraw.status, 409);
    const beforeDrawBody = await beforeDraw.json();
    assert.equal(beforeDrawBody.code, "TIE_BREAKER_PENDING");

    // 2. Ejecutar el sorteo ceremonial (Spec 011) como SCRUTINEER.
    const drawRes = await fetch(drawPath, {
      method: "POST",
      headers: { "x-test-caller": "scrutineer", "content-type": "application/json" },
      body: JSON.stringify({ remainingTroupeIds: fixture.troupeIds }),
    });
    assert.equal(drawRes.status, 201);
    const draw = await drawRes.json();
    assert.ok(fixture.troupeIds.includes(draw.winnerTroupeId));

    // 3. Con el sorteo ya registrado, certificar debe tener éxito y el acta
    //    debe incorporar al ganador del sorteo, no volver a exigir un sorteo.
    const afterDraw = await fetch(scrutinyPath, {
      method: "POST",
      headers: { "x-test-caller": "escribano" },
    });
    const afterDrawBody = await afterDraw.json();
    if (afterDraw.status !== 201) console.log("CERTIFY BODY:", afterDrawBody);
    assert.equal(afterDraw.status, 201);
    assert.equal(afterDrawBody.alreadyCertified, false);
    assert.equal(afterDrawBody.record.payload.bestTroupe.winnerTroupeId, draw.winnerTroupeId);
    assert.equal(
      afterDrawBody.record.payload.bestTroupe.tieBreaker.ceremonialDraw.winnerTroupeId,
      draw.winnerTroupeId,
    );
    assert.equal(
      afterDrawBody.record.payload.bestTroupe.tieBreaker.ceremonialDraw.auditEventId,
      draw.auditEventId,
    );
    assert.ok(
      afterDrawBody.record.payload.bestTroupe.tieBreaker.appliedCriteria.includes(
        "CRITERION_3_CEREMONIAL_DRAW",
      ),
    );
  });
});
