import * as operationalProfileService from "./operational-profile-service.js";

export const listProfiles = async (req, res, next) => {
  try {
    const profiles = await operationalProfileService.listOperationalProfiles();
    res.json(profiles);
  } catch (error) {
    next(error);
  }
};

export const createProfile = async (req, res, next) => {
  try {
    const { name, email, documentNumber, roleCodes } = req.body;
    if (!name || !email || !documentNumber || !roleCodes) {
      return res.status(400).json({ code: "BAD_REQUEST", message: "name, email, documentNumber y roleCodes son requeridos" });
    }
    const result = await operationalProfileService.createOperationalProfile({
      actorUserId: req.user.id,
      name,
      email,
      documentNumber,
      roleCodes,
      sendInvitation: req.sendInvitation,
    });
    res.status(201).json(result);
  } catch (error) {
    if (error.code === "INVALID_OPERATIONAL_ROLE") {
      return res.status(400).json({ code: error.code });
    }
    if (error.message === "ACCOUNT_ALREADY_EXISTS") {
      return res.status(409).json({ code: "ACCOUNT_ALREADY_EXISTS" });
    }
    if (error.code === "PROFILE_ALREADY_EXISTS") {
      return res.status(409).json({ code: "PROFILE_ALREADY_EXISTS" });
    }
    if (error.message === "INVITATION_DELIVERY_FAILED") {
      return res.status(202).json({ code: "INVITATION_DELIVERY_FAILED" });
    }
    next(error);
  }
};

export const reissueInvitation = async (req, res, next) => {
  try {
    const result = await operationalProfileService.reissueOperationalInvitation({
      actorUserId: req.user.id,
      operationalProfileId: req.params.profileId,
      sendInvitation: req.sendInvitation,
    });
    res.json(result);
  } catch (error) {
    if (error.message === "OPERATIONAL_PROFILE_NOT_FOUND") {
      return res.status(404).json({ code: "OPERATIONAL_PROFILE_NOT_FOUND" });
    }
    if (error.message === "INVALID_OPERATIONAL_STATUS") {
      return res.status(409).json({ code: "INVALID_OPERATIONAL_STATUS" });
    }
    if (error.message === "INVITATION_DELIVERY_FAILED") {
      return res.status(202).json({ code: "INVITATION_DELIVERY_FAILED" });
    }
    next(error);
  }
};

export const revokeInvitation = async (req, res, next) => {
  try {
    const result = await operationalProfileService.revokeOperationalInvitation({
      actorUserId: req.user.id,
      operationalProfileId: req.params.profileId,
      invitationId: req.params.invitationId,
    });
    res.json(result);
  } catch (error) {
    if (error.message === "INVITATION_INVALID") {
      return res.status(400).json({ code: "INVITATION_INVALID" });
    }
    next(error);
  }
};

export const suspendProfile = async (req, res, next) => {
  try {
    const result = await operationalProfileService.suspendOperationalProfile({
      actorUserId: req.user.id,
      operationalProfileId: req.params.profileId,
    });
    res.json(result);
  } catch (error) {
    if (error.message === "OPERATIONAL_PROFILE_NOT_FOUND") {
      return res.status(404).json({ code: "OPERATIONAL_PROFILE_NOT_FOUND" });
    }
    if (error.message === "INVALID_OPERATIONAL_STATUS") {
      return res.status(409).json({ code: "INVALID_OPERATIONAL_STATUS" });
    }
    next(error);
  }
};

export const reactivateProfile = async (req, res, next) => {
  try {
    const result = await operationalProfileService.reactivateOperationalProfile({
      actorUserId: req.user.id,
      operationalProfileId: req.params.profileId,
    });
    res.json(result);
  } catch (error) {
    if (error.message === "OPERATIONAL_PROFILE_NOT_FOUND") {
      return res.status(404).json({ code: "OPERATIONAL_PROFILE_NOT_FOUND" });
    }
    if (error.message === "INVALID_OPERATIONAL_STATUS") {
      return res.status(409).json({ code: "INVALID_OPERATIONAL_STATUS" });
    }
    next(error);
  }
};

export const inspectInvitation = async (req, res, next) => {
  try {
    const { secret } = req.body ?? {};
    if (!secret) {
      return res.status(400).json({ code: "BAD_REQUEST", message: "secret es requerido" });
    }
    const invitation = await operationalProfileService.inspectOperationalInvitation({ secret });
    res.json(invitation);
  } catch (error) {
    if (error.message === "INVITATION_INVALID") {
      return res.status(400).json({ code: "INVITATION_INVALID" });
    }
    next(error);
  }
};

export const acceptInvitation = async (req, res, next) => {
  try {
    const { secret, password } = req.body;
    if (!secret || !password) {
      return res.status(400).json({ code: "BAD_REQUEST", message: "secret y password son requeridos" });
    }
    const input = { secret, password };
    if (req.createUser) input.createUser = req.createUser;
    const result = await operationalProfileService.acceptOperationalInvitation(input);
    res.status(201).json(result);
  } catch (error) {
    if (error.message === "INVITATION_INVALID") {
      return res.status(400).json({ code: "INVITATION_INVALID" });
    }
    next(error);
  }
};
