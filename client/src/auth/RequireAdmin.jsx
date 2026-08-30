import { RequireRole } from "./RequireRole.jsx";

export function RequireAdmin({ session, children }) {
  return <RequireRole session={session} role="ADMIN" deniedMessage="No tenés permisos de administración">{children}</RequireRole>;
}
