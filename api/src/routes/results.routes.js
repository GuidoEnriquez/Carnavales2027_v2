import { Router } from "express";
import { requireTwoFactor } from "../auth/two-factor.js";
import { requireResultsAccess } from "../auth/require-results-access.js";
import { releaseResults, computeResults } from "../modules/results/results-service.js";
import { sendKnownError } from "./http-errors.js";

export function createResultsRouter({ requireSession }) {
  const router = Router();
  const authorized = [requireSession, requireTwoFactor, requireResultsAccess];

  router.post("/events/:eventId/results/release", ...authorized, async (request, response) => {
    try {
      const result = await releaseResults({
        eventId: request.params.eventId,
        actorUserId: request.user.id,
      });
      response.status(201).json(result);
    } catch (error) {
      if (sendKnownError(response, error)) return;
      throw error;
    }
  });

  router.get("/events/:eventId/results", ...authorized, async (request, response) => {
    try {
      const result = await computeResults({
        eventId: request.params.eventId,
        actorUserId: request.user.id,
      });
      response.json(result);
    } catch (error) {
      if (sendKnownError(response, error)) return;
      throw error;
    }
  });

  return router;
}
