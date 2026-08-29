import { Router } from "express";
import { auditEvent } from "../audit/audit-service.js";
import { requireAdmin } from "../auth/require-admin.js";
import { requireTwoFactor } from "../auth/two-factor.js";
import { getPool } from "../db/pool.js";
import { createEvent, createNight, getEvent, listEvents, listNights, updateEvent, updateNight } from "../modules/events/event-service.js";

function createWriteHandler(action, entityType, operation) {
  return async (request, response, next) => {
    const client = await getPool().connect();
    try {
      await client.query("BEGIN");
      const result = await operation(client, request);
      await auditEvent(client, {
        actorUserId: request.user.id,
        action,
        entityType,
        entityId: result.id,
        after: result,
      });
      await client.query("COMMIT");
      response.status(action.endsWith("CREATED") ? 201 : 200).json(result);
    } catch (error) {
      await client.query("ROLLBACK");
      if (error.message === "EVENT_LOCKED") {
        response.status(409).json({ code: "EVENT_LOCKED" });
        return;
      }
      next(error);
    } finally {
      client.release();
    }
  };
}

export function createEventsRouter({ requireSession }) {
  const router = Router();
  router.use(requireSession, requireTwoFactor, requireAdmin);
  router.get("/events", async (_request, response, next) => {
    try { response.json(await listEvents()); } catch (error) { next(error); }
  });
  router.get("/events/:eventId", async (request, response, next) => {
    try {
      const event = await getEvent({ eventId: request.params.eventId });
      if (!event) return response.status(404).json({ code: "EVENT_NOT_FOUND" });
      return response.json(event);
    } catch (error) { return next(error); }
  });
  router.get("/events/:eventId/nights", async (request, response, next) => {
    try { return response.json(await listNights({ eventId: request.params.eventId })); } catch (error) { return next(error); }
  });
  router.post("/events", createWriteHandler("EVENT_CREATED", "carnival_event", (client, request) => createEvent({ client, ...request.body })));
  router.patch("/events/:eventId", createWriteHandler("EVENT_UPDATED", "carnival_event", (client, request) => updateEvent({ client, eventId: request.params.eventId, ...request.body })));
  router.post("/events/:eventId/nights", createWriteHandler("NIGHT_CREATED", "night", (client, request) => createNight({ client, eventId: request.params.eventId, ...request.body })));
  router.patch("/nights/:nightId", createWriteHandler("NIGHT_UPDATED", "night", (client, request) => updateNight({ client, nightId: request.params.nightId, ...request.body })));
  return router;
}
