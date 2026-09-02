import { useEffect, useState } from "react";
import { apiRequest } from "../api/http.js";
import { clearUserOfflineData } from "../offline/ballot-store.js";

export function AppNavigation({ session }) {
  const [closing, setClosing] = useState(false);
  const [message, setMessage] = useState("");
  const [currentRoute, setCurrentRoute] = useState(() => window.location.hash.split("?")[0]);
  const [online, setOnline] = useState(() => navigator.onLine);
  useEffect(() => {
    const updateRoute = () => setCurrentRoute(window.location.hash.split("?")[0]);
    window.addEventListener("hashchange", updateRoute);
    return () => window.removeEventListener("hashchange", updateRoute);
  }, []);
  useEffect(() => {
    const updateConnection = () => setOnline(navigator.onLine);
    window.addEventListener("online", updateConnection);
    window.addEventListener("offline", updateConnection);
    return () => {
      window.removeEventListener("online", updateConnection);
      window.removeEventListener("offline", updateConnection);
    };
  }, []);
  const signOut = async () => {
    setClosing(true);
    try {
      await apiRequest("/api/auth/sign-out", { method: "POST", body: "{}" });
      if (session.user?.id) await clearUserOfflineData(session.user.id);
      session.clear?.();
      window.location.hash = "#/login";
    } catch {
      setMessage("No se pudo cerrar la sesión. Tu acceso continúa activo.");
    } finally {
      setClosing(false);
    }
  };

  return (
    <header className={`app-navigation ${session.roles?.includes("JUDGE") ? "judge-navigation" : ""}`}>
      <a className="brand" href="#/home"><span>Carnavales</span> <strong>2027</strong></a>
      <nav aria-label="Navegación principal">
        {session.roles?.includes("ADMIN") && <span className="nav-section-label">Administración</span>}
        {session.roles?.includes("ADMIN") && <a href="#/admin/events" aria-current={currentRoute === "#/admin/events" ? "page" : undefined}>Evento</a>}
        {session.roles?.includes("ADMIN") && <a href="#/admin/judges" aria-current={currentRoute === "#/admin/judges" ? "page" : undefined}>Personas</a>}
        {session.roles?.includes("ADMIN") && <a href="#/admin/assignments" aria-current={currentRoute === "#/admin/assignments" ? "page" : undefined}>Asignaciones</a>}
        {session.roles?.includes("ADMIN") && <a href="#/admin/voting" aria-current={currentRoute === "#/admin/voting" ? "page" : undefined}>Votación</a>}
        {session.roles?.includes("SCRUTINEER") && <a href="#/admin/results" aria-current={currentRoute === "#/admin/results" ? "page" : undefined}>Escrutinio</a>}
        {session.roles?.includes("JUDGE") && <a href="#/judge" aria-current={currentRoute === "#/judge" ? "page" : undefined}>Mi panel</a>}
      </nav>
      <div className="session-actions">
        <span className={`connection-badge ${online ? "is-online" : "is-offline"}`} role="status">
          <span aria-hidden="true">{online ? "●" : "!"}</span> {online ? "Online" : "Sin conexión"}
        </span>
        <span>{session.user?.name}</span>
        <button className="secondary" type="button" disabled={closing} onClick={signOut}>Salir</button>
      </div>
      {message && <p className="navigation-feedback" role="alert">{message}</p>}
    </header>
  );
}
