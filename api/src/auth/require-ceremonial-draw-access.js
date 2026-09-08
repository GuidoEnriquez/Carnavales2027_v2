/**
 * Verifica que el usuario autenticado tenga uno de los roles permitidos.
 * Usado por el endpoint de sorteo ceremonial (Spec 011), exclusivo de
 * SCRUTINEER o ESCRIBANO.
 *
 * `ADMIN` queda deliberadamente fuera (RF-103, corregido 2026-09-07): la
 * separación de funciones ya aplicada a liberar resultados
 * (`RESULTS_RELEASE_FORBIDDEN_FOR_ADMIN`) y certificar el acta
 * (`OFFICIAL_RECORD_EMISSION_FORBIDDEN_FOR_ADMIN`) también cubre el sorteo
 * ceremonial. Hasta esa fecha el middleware admitía `ADMIN` por error: la
 * spec y `clarifications.md` siempre exigieron 403 para `ADMIN`, pero la
 * implementación y `validation.md` (2026-09-02) certificaron la versión
 * incorrecta. Ver decisión del responsable en `clarifications.md`.
 *
 * Comportamiento idéntico al de `requireResultsAccess`: setea `request.roles`
 * con la lista de roles del usuario y delega al siguiente middleware si pasa.
 */

import { getPool } from "../db/pool.js";

const ALLOWED_ROLES = ["SCRUTINEER", "ESCRIBANO"];

export async function requireCeremonialDrawAccess(request, response, next) {
  try {
    const { rows } = await getPool().query(
      `SELECT role_code FROM user_role
       WHERE user_id = $1 AND role_code = ANY($2::text[])`,
      [request.user.id, ALLOWED_ROLES],
    );
    if (rows.length === 0) {
      return response.status(403).json({ code: "RESULTS_ACCESS_DENIED" });
    }
    request.roles = rows.map((row) => row.role_code);
    return next();
  } catch (error) {
    return next(error);
  }
}
