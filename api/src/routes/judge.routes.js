import { Router } from "express";
import { requireJudge } from "../auth/require-judge.js";
import { requireTwoFactor } from "../auth/two-factor.js";
import { listJudgeAssignments } from "../modules/judges/assignment-service.js";

export function createJudgeRouter({ requireSession }) {
  const router = Router();
  router.get("/judge/profile", requireSession, requireTwoFactor, requireJudge, async (request, response) => {
    const assignments = await listJudgeAssignments({ userId: request.user.id });
    response.json({
      id: request.judgeProfile.id,
      registrationStatus: request.judgeProfile.registrationStatus,
      assignments,
    });
  });
  return router;
}
