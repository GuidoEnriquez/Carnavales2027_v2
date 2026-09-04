import { Router } from "express";
import { requireTwoFactor } from "../auth/two-factor.js";
import { requireVotingObserver } from "../auth/require-voting-observer.js";
import { listMonitorEvents, getMonitorNight } from "../modules/monitor/monitor-service.js";
import { sendKnownError } from "./http-errors.js";

// Spec 016 — Supervisión de votación por VEEDOR (solo lectura, agregados).
// Roles: ADMIN o VEEDOR con sesión 2FA verificada.
export function createMonitorRouter({ requireSession }) {
  const router = Router();
  const observer = [requireSession, requireTwoFactor, requireVotingObserver];

  router.get("/monitor/events", ...observer, async (_request, response) => {
    try {
      response.json(await listMonitorEvents());
    } catch (error) {
      if (sendKnownError(response, error)) return;
      throw error;
    }
  });

  router.get("/monitor/events/:eventId/nights/:nightId", ...observer, async (request, response) => {
    try {
      response.json(await getMonitorNight({
        eventId: request.params.eventId,
        nightId: request.params.nightId,
      }));
    } catch (error) {
      if (sendKnownError(response, error)) return;
      throw error;
    }
  });

  return router;
}
