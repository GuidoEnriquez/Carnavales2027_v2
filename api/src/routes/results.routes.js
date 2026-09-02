import { Router } from "express";
import { requireTwoFactor } from "../auth/two-factor.js";
import { requireResultsAccess } from "../auth/require-results-access.js";
import { releaseResults, computeResults } from "../modules/results/results-service.js";
import { requireCeremonialDrawAccess } from "../auth/require-ceremonial-draw-access.js";
import { executeCeremonialDraw, getRecordedCeremonialDraw } from "../modules/results/ceremonial-draw-orchestrator.js";
import { listEvents } from "../modules/events/event-service.js";
import { listTroupes } from "../modules/troupes/category-service.js";
import { sendKnownError } from "./http-errors.js";

export function createResultsRouter({ requireSession }) {
  const router = Router();
  const authorized = [requireSession, requireTwoFactor, requireResultsAccess];

  // Lecturas acotadas para la pantalla de escrutinio. No exponen escrituras
  // de administración y permiten que SCRUTINEER seleccione competencia y comparsas.
  router.get("/results/events", ...authorized, async (_request, response, next) => {
    try { return response.json(await listEvents()); } catch (error) { return next(error); }
  });
  router.get("/results/events/:eventId/troupes", ...authorized, async (request, response, next) => {
    try { return response.json(await listTroupes({ eventId: request.params.eventId })); } catch (error) { return next(error); }
  });

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

  // Spec 011 — Sorteo ceremonial con conteo regresivo (criterio 3 de desempate).
  // Roles: ADMIN, SCRUTINEER o ESCRIBANO. 2FA obligatorio.
  const ceremonialAuthorized = [
    requireSession,
    requireTwoFactor,
    requireCeremonialDrawAccess,
  ];

  router.get(
    "/events/:eventId/tie-breaker/ceremonial-draw",
    ...ceremonialAuthorized,
    async (request, response) => {
      try {
        response.json(await getRecordedCeremonialDraw({ eventId: request.params.eventId }));
      } catch (error) {
        if (sendKnownError(response, error)) return;
        throw error;
      }
    },
  );

  router.post(
    "/events/:eventId/tie-breaker/ceremonial-draw",
    ...ceremonialAuthorized,
    async (request, response) => {
      try {
        const body = request.body ?? {};
        const result = await executeCeremonialDraw({
          eventId: request.params.eventId,
          remainingTroupeIds: body.remainingTroupeIds,
          actorUserId: request.user.id,
          actorRole: request.roles?.[0] ?? null,
        });
        response.status(201).json(result);
      } catch (error) {
        if (sendKnownError(response, error)) return;
        throw error;
      }
    },
  );

  return router;
}
