import express from "express";
import { createRequireSession } from "./auth/require-session.js";
import { createMeRouter } from "./routes/me.routes.js";
import { createEventsRouter } from "./routes/events.routes.js";
import { createUsersRouter } from "./routes/users.routes.js";
import { createJudgesRouter } from "./routes/judges.routes.js";
import { createJudgeInvitationsRouter } from "./routes/judge-invitations.routes.js";
import { createJudgeRouter } from "./routes/judge.routes.js";
import { createAssignmentsRouter } from "./routes/assignments.routes.js";
import { sendKnownError } from "./routes/http-errors.js";
import { requireTrustedOrigin } from "./auth/trusted-origin.js";

export function createApp({
  authHandler,
  getSession,
  createUser,
  sendInvitation,
  revokeSessions,
} = {}) {
  const app = express();
  app.use(express.json());

  app.get("/health", (_request, response) => {
    response.status(200).json({ status: "ok" });
  });

  if (authHandler) {
    app.all("/api/auth/*splat", authHandler);
  }

  app.use("/api/v1", requireTrustedOrigin);
  app.use("/api/v1", createJudgeInvitationsRouter({ createUser }));

  if (getSession) {
    app.use("/api/v1", createAssignmentsRouter({
      requireSession: createRequireSession(getSession),
    }));
    app.use("/api/v1", createMeRouter({
      requireSession: createRequireSession(getSession),
    }));
    app.use("/api/v1", createJudgeRouter({
      requireSession: createRequireSession(getSession),
    }));
    app.use("/api/v1", createEventsRouter({
      requireSession: createRequireSession(getSession),
    }));
    app.use("/api/v1", createUsersRouter({
      requireSession: createRequireSession(getSession),
    }));
    app.use("/api/v1", createJudgesRouter({
      requireSession: createRequireSession(getSession),
      sendInvitation,
      revokeSessions,
    }));
  }

  app.use((error, _request, response, next) => {
    if (response.headersSent) return next(error);
    if (sendKnownError(response, error)) return undefined;
    response.status(500).json({ code: "INTERNAL_ERROR" });
    return undefined;
  });

  return app;
}
