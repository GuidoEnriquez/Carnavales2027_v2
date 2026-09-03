import { Router } from "express";
import { requireTwoFactor } from "../auth/two-factor.js";
import { requirePenaltiesAccess } from "../auth/require-penalties-access.js";
import {
  createTroupePenalty,
  revokeTroupePenalty,
  listTroupePenalties,
} from "../modules/penalties/penalty-service.js";
import { sendKnownError } from "./http-errors.js";

export function createPenaltiesRouter({ requireSession }) {
  const router = Router();
  const authorized = [requireSession, requireTwoFactor, requirePenaltiesAccess];

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
