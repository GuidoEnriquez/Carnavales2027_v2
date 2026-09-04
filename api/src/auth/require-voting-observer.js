import { getPool } from "../db/pool.js";

export async function requireVotingObserver(request, response, next) {
  try {
    const { rows } = await getPool().query(
      `SELECT ur.role_code
         FROM user_role ur
        WHERE ur.user_id = $1
          AND (
            ur.role_code = 'ADMIN'
            OR (
              ur.role_code = 'VEEDOR'
              AND EXISTS (
                SELECT 1
                  FROM operational_profile op
                  JOIN operational_profile_role opr
                    ON opr.operational_profile_id = op.id
                 WHERE op.user_id = ur.user_id
                   AND op.registration_status = 'REGISTERED'
                   AND opr.role_code = 'VEEDOR'
              )
            )
          )
        ORDER BY ur.role_code`,
      [request.user.id],
    );
    if (rows.length === 0) return response.status(403).json({ code: "VEEDOR_REQUIRED" });
    request.roles = rows.map((row) => row.role_code);
    return next();
  } catch (error) {
    return next(error);
  }
}
