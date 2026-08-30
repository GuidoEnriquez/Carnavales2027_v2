import { Router } from "express";
import { acceptInvitation, inspectInvitation } from "../modules/judges/judge-service.js";

export function createJudgeInvitationsRouter({ createUser } = {}) {
  const router = Router();
  router.post("/judge-invitations/inspect", async (request, response, next) => {
    try {
      return response.json(await inspectInvitation({ secret: request.body?.secret }));
    } catch (error) {
      return next(error);
    }
  });
  router.post("/judge-invitations/accept", async (request, response, next) => {
    try {
      return response.status(201).json(await acceptInvitation({
        secret: request.body?.secret,
        password: request.body?.password,
        ...(createUser ? { createUser } : {}),
      }));
    } catch (error) {
      return next(error);
    }
  });
  return router;
}
