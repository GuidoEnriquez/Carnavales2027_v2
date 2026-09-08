import { RequireAnyRole } from "./RequireAnyRole.jsx";

export function RequireVotingObserverRole({ session, children }) {
  return (
    <RequireAnyRole
      session={session}
      allowedRoles={["ADMIN", "VEEDOR"]}
      deniedMessage="No tenés permisos para acceder a la supervisión."
    >
      {children}
    </RequireAnyRole>
  );
}
