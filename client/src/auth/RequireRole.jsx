import { RequireAnyRole } from "./RequireAnyRole.jsx";

export function RequireRole({
  session,
  role,
  deniedMessage = "No tenés permisos para acceder a esta sección.",
  children,
}) {
  return (
    <RequireAnyRole
      session={session}
      allowedRoles={role ? [role] : []}
      deniedMessage={deniedMessage}
    >
      {children}
    </RequireAnyRole>
  );
}
