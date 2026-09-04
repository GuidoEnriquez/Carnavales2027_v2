import { RequireAdmin } from "./auth/RequireAdmin.jsx";
import { RequireRole } from "./auth/RequireRole.jsx";
import { RequireResultsRole } from "./auth/RequireResultsRole.jsx";
import { RequirePenaltiesRole } from "./auth/RequirePenaltiesRole.jsx";
import { RequireVotingObserverRole } from "./auth/RequireVotingObserverRole.jsx";
import { useSession } from "./auth/session-context.jsx";
import { AppNavigation } from "./components/AppNavigation.jsx";
import { AdminEventsPage } from "./pages/AdminEventsPage.jsx";
import { AdminJudgesPage } from "./pages/AdminJudgesPage.jsx";
import { AdminAssignmentsPage } from "./pages/AdminAssignmentsPage.jsx";
import { AdminVotingPage } from "./pages/AdminVotingPage.jsx";
import { AdminPenaltiesPage } from "./pages/AdminPenaltiesPage.jsx";
import { AdminResultsPage } from "./pages/AdminResultsPage.jsx";
import { OfficialRecordPage } from "./pages/OfficialRecordPage.jsx";
import { AcceptedJudgeInvitationPage, AcceptJudgeInvitationPage } from "./pages/AcceptJudgeInvitationPage.jsx";
import { AcceptRoleInvitationPage } from "./pages/AcceptRoleInvitationPage.jsx";
import { AcceptOperationalInvitationPage } from "./pages/AcceptOperationalInvitationPage.jsx";
import { HomePage } from "./pages/HomePage.jsx";
import { JudgeHomePage } from "./pages/JudgeHomePage.jsx";
import { JudgeBallotPage } from "./pages/JudgeBallotPage.jsx";
import { JudgeAssignmentPage } from "./pages/JudgeAssignmentPage.jsx";
import { VeedorMonitorPage } from "./pages/VeedorMonitorPage.jsx";
import { LoginPage } from "./pages/LoginPage.jsx";
import { useEffect, useState } from "react";

function ProtectedShell({ session, children }) {
  return <><AppNavigation session={session} />{children}</>;
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
  if (route === "#/admin/events") {
    // UX guard only; API remains the authorization boundary.
    return <RoleArea session={session} admin><AdminEventsPage /></RoleArea>;
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
  if (route === "#/home") {
    if (session.status === "loading") return <p>Cargando sesión…</p>;
    if (session.status !== "authenticated") return <LoginPage />;
    return <ProtectedShell session={session}><HomePage session={session} /></ProtectedShell>;
  }
  return <main className="container"><div className="card"><h1>Página no encontrada</h1><a href="#/home">Volver al inicio</a></div></main>;
}
