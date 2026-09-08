/**
 * role-routes.js — Mapeo centralizado de roles de usuario a sus rutas predeterminadas (Spec 020 / RF-179)
 */

export const ROLE_DEFAULT_ROUTES = {
  ADMIN: "#/admin/competencia",
  JUDGE: "#/judge",
  VEEDOR: "#/veedor",
  COMISARIO: "#/comisario/penalties",
  SCRUTINEER: "#/scrutineer/results",
  ESCRIBANO: "#/scrutineer/results",
};

/**
 * Determina la ruta por defecto según los roles que posee el usuario.
 * Sigue la prioridad de privilegios operativos.
 *
 * @param {string[]} roles
 * @returns {string} Hash route (ej. "#/judge")
 */
export function getDefaultRouteForRoles(roles = []) {
  if (!Array.isArray(roles) || roles.length === 0) {
    return "#/login";
  }

  // Prioridad: ADMIN -> JUDGE -> COMISARIO -> SCRUTINEER / ESCRIBANO -> VEEDOR
  const priority = ["ADMIN", "JUDGE", "COMISARIO", "SCRUTINEER", "ESCRIBANO", "VEEDOR"];

  for (const role of priority) {
    if (roles.includes(role)) {
      return ROLE_DEFAULT_ROUTES[role] || "#/";
    }
  }

  return "#/";
}
