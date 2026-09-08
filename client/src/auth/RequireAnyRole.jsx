/**
 * RequireAnyRole — Guard de autorización unificado (Spec 020 / RF-179)
 * Verifica el estado de la sesión y autoriza si el usuario posee al menos uno de los roles requeridos.
 */
export function RequireAnyRole({
  session,
  allowedRoles = [],
  deniedMessage = "No tenés permisos para acceder a esta sección.",
  children,
}) {
  if (!session || session.status === "loading") {
    return <p>Cargando sesión…</p>;
  }

  if (session.status === "anonymous") {
    return (
      <p>
        Iniciá sesión para continuar. <a href="#/login">Ir al inicio de sesión</a>
      </p>
    );
  }

  if (session.status === "second-factor-required") {
    return (
      <p>
        Completá la verificación en dos pasos. <a href="#/login">Verificar identidad</a>
      </p>
    );
  }

  if (session.status === "error") {
    return <p>No se pudo verificar la sesión. Intentá nuevamente.</p>;
  }

  const hasRole = Array.isArray(allowedRoles) && allowedRoles.some((role) => session.roles?.includes(role));

  if (!hasRole) {
    return <p>{deniedMessage}</p>;
  }

  return children;
}
