import { Router } from "express";
import { requireTwoFactor } from "../auth/two-factor.js";
import { requirePenaltiesAccess } from "../auth/require-penalties-access.js";
import {
  createTroupePenalty,
  revokeTroupePenalty,
  listTroupePenalties,
} from "../modules/penalties/penalty-service.js";
import { listEvents, listNights } from "../modules/events/event-service.js";
import { listTroupes } from "../modules/troupes/category-service.js";
import { sendKnownError } from "./http-errors.js";

export function createPenaltiesRouter({ requireSession }) {
  const router = Router();
  const authorized = [requireSession, requireTwoFactor, requirePenaltiesAccess];

  // Lecturas acotadas para el comisariato (eventos, noches de competencia y comparsas)
  router.get("/penalties/events", ...authorized, async (_request, response, next) => {
    try {
      return response.json(await listEvents());
    } catch (error) {
      return next(error);
    }
  });

  router.get("/events/:eventId/penalties/nights", ...authorized, async (request, response, next) => {
    try {
      const nights = await listNights({ eventId: request.params.eventId });
      return response.json(nights);
    } catch (error) {
      if (sendKnownError(response, error)) return undefined;
      return next(error);
    }
  });

  router.get("/events/:eventId/penalties/troupes", ...authorized, async (request, response, next) => {
    try {
      const troupes = await listTroupes({ eventId: request.params.eventId });
      return response.json(troupes);
    } catch (error) {
      if (sendKnownError(response, error)) return undefined;
      return next(error);
    }
  });

  router.get("/events/:eventId/penalties", ...authorized, async (request, response, next) => {
    try {
      const { nightId, troupeId, status } = request.query;
      const penalties = await listTroupePenalties({
        eventId: request.params.eventId,
        nightId: nightId || null,
        troupeId: troupeId || null,
        status: status || null,
      });
      return response.json(penalties);
    } catch (error) {
      if (sendKnownError(response, error)) return undefined;
      return next(error);
    }
  });

  router.post("/events/:eventId/penalties", ...authorized, async (request, response, next) => {
    try {
      const body = request.body ?? {};
      const penalty = await createTroupePenalty({
        eventId: request.params.eventId,
        nightId: body.nightId,
        eventTroupeId: body.eventTroupeId,
        reason: body.reason,
        penaltyPoints: body.penaltyPoints,
        actorUserId: request.user.id,
      });
      return response.status(201).json(penalty);
    } catch (error) {
      if (sendKnownError(response, error)) return undefined;
      return next(error);
    }
  });

  router.post(
    "/events/:eventId/penalties/:penaltyId/revoke",
    ...authorized,
    async (request, response, next) => {
      try {
        const body = request.body ?? {};
        const revoked = await revokeTroupePenalty({
          eventId: request.params.eventId,
          penaltyId: request.params.penaltyId,
          revocationReason: body.revocationReason,
          actorUserId: request.user.id,
        });
        return response.json(revoked);
      } catch (error) {
        if (sendKnownError(response, error)) return undefined;
        return next(error);
      }
    },
  );

  return router;
}
