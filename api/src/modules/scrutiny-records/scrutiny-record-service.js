import { createHash } from "node:crypto";
import { auditEvent, canonicalizeJson } from "../../audit/audit-service.js";
import { getPool } from "../../db/pool.js";
import {
  computeOverallRanking,
  computeRubricRankings,
  determineBestTroupe,
  fetchConsolidatedPenalties,
  fetchConsolidatedScores,
  requireResultsReleased,
  runTransaction,
} from "../results/results-service.js";

function requireText(value, name) {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new TypeError(`${name} debe ser texto no vacío.`);
  }
  return value.trim();
}

function requireUuid(value, name) {
  const text = requireText(value, name);
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(text)) {
    throw new TypeError(`${name} debe ser un UUID válido.`);
  }
  return text;
}

/**
 * Calcula el hash SHA-256 canonicalizado según RFC 8785 (JCS).
 */
export function computeRecordHash(payload) {
  const canonical = canonicalizeJson(payload);
  return createHash("sha256").update(canonical, "utf8").digest("hex");
}

/**
 * Comprueba que el hash almacenado coincida bit a bit con el payload.
 */
export function verifyRecordIntegrity(record) {
  if (!record || typeof record.record_hash !== "string" || !record.payload) return false;
  try {
    const computed = computeRecordHash(record.payload);
    return computed.toLowerCase() === record.record_hash.trim().toLowerCase();
  } catch {
    return false;
  }
}

/**
 * Certifica y emite el Acta Oficial de Escrutinio.
 * Exclusivo de ESCRIBANO y SCRUTINEER con 2FA verificado.
 */
