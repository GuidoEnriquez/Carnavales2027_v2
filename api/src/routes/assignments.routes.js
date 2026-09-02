import { Router } from "express";
import { requireAdmin } from "../auth/require-admin.js";
import { requireJudge } from "../auth/require-judge.js";
import { requireTwoFactor } from "../auth/two-factor.js";
import {
  createJudgeAssignment,
  activateJudgeSubstitute,
  listEventAssignments,
  listJudgeAssignments,
  replaceJudgeAssignment,
  revokeJudgeAssignment,
  setJudgeQuota,
} from "../modules/judges/assignment-service.js";

export function createAssignmentsRouter({ requireSession }) {
  const router = Router();
  const admin = [requireSession, requireTwoFactor, requireAdmin];
  const judge = [requireSession, requireTwoFactor, requireJudge];

  router.get("/events/:eventId/judge-assignments", ...admin, async (request, response, next) => {
    try { return response.json(await listEventAssignments({ eventId: request.params.eventId })); }
    catch (error) { return next(error); }
  });

  router.put("/events/:eventId/nights/:nightId/specialties/:specialtyId/judge-quota", ...admin, async (request, response, next) => {
    try {
      return response.json(await setJudgeQuota({
        actorUserId: request.user.id,
        eventId: request.params.eventId,
        nightId: request.params.nightId,
        specialtyId: request.params.specialtyId,
        maxAssignments: request.body?.maxAssignments,
      }));
    } catch (error) { return next(error); }
  });

  router.post("/events/:eventId/judge-assignments", ...admin, async (request, response, next) => {
    try {
      return response.status(201).json(await createJudgeAssignment({
        actorUserId: request.user.id,
        eventId: request.params.eventId,
        nightId: request.body?.nightId,
        specialtyId: request.body?.specialtyId,
        judgeProfileId: request.body?.judgeProfileId,
        assignmentType: request.body?.assignmentType,
        standbyForAssignmentId: request.body?.standbyForAssignmentId,
      }));
    } catch (error) { return next(error); }
  });

  router.post("/judge-assignments/:assignmentId/revoke", ...admin, async (request, response, next) => {
    try {
      return response.json(await revokeJudgeAssignment({
        actorUserId: request.user.id,
        assignmentId: request.params.assignmentId,
        reason: request.body?.reason,
      }));
    } catch (error) { return next(error); }
  });

  router.post("/judge-assignments/:assignmentId/replace", ...admin, async (request, response, next) => {
    try {
      return response.status(201).json(await replaceJudgeAssignment({
        actorUserId: request.user.id,
        assignmentId: request.params.assignmentId,
        replacementJudgeProfileId: request.body?.replacementJudgeProfileId,
        assignmentType: request.body?.assignmentType,
        reason: request.body?.reason,
      }));
    } catch (error) { return next(error); }
  });

  router.post("/judge-assignments/:assignmentId/activate-substitute", ...admin, async (request, response, next) => {
    try {
      return response.status(201).json(await activateJudgeSubstitute({
        actorUserId: request.user.id,
        primaryAssignmentId: request.params.assignmentId,
        reason: request.body?.reason,
      }));
    } catch (error) { return next(error); }
  });

  router.get("/judge/assignments", ...judge, async (request, response, next) => {
    try { return response.json(await listJudgeAssignments({ userId: request.user.id })); }
    catch (error) { return next(error); }
  });

  return router;
}
