import { RequireAnyRole } from "./RequireAnyRole.jsx";

export function RequireResultsRole({ session, children }) {
  return (
    <RequireAnyRole
      session={session}
      allowedRoles={["ADMIN", "SCRUTINEER", "ESCRIBANO"]}
      deniedMessage="No tenés permisos para acceder a esta sección."
    >
      {children}
    </RequireAnyRole>
  );
}
