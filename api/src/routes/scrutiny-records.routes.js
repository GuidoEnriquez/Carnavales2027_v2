import { Router } from "express";
import { requireScrutinyCertificationAccess } from "../auth/require-scrutiny-certification-access.js";
import { requireResultsAccess } from "../auth/require-results-access.js";
import { requireTwoFactor } from "../auth/two-factor.js";
import {
  certifyScrutinyRecord,
  getOfficialScrutinyRecord,
} from "../modules/scrutiny-records/scrutiny-record-service.js";
import { sendKnownError } from "./http-errors.js";

export function createScrutinyRecordsRouter({ requireSession }) {
  const router = Router();
  const certifyAuthorized = [
    requireSession,
    requireTwoFactor,
    requireScrutinyCertificationAccess,
  ];
  const readAuthorized = [
    requireSession,
    requireTwoFactor,
    requireResultsAccess,
  ];

  /**
   * Emisión y certificación del Acta Oficial.
   * Exclusivo para SCRUTINEER y ESCRIBANO.
   */
  router.post("/events/:eventId/scrutiny-record", ...certifyAuthorized, async (request, response) => {
    try {
      const actorRole = request.roles.includes("ESCRIBANO") ? "ESCRIBANO" : "SCRUTINEER";
      const result = await certifyScrutinyRecord({
        eventId: request.params.eventId,
        actorUserId: request.user.id,
        actorRole,
      });

      const statusCode = result.alreadyCertified ? 200 : 201;
      return response.status(statusCode).json(result);
    } catch (error) {
      if (sendKnownError(response, error)) return;
      throw error;
    }
  });

  /**
   * Consulta del Acta Oficial con su validación de integridad criptográfica.
   * Permitido para ADMIN, SCRUTINEER, ESCRIBANO, COMISARIO y VEEDOR.
   */
  router.get("/events/:eventId/scrutiny-record", ...readAuthorized, async (request, response) => {
    try {
      const record = await getOfficialScrutinyRecord({ eventId: request.params.eventId });
      if (!record) {
        return response.status(404).json({ code: "OFFICIAL_RECORD_NOT_FOUND" });
      }
      return response.json(record);
    } catch (error) {
      if (sendKnownError(response, error)) return;
      throw error;
    }
  });

  return router;
}
