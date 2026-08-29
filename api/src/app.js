import express from "express";
import { createRequireSession } from "./auth/require-session.js";
import { createMeRouter } from "./routes/me.routes.js";

export function createApp({ authHandler, getSession } = {}) {
  const app = express();

  app.get("/health", (_request, response) => {
    response.status(200).json({ status: "ok" });
  });

  if (authHandler) {
    app.all("/api/auth/*splat", authHandler);
  }

  if (getSession) {
    app.use("/api/v1", createMeRouter({
      requireSession: createRequireSession(getSession),
    }));
  }

  return app;
}
