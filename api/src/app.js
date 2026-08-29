import express from "express";

export function createApp({ authHandler } = {}) {
  const app = express();

  app.get("/health", (_request, response) => {
    response.status(200).json({ status: "ok" });
  });

  if (authHandler) {
    app.all("/api/auth/*splat", authHandler);
  }

  return app;
}
