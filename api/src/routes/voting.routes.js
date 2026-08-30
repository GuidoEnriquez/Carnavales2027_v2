import { Router } from "express";
import { requireTwoFactor } from "../auth/two-factor.js";
import { requireAdmin } from "../auth/require-admin.js";
import { requireJudge } from "../auth/require-judge.js";
import { requireVotingObserver } from "../auth/require-voting-observer.js";
import { requireScrutineer } from "../auth/require-scrutineer.js";
import {
  openVoting,
  closeVoting,
  getVotingStatus,
  listJudgeBallots,
  getBallot,
  saveScore,
  submitBallot,
  reopenBallot,
  listNightBallots,
  markScoreOmission,
  recordScoreSubsanation,
} from "../modules/ballots/ballot-service.js";
import { sendKnownError } from "./http-errors.js";

export function createVotingRouter({ requireSession }) {
  const router = Router();
  const admin = [requireSession, requireTwoFactor, requireAdmin];
  const judge = [requireSession, requireTwoFactor, requireJudge];
  const observer = [requireSession, requireTwoFactor, requireVotingObserver];
  const scrutineer = [requireSession, requireTwoFactor, requireScrutineer];

  router.post(
    "/scrutiny/ballots/:ballotId/scores/:scoreId/omissions",
    ...scrutineer,
    async (request, response) => {
      try {
        response.status(200).json(await markScoreOmission({
          actorUserId: request.user.id,
          ballotId: request.params.ballotId,
          scoreId: request.params.scoreId,
          reason: request.body?.reason,
        }));
      } catch (error) {
        if (sendKnownError(response, error)) return;
        throw error;
      }
    },
  );

  router.post(
    "/scrutiny/ballots/:ballotId/scores/:scoreId/subsanations",
    ...scrutineer,
    async (request, response) => {
      try {
        response.status(201).json(await recordScoreSubsanation({
          actorUserId: request.user.id,
          ballotId: request.params.ballotId,
          scoreId: request.params.scoreId,
          reason: request.body?.reason,
        }));
      } catch (error) {
        if (sendKnownError(response, error)) return;
        throw error;
      }
    },
  );

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

  router.post(
    "/events/:eventId/ballots/:ballotId/reopen",
    ...admin,
    async (request, response) => {
      try {
        const result = await reopenBallot({
          actorUserId: request.user.id,
          eventId: request.params.eventId,
          ballotId: request.params.ballotId,
          reason: request.body?.reason,
        });
        response.status(200).json(result);
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
