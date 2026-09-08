import { RequireAnyRole } from "./RequireAnyRole.jsx";

export function RequirePenaltiesRole({ session, children }) {
  return (
    <RequireAnyRole
      session={session}
      allowedRoles={["ADMIN", "COMISARIO"]}
      deniedMessage="No tenés permisos para acceder a esta sección."
    >
      {children}
    </RequireAnyRole>
  );
}
