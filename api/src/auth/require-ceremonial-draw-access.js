/**
 * Verifica que el usuario autenticado tenga uno de los roles permitidos.
 * Usado por el endpoint de sorteo ceremonial (Spec 011) que admite
 * SCRUTINEER exclusivamente. En la UI se presenta como "Escrutador / Escribano".
 *
 * Comportamiento idéntico al de `requireResultsAccess`: setea `request.roles`
 * con la lista de roles del usuario y delega al siguiente middleware si pasa.
 */

import { getPool } from "../db/pool.js";

const ALLOWED_ROLES = ["SCRUTINEER"];

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
