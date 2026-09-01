import { useState } from "react";
import { apiRequest } from "../api/http.js";
import { clearUserOfflineData } from "../offline/ballot-store.js";

export function AppNavigation({ session }) {
  const [closing, setClosing] = useState(false);
  const [message, setMessage] = useState("");
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
    <header className="app-navigation">
      <a className="brand" href="#/home">Carnavales <strong>2027</strong></a>
      <nav aria-label="Navegación principal">
        {session.roles?.includes("ADMIN") && <a href="#/admin/events">Eventos</a>}
        {session.roles?.includes("ADMIN") && <a href="#/admin/judges">Jurados</a>}
        {session.roles?.includes("ADMIN") && <a href="#/admin/users">Accesos</a>}
        {session.roles?.includes("ADMIN") && <a href="#/admin/assignments">Asignaciones</a>}
        {session.roles?.includes("ADMIN") && <a href="#/admin/voting">Votación</a>}
        {session.roles?.includes("JUDGE") && <a href="#/judge">Mi panel</a>}
      </nav>
      <div className="session-actions">
        <span>{session.user?.name}</span>
        <button className="secondary" type="button" disabled={closing} onClick={signOut}>Salir</button>
      </div>
      {message && <p className="navigation-feedback" role="alert">{message}</p>}
    </header>
  );
}
