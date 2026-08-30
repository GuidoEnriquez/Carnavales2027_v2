export function RequireRole({ session, role, deniedMessage = "No tenés permisos para acceder a esta sección.", children }) {
  if (session.status === "loading") return <p>Cargando sesión…</p>;
  if (session.status === "anonymous") {
    return <p>Iniciá sesión para continuar. <a href="#/login">Ir al inicio de sesión</a></p>;
  }
  if (session.status === "second-factor-required") {
    return <p>Completá la verificación en dos pasos. <a href="#/login">Verificar identidad</a></p>;
  }
  if (session.status === "error") return <p>No se pudo verificar la sesión. Intentá nuevamente.</p>;
  if (!session.roles?.includes(role)) return <p>{deniedMessage}</p>;
  return children;
}
