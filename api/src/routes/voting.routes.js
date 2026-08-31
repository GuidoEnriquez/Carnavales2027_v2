import { Router } from "express";
import { requireTwoFactor } from "../auth/two-factor.js";
import { requireAdmin } from "../auth/require-admin.js";
import { requireJudge } from "../auth/require-judge.js";
import { requireVotingObserver } from "../auth/require-voting-observer.js";
import {
  openVoting,
  closeVoting,
  getVotingStatus,
  listJudgeBallots,
  getBallot,
  saveScore,
  submitBallot,
  syncBallot,
  listNightBallots,
} from "../modules/ballots/ballot-service.js";
import { sendKnownError } from "./http-errors.js";

export function createVotingRouter({ requireSession }) {
  const router = Router();
  const admin = [requireSession, requireTwoFactor, requireAdmin];
  const judge = [requireSession, requireTwoFactor, requireJudge];
  const observer = [requireSession, requireTwoFactor, requireVotingObserver];
  router.post(
    "/events/:eventId/nights/:nightId/voting/open",
    ...admin,
    async (request, response) => {
      try {
        const result = await openVoting({
          actorUserId: request.user.id,
          eventId: request.params.eventId,
          nightId: request.params.nightId,
        });
        response.status(201).json(result);
      } catch (error) {
        if (sendKnownError(response, error)) return;
        throw error;
      }
    },
  );

  router.post(
    "/events/:eventId/nights/:nightId/voting/close",
    ...admin,
    async (request, response) => {
      try {
        const result = await closeVoting({
          actorUserId: request.user.id,
          eventId: request.params.eventId,
          nightId: request.params.nightId,
        });
        response.status(200).json(result);
      } catch (error) {
        if (sendKnownError(response, error)) return;
        throw error;
      }
    },
  );

  router.get(
    "/events/:eventId/nights/:nightId/voting/status",
    ...observer,
    async (request, response) => {
      try {
        const result = await getVotingStatus({
          eventId: request.params.eventId,
          nightId: request.params.nightId,
        });
        response.json(result);
      } catch (error) {
        if (sendKnownError(response, error)) return;
        throw error;
      }
    },
  );

  router.get(
    "/events/:eventId/nights/:nightId/voting/ballots",
    ...admin,
    async (request, response) => {
      try {
        const result = await listNightBallots({
          eventId: request.params.eventId,
          nightId: request.params.nightId,
        });
        response.json(result);
      } catch (error) {
        if (sendKnownError(response, error)) return;
        throw error;
      }
    },
  );

  router.get(
    "/judge/ballots",
    ...judge,
    async (request, response) => {
      try {
        response.json(await listJudgeBallots({ userId: request.user.id }));
      } catch (error) {
        if (sendKnownError(response, error)) return;
        throw error;
      }
    },
  );

  router.get(
    "/judge/ballots/:ballotId",
    ...judge,
    async (request, response) => {
      try {
        const result = await getBallot({
          ballotId: request.params.ballotId,
          userId: request.user.id,
        });
        response.json(result);
      } catch (error) {
        if (sendKnownError(response, error)) return;
        throw error;
      }
    },
  );

  router.put(
    "/judge/ballots/:ballotId/scores/:scoreId",
    ...judge,
    async (request, response) => {
      try {
        const result = await saveScore({
          actorUserId: request.user.id,
          ballotId: request.params.ballotId,
          scoreId: request.params.scoreId,
          evaluationState: request.body?.evaluationState,
          score: request.body?.score,
        });
        response.json(result);
      } catch (error) {
        if (sendKnownError(response, error)) return;
        throw error;
      }
    },
  );

  router.post(
    "/judge/ballots/:ballotId/sync",
    ...judge,
    async (request, response) => {
      try {
        const result = await syncBallot({
          actorUserId: request.user.id,
          ballotId: request.params.ballotId,
          baseRevision: request.body?.baseRevision,
          operations: request.body?.operations,
        });
        response.json(result);
      } catch (error) {
        if (error.message === "BALLOT_REVISION_CONFLICT") {
          error.details = {
            ...error.details,
            ballot: await getBallot({ ballotId: request.params.ballotId, userId: request.user.id }),
          };
        }
        if (sendKnownError(response, error)) return;
        throw error;
      }
    },
  );

  router.post(
    "/judge/ballots/:ballotId/submit",
    ...judge,
    async (request, response) => {
      try {
        const result = await submitBallot({
          actorUserId: request.user.id,
          ballotId: request.params.ballotId,
        });
        response.status(200).json(result);
      } catch (error) {
        if (sendKnownError(response, error)) return;
        throw error;
      }
    },
  );

  return router;
}
