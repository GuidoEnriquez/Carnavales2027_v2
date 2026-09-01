import * as userService from "./user-service.js";

export const listUsers = async (req, res, next) => {
  try {
    const users = await userService.listOperationalUsers();
    res.json(users);
  } catch (error) {
    next(error);
  }
};

export const inviteUser = async (req, res, next) => {
  try {
    const { email, roleCode } = req.body;
    if (!email || !roleCode) {
      return res.status(400).json({ code: "BAD_REQUEST", message: "Email y roleCode son requeridos" });
    }
    const invitation = await userService.inviteOperationalUser(email, roleCode, req.user.id);
    res.status(201).json(invitation);
  } catch (error) {
    next(error);
  }
};

export const getInvitation = async (req, res, next) => {
  try {
    const { token } = req.params;
    const invitation = await userService.getInvitationByToken(token);
    if (!invitation) return res.status(404).json({ code: "INVITATION_NOT_FOUND" });
    res.json(invitation);
  } catch (error) {
    next(error);
  }
};

export const acceptInvitation = async (req, res, next) => {
  try {
    const { token, password } = req.body;
    if (!token || !password) {
      return res.status(400).json({ code: "BAD_REQUEST", message: "Faltan datos" });
    }

    // req.createUser comes from router injection if we passed it, but wait!
    // We need to inject createUser in createUsersRouter like we did in createJudgeInvitationsRouter
    const result = await userService.acceptRoleInvitation({
      token,
      password,
      createUser: req.createUser,
    });
    res.status(201).json(result);
  } catch (error) {
    if (error.message === "INVITATION_INVALID") return res.status(400).json({ code: "INVITATION_INVALID" });
    next(error);
  }
};
