import { Router } from "express";
import { requireTwoFactor } from "../auth/two-factor.js";
import { requireAdmin } from "../auth/require-admin.js";
import * as controller from "../modules/operational-profiles/operational-profile-controller.js";

export function createOperationalProfilesRouter({ requireSession, sendInvitation }) {
  const router = Router();
  const admin = [requireSession, requireTwoFactor, requireAdmin];

  router.get("/operational-profiles", ...admin, controller.listProfiles);
  router.post("/operational-profiles", ...admin, (req, res, next) => {
    req.sendInvitation = sendInvitation;
    return controller.createProfile(req, res, next);
  });
  router.post("/operational-profiles/:profileId/invitations", ...admin, (req, res, next) => {
    req.sendInvitation = sendInvitation;
    return controller.reissueInvitation(req, res, next);
  });
  router.delete("/operational-profiles/:profileId/invitations/:invitationId", ...admin, controller.revokeInvitation);
  router.post("/operational-profiles/:profileId/suspend", ...admin, controller.suspendProfile);
  router.post("/operational-profiles/:profileId/reactivate", ...admin, controller.reactivateProfile);

  router.post("/operational-invitations/inspect", controller.inspectInvitation);
  router.post("/operational-invitations/accept", controller.acceptInvitation);

  return router;
}
