import { getPool } from "../db/pool.js";

export async function requireScrutineer(request, response, next) {
  try {
    const { rows } = await getPool().query(
      "SELECT role_code FROM user_role WHERE user_id = $1 AND role_code = 'SCRUTINEER'",
      [request.user.id],
    );
    if (rows.length === 0) return response.status(403).json({ code: "SCRUTINEER_REQUIRED" });
    request.roles = ["SCRUTINEER"];
    return next();
  } catch (error) {
    return next(error);
  }
}
