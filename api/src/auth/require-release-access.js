import { getPool } from "../db/pool.js";

export async function requireReleaseAccess(request, response, next) {
  try {
    const { rows } = await getPool().query(
      "SELECT role_code FROM user_role WHERE user_id = $1 AND role_code IN ('SCRUTINEER', 'ESCRIBANO')",
      [request.user.id],
    );
    if (rows.length === 0) {
      const { rows: adminRows } = await getPool().query(
        "SELECT 1 FROM user_role WHERE user_id = $1 AND role_code = 'ADMIN'",
        [request.user.id],
      );
      if (adminRows.length > 0) {
        return response.status(403).json({ code: "RESULTS_RELEASE_FORBIDDEN_FOR_ADMIN" });
      }
      return response.status(403).json({ code: "RESULTS_ACCESS_DENIED" });
    }
    request.roles = rows.map((row) => row.role_code);
    return next();
  } catch (error) {
    return next(error);
  }
}
