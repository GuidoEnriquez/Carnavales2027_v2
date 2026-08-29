export function RequireAdmin({ session, children }) {
  if (session.status === "loading") return <p>Cargando sesión…</p>;
  if (session.status === "anonymous") return <p>Iniciá sesión para continuar</p>;
  if (!session.roles?.includes("ADMIN")) return <p>No tenés permisos de administración</p>;
  return children;
}
