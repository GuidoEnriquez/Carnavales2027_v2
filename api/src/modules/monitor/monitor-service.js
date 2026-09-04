import { getPool } from "../../db/pool.js";

function requireText(value, name) {
  if (typeof value !== "string" || value.trim().length === 0) throw new TypeError(`${name} debe ser texto no vacío.`);
  return value.trim();
}

/**
 * Spec 016 — Supervisión de votación por VEEDOR.
 * Devuelve eventos con sus noches competitivas que tienen actividad de votación
 * (planillas o ventana registrada), con conteos agregados por estado de planilla.
 * Nunca expone puntajes, jurados ni comparsas (mínimo privilegio, SVC2-41).
 */
export async function listMonitorEvents() {
  const { rows: events } = await getPool().query(
    "SELECT id, name, status FROM carnival_event ORDER BY created_at",
  );

  const { rows: nights } = await getPool().query(
    `SELECT n.event_id AS "eventId",
            n.id, n.name, n.status,
            n.display_order AS "displayOrder",
            vw.status AS "votingStatus",
            COUNT(b.id) FILTER (WHERE b.status = 'OPEN')::INTEGER AS "open",
            COUNT(b.id) FILTER (WHERE b.status = 'SUBMITTED')::INTEGER AS "submitted",
            COUNT(b.id) FILTER (WHERE b.status = 'REOPENED')::INTEGER AS "reopened",
            COUNT(b.id) FILTER (WHERE b.status = 'REPLACED')::INTEGER AS "replaced"
       FROM night n
       LEFT JOIN voting_window vw ON vw.night_id = n.id
       LEFT JOIN ballot b ON b.night_id = n.id AND b.event_id = n.event_id
      WHERE n.kind = 'COMPETITION'
      GROUP BY n.event_id, n.id, n.name, n.status, n.display_order, vw.status
     HAVING COUNT(b.id) > 0 OR vw.status IS NOT NULL
      ORDER BY n.display_order`,
  );

  const nightsByEvent = new Map();
  for (const night of nights) {
    const open = night.open ?? 0;
    const submitted = night.submitted ?? 0;
    const reopened = night.reopened ?? 0;
    const replaced = night.replaced ?? 0;
    const entry = {
      id: night.id,
      name: night.name,
      status: night.status,
      votingStatus: night.votingStatus ?? "NOT_OPEN",
      counts: { OPEN: open, SUBMITTED: submitted, REOPENED: reopened, REPLACED: replaced },
      total: open + submitted + reopened,
    };
    if (!nightsByEvent.has(night.eventId)) nightsByEvent.set(night.eventId, []);
    nightsByEvent.get(night.eventId).push(entry);
  }

  return events
    .map((event) => ({
      id: event.id,
      name: event.name,
      status: event.status,
      nights: nightsByEvent.get(event.id) ?? [],
    }))
    .filter((event) => event.nights.length > 0);
}

export async function getMonitorNight({ eventId, nightId }) {
  const id = requireText(eventId, "eventId");
  const nid = requireText(nightId, "nightId");
  const { rows: events } = await getPool().query("SELECT id FROM carnival_event WHERE id = $1", [id]);
  if (!events[0]) throw new Error("EVENT_NOT_FOUND");
  const { rows } = await getPool().query(
    `SELECT n.id, n.name, n.status,
            vw.status AS "votingStatus",
            COUNT(b.id) FILTER (WHERE b.status = 'OPEN')::INTEGER AS "open",
            COUNT(b.id) FILTER (WHERE b.status = 'SUBMITTED')::INTEGER AS "submitted",
            COUNT(b.id) FILTER (WHERE b.status = 'REOPENED')::INTEGER AS "reopened",
            COUNT(b.id) FILTER (WHERE b.status = 'REPLACED')::INTEGER AS "replaced"
       FROM night n
       LEFT JOIN voting_window vw ON vw.night_id = n.id
       LEFT JOIN ballot b ON b.night_id = n.id AND b.event_id = n.event_id
      WHERE n.id = $1 AND n.event_id = $2 AND n.kind = 'COMPETITION'
      GROUP BY n.id, n.name, n.status, vw.status`,
    [nid, id],
  );
  if (!rows[0]) throw new Error("NIGHT_NOT_FOUND");
  const night = rows[0];
  const open = night.open ?? 0;
  const submitted = night.submitted ?? 0;
  const reopened = night.reopened ?? 0;
  const replaced = night.replaced ?? 0;
  return {
    id: night.id,
    name: night.name,
    status: night.status,
    votingStatus: night.votingStatus ?? "NOT_OPEN",
    counts: { OPEN: open, SUBMITTED: submitted, REOPENED: reopened, REPLACED: replaced },
    total: open + submitted + reopened,
  };
}
