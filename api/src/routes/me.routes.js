import { Router } from "express";
import { requireTwoFactor } from "../auth/two-factor.js";
import { requireAdmin } from "../auth/require-admin.js";

export function createMeRouter({ requireSession }) {
  const router = Router();

  router.get("/me", requireSession, requireTwoFactor, requireAdmin, (request, response) => {
    response.status(200).json({
      user: {
        id: request.user.id,
        email: request.user.email,
        name: request.user.name,
      },
      roles: request.roles,
    });
  });

  return router;
}
