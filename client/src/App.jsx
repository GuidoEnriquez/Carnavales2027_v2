import { RequireAdmin } from "./auth/RequireAdmin.jsx";
import { RequireRole } from "./auth/RequireRole.jsx";
import { RequireResultsRole } from "./auth/RequireResultsRole.jsx";
import { RequirePenaltiesRole } from "./auth/RequirePenaltiesRole.jsx";
import { RequireVotingObserverRole } from "./auth/RequireVotingObserverRole.jsx";
import { useSession } from "./auth/session-context.jsx";
import { AppNavigation } from "./components/AppNavigation.jsx";
import { AdminEventsPage } from "./pages/AdminEventsPage.jsx";
import { AdminHomePage } from "./pages/AdminHomePage.jsx";
import { AdminCompetenciaPage } from "./pages/AdminCompetenciaPage.jsx";
import { AdminJudgesPage } from "./pages/AdminJudgesPage.jsx";
import { AdminAssignmentsPage } from "./pages/AdminAssignmentsPage.jsx";
import { AdminVotingPage } from "./pages/AdminVotingPage.jsx";
import { AdminPenaltiesPage } from "./pages/AdminPenaltiesPage.jsx";
import { AdminResultsPage } from "./pages/AdminResultsPage.jsx";
import { OfficialRecordPage } from "./pages/OfficialRecordPage.jsx";
import { AcceptedJudgeInvitationPage, AcceptJudgeInvitationPage } from "./pages/AcceptJudgeInvitationPage.jsx";
import { AcceptRoleInvitationPage } from "./pages/AcceptRoleInvitationPage.jsx";
import { AcceptOperationalInvitationPage } from "./pages/AcceptOperationalInvitationPage.jsx";
import { JudgeHomePage } from "./pages/JudgeHomePage.jsx";
import { JudgeBallotPage } from "./pages/JudgeBallotPage.jsx";
import { JudgeAssignmentPage } from "./pages/JudgeAssignmentPage.jsx";
import { VeedorMonitorPage } from "./pages/VeedorMonitorPage.jsx";
import { LoginPage } from "./pages/LoginPage.jsx";
import { PublicResultsPage } from "./pages/PublicResultsPage.jsx";
import { apiRequest } from "./api/http.js";
import { EventCard } from "./components/EventCard.jsx";
import { AdminEventProvider, useAdminEvent } from "./context/AdminEventContext.jsx";
import { useEffect, useState } from "react";

function ProtectedShell({ session, children }) {
  const shell = <><AppNavigation session={session} />{children}</>;
  return session.roles?.includes("ADMIN") ? <AdminEventProvider>{shell}</AdminEventProvider> : shell;
}

