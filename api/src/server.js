import "dotenv/config";
import { toNodeHandler } from "better-auth/node";
import { createApp } from "./app.js";
import { auth } from "./auth/auth.js";
import { closePool } from "./db/pool.js";

const port = Number(process.env.PORT) || 3000;
const app = createApp({
  authHandler: toNodeHandler(auth),
  getSession: auth.api.getSession,
});

export const server = app.listen(port, () => {
  console.log(`API listening on http://localhost:${port}`);
});

let isShuttingDown = false;
export async function gracefulShutdown(signal) {
  if (isShuttingDown) return;
  isShuttingDown = true;
  console.log(`Recibida señal ${signal}. Iniciando apagado ordenado (graceful shutdown)...`);

  const shutdownTimeout = setTimeout(() => {
    console.error("Timeout de apagado superado (5s). Forzando salida.");
    process.exit(1);
  }, 5000);
  shutdownTimeout.unref();

  server.close(async (err) => {
    if (err) {
      console.error("Error al cerrar el servidor HTTP:", err);
    }
    try {
      await closePool();
      console.log("Conexiones a base de datos cerradas. Servidor detenido.");
      process.exit(0);
    } catch (poolErr) {
      console.error("Error al cerrar el pool de base de datos:", poolErr);
      process.exit(1);
    }
  });
}

process.on("SIGINT", () => gracefulShutdown("SIGINT"));
process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
