import { useEffect, useRef, useState } from "react";
import { apiRequest } from "../api/http.js";
import { clearUserOfflineData } from "../offline/ballot-store.js";

export function AppNavigation({ session }) {
  const [closing, setClosing] = useState(false);
  const [message, setMessage] = useState("");
  const [open, setOpen] = useState(false);
  const [isDesktop, setIsDesktop] = useState(() =>
    typeof window.matchMedia === "function"
      ? window.matchMedia("(min-width: 64rem)").matches
      : false,
  );
  const [currentRoute, setCurrentRoute] = useState(() => window.location.hash.split("?")[0]);
  const toggleRef = useRef(null);
  const drawerRef = useRef(null);
  const drawerOpen = isDesktop || open;

  useEffect(() => {
    if (typeof window.matchMedia !== "function") return;
    const query = window.matchMedia("(min-width: 64rem)");
    const onChange = (event) => {
      setIsDesktop(event.matches);
      if (event.matches) setOpen(false);
    };
    query.addEventListener("change", onChange);
    return () => query.removeEventListener("change", onChange);
  }, []);

  useEffect(() => {
    const updateRoute = () => {
      setCurrentRoute(window.location.hash.split("?")[0]);
      setOpen(false);
    };
    window.addEventListener("hashchange", updateRoute);
    return () => window.removeEventListener("hashchange", updateRoute);
  }, []);

  useEffect(() => {
    if (!open || isDesktop) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const closeButton = drawerRef.current?.querySelector("[data-drawer-close]");
    closeButton?.focus();
    const onKeyDown = (event) => {
      if (event.key === "Escape") {
        event.stopPropagation();
        setOpen(false);
        toggleRef.current?.focus();
        return;
      }
      if (event.key === "Tab" && drawerRef.current) {
        const focusables = drawerRef.current.querySelectorAll(
          'a[href], button:not([disabled])',
        );
        if (focusables.length === 0) return;
        const first = focusables[0];
        const last = focusables[focusables.length - 1];
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open, isDesktop]);

  const closeDrawer = () => {
    setOpen(false);
    toggleRef.current?.focus();
  };

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
    <>
    <header className={`app-navigation ${session.roles?.includes("JUDGE") ? "judge-navigation" : ""}`}>
      {!isDesktop && (
      <button
        ref={toggleRef}
        className="nav-toggle"
        type="button"
        aria-expanded={open}
        aria-controls="app-drawer"
        aria-label={open ? "Cerrar menu de navegacion" : "Abrir menu de navegacion"}
        onClick={() => setOpen((value) => !value)}
      >
        <span aria-hidden="true">{open ? "✕" : "☰"}</span>
      </button>
      )}
      <a className="brand" href="#/home"><span>Carnavales</span> <strong>2027</strong></a>
      <div className="session-actions">
        <span>{session.user?.name}</span>
        <button className="secondary" type="button" disabled={closing} onClick={signOut}>Salir</button>
      </div>
      {message && <p className="navigation-feedback" role="alert">{message}</p>}
    </header>
    {open && !isDesktop && (
      <button
        className="app-drawer-backdrop"
        type="button"
        aria-label="Cerrar menu de navegacion"
        onClick={() => setOpen(false)}
      />
    )}
    <nav
      ref={drawerRef}
      id="app-drawer"
      className={`app-drawer${drawerOpen ? " is-open" : ""}`}
      aria-label="Navegacion principal"
      aria-hidden={!drawerOpen}
    >
      <div className="app-drawer-header">
        <span className="app-drawer-title">Menu</span>
        <button
          className="secondary app-drawer-close"
          type="button"
          data-drawer-close
          aria-label="Cerrar menu de navegacion"
          onClick={closeDrawer}
        >
          <span aria-hidden="true">✕</span>
        </button>
      </div>
        {session.roles?.includes("ADMIN") && <span className="nav-section-label">Administracion</span>}
        {session.roles?.includes("COMISARIO") && !session.roles?.includes("ADMIN") && <span className="nav-section-label">Comisariato</span>}
        {session.roles?.includes("ADMIN") && <a href="#/admin/events" aria-current={currentRoute === "#/admin/events" ? "page" : undefined}>Evento</a>}
        {session.roles?.includes("ADMIN") && <a href="#/admin/competencia" aria-current={currentRoute === "#/admin/competencia" ? "page" : undefined}>Competencia</a>}
        {session.roles?.includes("ADMIN") && <a href="#/admin/judges" aria-current={currentRoute === "#/admin/judges" ? "page" : undefined}>Personas</a>}
        {session.roles?.includes("ADMIN") && <a href="#/admin/assignments" aria-current={currentRoute === "#/admin/assignments" ? "page" : undefined}>Asignaciones</a>}
        {session.roles?.includes("ADMIN") && <a href="#/admin/voting" aria-current={currentRoute === "#/admin/voting" ? "page" : undefined}>Votacion</a>}
        {["ADMIN", "COMISARIO"].some((role) => session.roles?.includes(role)) && <a href="#/admin/penalties" aria-current={currentRoute === "#/admin/penalties" ? "page" : undefined}>Penalizaciones</a>}
        {["ADMIN", "SCRUTINEER", "ESCRIBANO"].some((role) => session.roles?.includes(role)) && <a href="#/admin/results" aria-current={currentRoute === "#/admin/results" ? "page" : undefined}>Escrutinio</a>}
        {["ADMIN", "SCRUTINEER", "ESCRIBANO"].some((role) => session.roles?.includes(role)) && <a href="#/admin/record" aria-current={currentRoute === "#/admin/record" ? "page" : undefined}>Acta Oficial</a>}
        {session.roles?.includes("JUDGE") && <a href="#/judge" aria-current={currentRoute === "#/judge" ? "page" : undefined}>Mi panel</a>}
        {(session.roles?.includes("ADMIN") || session.roles?.includes("VEEDOR")) && <a href="#/veedor" aria-current={currentRoute === "#/veedor" ? "page" : undefined}>Supervision</a>}
        <a href="#/resultados" aria-current={currentRoute === "#/resultados" ? "page" : undefined}>Resultados</a>
    </nav>
    </>
  );
}
