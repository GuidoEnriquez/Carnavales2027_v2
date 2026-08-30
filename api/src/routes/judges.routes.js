import { Router } from "express";
import { requireTwoFactor } from "../auth/two-factor.js";
import { requireAdmin } from "../auth/require-admin.js";
import {
  createJudge,
  listJudges,
  reactivateJudge,
  reissueInvitation,
  revokeInvitation,
  suspendJudge,
} from "../modules/judges/judge-service.js";

export function createJudgesRouter({ requireSession, sendInvitation, revokeSessions }) {
  const router = Router();
  router.use(requireSession, requireTwoFactor, requireAdmin);

  router.get("/judges", async (_request, response, next) => {
    try {
      return response.json(await listJudges());
    } catch (error) {
      return next(error);
    }
  });

  router.post("/judges", async (request, response, next) => {
    try {
      const result = await createJudge({
        name: request.body?.name,
        email: request.body?.email,
        documentNumber: request.body?.documentNumber,
        actorUserId: request.user.id,
        ...(sendInvitation ? { sendInvitation } : {}),
      });
      return response.status(201).json(result);
    } catch (error) {
      return next(error);
    }
  });

  router.post("/judges/:judgeId/invitations", async (request, response, next) => {
    try {
      return response.status(201).json(await reissueInvitation({
        actorUserId: request.user.id,
        judgeProfileId: request.params.judgeId,
        ...(sendInvitation ? { sendInvitation } : {}),
      }));
    } catch (error) {
      return next(error);
    }
  });

  router.delete("/judges/:judgeId/invitations/:invitationId", async (request, response, next) => {
    try {
      return response.json(await revokeInvitation({
        actorUserId: request.user.id,
        judgeProfileId: request.params.judgeId,
        invitationId: request.params.invitationId,
      }));
    } catch (error) {
      return next(error);
    }
  });

  router.post("/judges/:judgeId/suspend", async (request, response, next) => {
    try {
      return response.json(await suspendJudge({
        actorUserId: request.user.id,
        judgeProfileId: request.params.judgeId,
        ...(revokeSessions ? { revokeSessions } : {}),
      }));
    } catch (error) {
      return next(error);
    }
  });

  router.post("/judges/:judgeId/reactivate", async (request, response, next) => {
    try {
      return response.json(await reactivateJudge({
        actorUserId: request.user.id,
        judgeProfileId: request.params.judgeId,
        ...(revokeSessions ? { revokeSessions } : {}),
      }));
    } catch (error) {
      return next(error);
    }
  });

  return router;
}
