import express from "express";
import { createRequireSession } from "./auth/require-session.js";
import { createMeRouter } from "./routes/me.routes.js";
import { createEventsRouter } from "./routes/events.routes.js";

export function createApp({ authHandler, getSession } = {}) {
  const app = express();
  app.use(express.json());

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
    app.use("/api/v1", createEventsRouter({
      requireSession: createRequireSession(getSession),
    }));
  }

  return app;
}
