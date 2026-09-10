import { Router } from "express";
import { getLatestResultsSnapshot, listPublicEvents } from "../modules/results/snapshot-service.js";
import { subscribeMonitorEvents } from "../modules/monitor/monitor-event-bus.js";
import { sendKnownError } from "./http-errors.js";

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

// El canal público notifica únicamente materializaciones reales del snapshot
// (Spec 024/RF-213): una notificación por versión, garantizada post-commit.
// Las acciones de dominio (RESULTS_RELEASED, OFFICIAL_RECORD_EMITTED,
// RESULTS_TIE_BREAKER_CEREMONIAL_DRAW) quedan para el canal interno de monitor.
const PUBLIC_NOTIFY_ACTIONS = new Set([
  "RESULTS_SNAPSHOT_UPDATED",
]);

export function createPublicRouter() {
  const router = Router();

  /**
   * GET /events
   * Lista eventos que cuentan con resultados liberados o snapshots disponibles.
   */
  router.get("/events", async (_request, response) => {
    try {
      const events = await listPublicEvents();
      response.set("Cache-Control", "public, max-age=30, stale-while-revalidate=60");
      response.json({ events });
    } catch (error) {
      if (sendKnownError(response, error)) return;
      response.status(500).json({ code: "INTERNAL_ERROR" });
    }
  });

  /**
   * GET /events/:eventId/results
   * Consulta el snapshot de resultados más reciente con soporte de ETag / 304.
   */
  router.get("/events/:eventId/results", async (request, response) => {
    try {
      const { eventId } = request.params;
      if (!UUID_REGEX.test(eventId)) {
        return response.status(400).json({
          code: "INVALID_UUID",
          error: "El ID de evento no es válido.",
        });
      }

      const snapshot = await getLatestResultsSnapshot(eventId);
      if (!snapshot) {
        return response.status(404).json({
          code: "RESULTS_NOT_RELEASED",
          error: "Los resultados para este evento aún no han sido liberados.",
        });
      }

      const eTag = `"${snapshot.snapshotHash}"`;
      const clientETag = request.get("if-none-match");

      response.set("ETag", eTag);
      response.set("Cache-Control", "public, max-age=30, stale-while-revalidate=60");

      if (
        clientETag &&
        (clientETag === snapshot.snapshotHash ||
          clientETag === eTag ||
          clientETag === `W/${eTag}`)
      ) {
        return response.status(304).end();
      }

      return response.status(200).json({
        ...snapshot.payload,
        snapshotHash: snapshot.snapshotHash,
        version: snapshot.version,
      });
    } catch (error) {
      if (sendKnownError(response, error)) return;
      return response.status(500).json({ code: "INTERNAL_ERROR" });
    }
  });

  /**
   * GET /stream
   * Canal SSE en tiempo real para clientes públicos (sin autenticación).
   */
  router.get("/stream", (request, response) => {
    response.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    });

    response.write(
      `event: connected\ndata: ${JSON.stringify({ status: "connected", timestamp: new Date().toISOString() })}\n\n`,
    );
    if (typeof response.flush === "function") {
      response.flush();
    }

    const pingTimer = setInterval(() => {
      response.write(": ping\n\n");
      if (typeof response.flush === "function") {
        response.flush();
      }
    }, 25000);

    const unsubscribe = subscribeMonitorEvents((event) => {
      const action = event.type || event.action;
      if (PUBLIC_NOTIFY_ACTIONS.has(action)) {
        response.write(
          `event: results_updated\ndata: ${JSON.stringify({ eventId: event.eventId, version: event.version })}\n\n`,
        );
        if (typeof response.flush === "function") {
          response.flush();
        }
      }
    });

    request.on("close", () => {
      clearInterval(pingTimer);
      unsubscribe();
    });
  });

  return router;
}
