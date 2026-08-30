import { Router } from "express";
import { requireTwoFactor } from "../auth/two-factor.js";
import { getPool } from "../db/pool.js";
import { getJudgeProfileByUserId } from "../modules/judges/judge-service.js";

export function createMeRouter({ requireSession }) {
  const router = Router();

  router.get("/me", requireSession, requireTwoFactor, async (request, response, next) => {
    try {
      const { rows } = await getPool().query(
        "SELECT role_code FROM user_role WHERE user_id = $1 ORDER BY role_code",
        [request.user.id],
      );
      response.status(200).json({
        user: {
          id: request.user.id,
          email: request.user.email,
          name: request.user.name,
        },
        roles: rows.map((row) => row.role_code),
        judgeProfile: await getJudgeProfileByUserId({ userId: request.user.id }),
      });
    } catch (error) {
      next(error);
    }
  });

  return router;
}
