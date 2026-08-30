import { Router } from "express";
import { requireAdmin } from "../auth/require-admin.js";
import { grantRole, listUsers, revokeRole } from "../auth/role-service.js";
import { requireTwoFactor } from "../auth/two-factor.js";
import { sendKnownError } from "./http-errors.js";

export function createUsersRouter({ requireSession }) {
  const router = Router();
  router.use(requireSession, requireTwoFactor, requireAdmin);

  router.get("/users", async (_request, response, next) => {
    try {
      response.json(await listUsers());
    } catch (error) {
      next(error);
    }
  });

  router.post("/users/:userId/roles/admin", async (request, response, next) => {
    try {
      const result = await grantRole({
        actorUserId: request.user.id,
        userId: request.params.userId,
        roleCode: "ADMIN",
      });
      response.status(result.created ? 201 : 200).json(result);
    } catch (error) {
      if (error.code === "23503") return response.status(404).json({ code: "USER_NOT_FOUND" });
      if (sendKnownError(response, error)) return;
      return next(error);
    }
  });

  router.delete("/users/:userId/roles/admin", async (request, response, next) => {
    try {
      return response.json(await revokeRole({
        actorUserId: request.user.id,
        userId: request.params.userId,
        roleCode: "ADMIN",
      }));
    } catch (error) {
      if (sendKnownError(response, error)) return;
      return next(error);
    }
  });

  return router;
}
