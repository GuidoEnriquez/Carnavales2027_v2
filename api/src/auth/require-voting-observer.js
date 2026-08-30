import { getPool } from "../db/pool.js";

export async function requireVotingObserver(request, response, next) {
  try {
    const { rows } = await getPool().query(
      "SELECT role_code FROM user_role WHERE user_id = $1 AND role_code IN ('ADMIN', 'VEEDOR')",
      [request.user.id],
    );
    if (rows.length === 0) return response.status(403).json({ code: "VEEDOR_REQUIRED" });
    request.roles = rows.map((row) => row.role_code);
    return next();
  } catch (error) {
    return next(error);
  }
}