export async function certifyScrutinyRecord({
  eventId,
  actorUserId,
  actorRole,
  client: injectedClient = null,
}) {
  const id = requireUuid(eventId, "eventId");
  const actor = requireText(actorUserId, "actorUserId");
  const role = requireText(actorRole, "actorRole");

  if (!["SCRUTINEER", "ESCRIBANO"].includes(role)) {
    const error = new Error("CERTIFICATION_ROLE_UNAUTHORIZED");
    error.code = "CERTIFICATION_ROLE_UNAUTHORIZED";
    throw error;
  }

  return runTransaction(injectedClient, async (client) => {
    // 1. Verificar si ya existe acta previa para este evento (idempotencia)
    const { rows: existingRows } = await client.query(
      `SELECT id, event_id, record_number, certified_by, certified_role, record_hash, payload, created_at
       FROM official_scrutiny_record
       WHERE event_id = $1`,
      [id],
    );

    if (existingRows.length > 0) {
      const existing = existingRows[0];
      return {
        record: existing,
        alreadyCertified: true,
        integrityVerified: verifyRecordIntegrity(existing),
      };
    }

    // 2. Precondición: resultados previamente liberados
    await requireResultsReleased(client, id);

    // 3. Obtener metadatos del evento
    const { rows: eventRows } = await client.query(
      "SELECT id, name, created_at FROM carnival_event WHERE id = $1",
      [id],
    );
    if (eventRows.length === 0) {
      const error = new Error("EVENT_NOT_FOUND");
      error.code = "EVENT_NOT_FOUND";
      throw error;
    }
    const event = eventRows[0];

    // 4. Obtener usuario certificante
    const { rows: userRows } = await client.query(
      'SELECT id, name, email FROM "user" WHERE id = $1',
      [actor],
    );
    const certifierUser = userRows[0] || { id: actor, name: "Autoridad Oficial", email: "" };

    // 5. Consolidar escrutinio y verificar desempates
    const scores = await fetchConsolidatedScores({ eventId: id, client });
    const penalties = await fetchConsolidatedPenalties({ eventId: id, client });
    const rubricRankings = computeRubricRankings(scores);
    const overallRanking = computeOverallRanking(scores, penalties);

    // determineBestTroupe() nunca devuelve un `status`: si el empate no se
    // resuelve por criterios 1/2, resolveTieBreaker() LANZA
    // TIE_BREAKER_REQUIRES_MANUAL_DRAW. Ese es el punto real donde hay que
    // verificar si el sorteo ceremonial (Spec 011) ya fue registrado.
    let bestTroupe;
    try {
      bestTroupe = determineBestTroupe({ overallRanking, rubricRankings });
    } catch (error) {
      if (error.code !== "TIE_BREAKER_REQUIRES_MANUAL_DRAW") {
        throw error;
      }

      const { rows: drawRows } = await client.query(
        `SELECT id AS "auditEventId",
                after_data->>'winnerTroupeId' AS "winnerTroupeId",
                after_data->>'method' AS method,
                after_data->>'seed' AS seed,
                created_at AS "recordedAt"
         FROM audit_event
         WHERE entity_type = 'results'
           AND entity_id = $1
           AND action = 'RESULTS_TIE_BREAKER_CEREMONIAL_DRAW'
         LIMIT 1`,
        [id],
      );

      if (drawRows.length === 0) {
        const pendingError = new Error("TIE_BREAKER_PENDING");
        pendingError.code = "TIE_BREAKER_PENDING";
        throw pendingError;
      }

      const draw = drawRows[0];
      const winningTroupe = overallRanking.find((t) => t.troupeId === draw.winnerTroupeId);
      bestTroupe = {
        winnerTroupeId: draw.winnerTroupeId,
        winnerTroupeName: winningTroupe ? winningTroupe.troupeName : draw.winnerTroupeId,
        tieBreaker: {
          appliedCriteria: [
            "CRITERION_1_RUBRIC_WINS",
            "CRITERION_2_BATTERIE_SCORE",
            "CRITERION_3_CEREMONIAL_DRAW",
          ],
          ceremonialDraw: {
            auditEventId: draw.auditEventId,
            winnerTroupeId: draw.winnerTroupeId,
            method: draw.method,
            seed: draw.seed,
            recordedAt: draw.recordedAt,
          },
        },
      };
    }

    // 6. Obtener comparsas participantes
    const { rows: troupes } = await client.query(
      `SELECT et.id AS "troupeId", et.name AS "troupeName", c.name AS "categoryName"
       FROM event_troupe et
       JOIN event_category c ON c.id = et.category_id
       WHERE et.event_id = $1
       ORDER BY et.name`,
      [id],
    );

    // 7. Obtener nómina de jurados que votaron
    const { rows: judges } = await client.query(
      `SELECT DISTINCT jp.id AS "judgeProfileId", jp.name AS "judgeName", s.name AS "specialtyName"
       FROM ballot b
       JOIN judge_profile jp ON jp.id = b.judge_profile_id
       JOIN event_specialty s ON s.id = b.specialty_id
       WHERE b.event_id = $1 AND b.status = 'SUBMITTED'
       ORDER BY jp.name`,
      [id],
    );

    // 8. Construir payload canónico
    const year = new Date().getFullYear();
    const recordNumber = `ACTA-${year}-${id.slice(0, 8).toUpperCase()}-01`;
    const certifiedAt = new Date().toISOString();

    const payload = {
      recordNumber,
      event: {
        id: event.id,
        name: event.name,
      },
      certifiedAt,
      certifiedBy: {
        userId: certifierUser.id,
        name: certifierUser.name,
        role,
      },
      judges: judges.map((j) => ({
        judgeProfileId: j.judgeProfileId,
        judgeName: j.judgeName,
        specialtyName: j.specialtyName,
      })),
      troupes: troupes.map((t) => ({
        troupeId: t.troupeId,
        troupeName: t.troupeName,
        categoryName: t.categoryName,
      })),
      rubricRankings: rubricRankings.map((r) => ({
        rubricId: r.rubricId,
        rubricName: r.rubricName,
        rubricCode: r.rubricCode,
        rubricKind: r.rubricKind,
        winnerTroupeIds: r.winnerTroupeIds,
        winners: r.winners,
        troupes: r.troupes,
      })),
      overallRanking: overallRanking.map((o) => ({
        rank: o.rank,
        troupeId: o.troupeId,
        troupeName: o.troupeName,
        grossScore: o.grossScore,
        totalPenalties: o.totalPenalties,
        netScore: o.netScore,
        penalties: o.penalties || [],
      })),
      bestTroupe: {
        winnerTroupeId: bestTroupe.winnerTroupeId,
        winnerTroupeName:
          overallRanking.find((t) => t.troupeId === bestTroupe.winnerTroupeId)?.troupeName ||
          bestTroupe.winnerTroupeId ||
          null,
        tieBreaker: bestTroupe.tieBreaker || null,
      },
    };

    // 9. Calcular hash JCS/SHA-256
    const recordHash = computeRecordHash(payload);

    // 10. Persistir en official_scrutiny_record
    const { rows: inserted } = await client.query(
      `INSERT INTO official_scrutiny_record(
         event_id, record_number, certified_by, certified_role, record_hash, payload, created_at
       ) VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING id, event_id, record_number, certified_by, certified_role, record_hash, payload, created_at`,
      [id, recordNumber, certifierUser.id, role, recordHash, JSON.stringify(payload), certifiedAt],
    );

    const record = inserted[0];

    // 11. Registrar en auditoría
    await auditEvent(client, {
      actorUserId: actor,
      action: "OFFICIAL_SCRUTINY_RECORD_CERTIFIED",
      entityType: "official_scrutiny_record",
      entityId: record.id,
      after: {
        eventId: id,
        recordNumber,
        recordHash,
        certifiedRole: role,
        winnerTroupeId: bestTroupe.winnerTroupeId,
      },
    });

    return {
      record,
      alreadyCertified: false,
      integrityVerified: true,
    };
  });
}

/**
 * Consulta el Acta Oficial de un evento con su verificación de integridad.
 */
export async function getOfficialScrutinyRecord({ eventId, client: injectedClient = null }) {
  const id = requireUuid(eventId, "eventId");
  return runTransaction(injectedClient, async (client) => {
    const { rows } = await client.query(
      `SELECT id, event_id, record_number, certified_by, certified_role, record_hash, payload, created_at
       FROM official_scrutiny_record
       WHERE event_id = $1`,
      [id],
    );

    if (rows.length === 0) return null;
    const record = rows[0];
    return {
      ...record,
      integrityVerified: verifyRecordIntegrity(record),
    };
  });
}
