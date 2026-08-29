import { getPool } from "../db/pool.js";

export async function requireAdmin(request, response, next) {
  const { rows } = await getPool().query(
    "SELECT role_code FROM user_role WHERE user_id = $1 ORDER BY role_code",
    [request.user.id],
  );
  const roles = rows.map((row) => row.role_code);

  if (!roles.includes("ADMIN")) {
    return response.status(403).json({ code: "ADMIN_REQUIRED" });
  }

  request.roles = roles;
  return next();
}
