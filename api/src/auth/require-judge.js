import { getPool } from "../db/pool.js";

export async function requireJudge(request, response, next) {
  try {
    const { rows } = await getPool().query(
      `SELECT jp.id, jp.registration_status AS "registrationStatus"
         FROM user_role ur
         LEFT JOIN judge_profile jp ON jp.user_id = ur.user_id
        WHERE ur.user_id = $1 AND ur.role_code = 'JUDGE'`,
      [request.user.id],
    );
    if (rows.length === 0) return response.status(403).json({ code: "JUDGE_REQUIRED" });
    if (!rows[0].id) return response.status(403).json({ code: "JUDGE_PROFILE_REQUIRED" });
    if (rows[0].registrationStatus === "SUSPENDED") {
      return response.status(403).json({ code: "JUDGE_SUSPENDED" });
    }
    if (rows[0].registrationStatus !== "REGISTERED") {
      return response.status(403).json({ code: "JUDGE_INACTIVE" });
    }
    request.judgeProfile = rows[0];
    return next();
  } catch (error) {
    return next(error);
  }
}