function AdminCompetenciaPageWrapper() {
  const adminEvent = useAdminEvent();
  const [events, setEvents] = useState([]);
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (adminEvent) return undefined;
    apiRequest("/api/v1/events").then((evts) => {
      setEvents(evts);
      if (evts.length === 1) setSelectedEvent(evts[0]);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [adminEvent]);

  if (adminEvent) {
    if (adminEvent.loading) return <main className="container"><p>Cargando evento activo...</p></main>;
    if (!adminEvent.activeEvent) return (
      <main className="container">
        <div className="card admin-empty-context">
          <p className="eyebrow">Competencia</p>
          <h1>Primero seleccioná un evento</h1>
          <p>La configuración de competencia pertenece a un evento.</p>
          <a className="button-link" href="#/admin/events">Seleccionar evento</a>
        </div>
      </main>
    );
    return <AdminCompetenciaPage event={adminEvent.activeEvent} onBack={() => { window.location.hash = "#/admin/events"; }} />;
  }

  if (loading) return <main className="container"><p>Cargando eventos...</p></main>;
  if (!selectedEvent) return (
    <main className="container">
      <div className="card">
        <h1>Competencia</h1>
        <p>Selecciona un evento para administrar su competencia.</p>
        <div className="event-picker-list" role="list">
          {events.map((e) => <EventCard key={e.id} event={e} onSelect={setSelectedEvent} />)}
        </div>
      </div>
    </main>
  );

  return <AdminCompetenciaPage event={selectedEvent} onBack={() => setSelectedEvent(null)} />;
}

function RoleArea({ session, role, admin = false, children }) {
  const content = admin
    ? <RequireAdmin session={session}>{children}</RequireAdmin>
    : <RequireRole session={session} role={role}>{children}</RequireRole>;
  return session.status === "authenticated"
    ? <ProtectedShell session={session}>{content}</ProtectedShell>
    : content;
}

export default function App({ session: providedSession }) {
  const contextSession = useSession();
  const session = providedSession ?? contextSession;
  const [path, setPath] = useState(window.location.hash || "#/login");
  useEffect(() => {
    const updatePath = () => setPath(window.location.hash || "#/login");
    window.addEventListener("hashchange", updatePath);
    return () => window.removeEventListener("hashchange", updatePath);
  }, []);
  const [route, query = ""] = path.split("?");
  const isBrandRoute =
    route === "#/login" ||
    route === "" ||
    route.startsWith("#/invitations") ||
    route === "#/resultados";
  const currentLayer = isBrandRoute ? "brand" : "instrument";

  const renderContent = () => {
    if (route === "#/resultados") {
      const eventId = new URLSearchParams(query).get("eventId") ?? null;
      return <PublicResultsPage initialEventId={eventId} />;
    }
    if (route === "#/invitations/accept") {
      const secret = new URLSearchParams(query).get("secret") ?? "";
      return <AcceptJudgeInvitationPage key={secret} secret={secret} />;
    }
    if (route === "#/invitations/role/accept") {
      const token = new URLSearchParams(query).get("token") ?? "";
      return <AcceptRoleInvitationPage key={token} token={token} />;
    }
    if (route === "#/invitations/operational/accept") {
      const secret = new URLSearchParams(query).get("secret") ?? "";
      return <AcceptOperationalInvitationPage key={secret} secret={secret} />;
    }
    if (route === "#/invitations/accepted") return <AcceptedJudgeInvitationPage />;
    if (route === "#/login" || route === "") return <LoginPage />;
  if (route === "#/judge/assignment") {
    return <RoleArea session={session} role="JUDGE"><JudgeAssignmentPage session={session} /></RoleArea>;
  }
  if (route === "#/admin/home") {
    return <RoleArea session={session} admin><AdminHomePage /></RoleArea>;
  }
  if (route === "#/admin/events") {
    return <RoleArea session={session} admin><AdminEventsPage /></RoleArea>;
  }
  if (route === "#/admin/competencia") {
    return <RoleArea session={session} admin><AdminCompetenciaPageWrapper /></RoleArea>;
  }
  if (route === "#/admin/judges") {
    return <RoleArea session={session} admin><AdminJudgesPage /></RoleArea>;
  }
  if (route === "#/admin/assignments") {
    return <RoleArea session={session} admin><AdminAssignmentsPage /></RoleArea>;
  }
  if (route === "#/admin/voting") {
    return <RoleArea session={session} admin><AdminVotingPage /></RoleArea>;
  }
  if (route === "#/admin/penalties") {
    const content = <RequirePenaltiesRole session={session}><AdminPenaltiesPage /></RequirePenaltiesRole>;
    return session.status === "authenticated"
      ? <ProtectedShell session={session}>{content}</ProtectedShell>
      : content;
  }
  if (route === "#/admin/results") {
    const content = <RequireResultsRole session={session}><AdminResultsPage /></RequireResultsRole>;
    return session.status === "authenticated"
      ? <ProtectedShell session={session}>{content}</ProtectedShell>
      : content;
  }
  if (route === "#/admin/record") {
    const content = <RequireResultsRole session={session}><OfficialRecordPage /></RequireResultsRole>;
    return session.status === "authenticated"
      ? <ProtectedShell session={session}>{content}</ProtectedShell>
      : content;
  }
  if (route === "#/veedor") {
    const content = <RequireVotingObserverRole session={session}><VeedorMonitorPage /></RequireVotingObserverRole>;
    return session.status === "authenticated"
      ? <ProtectedShell session={session}>{content}</ProtectedShell>
      : content;
  }
  if (route === "#/judge") {
    return <RoleArea session={session} role="JUDGE"><JudgeHomePage session={session} /></RoleArea>;
  }
  if (route === "#/judge/ballot") {
    return <RoleArea session={session} role="JUDGE"><JudgeBallotPage ballotId={new URLSearchParams(query).get("ballotId") ?? ""} troupeId={new URLSearchParams(query).get("troupeId") ?? ""} userId={session.user?.id ?? ""} /></RoleArea>;
  }
    return <main id="main-content" className="container"><div className="card"><h1>Página no encontrada</h1><a href="#/login">Volver al inicio</a></div></main>;
  };

  return (
    <div className="app-shell" data-layer={currentLayer}>
      {renderContent()}
    </div>
  );
}
