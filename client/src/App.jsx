import { RequireAdmin } from "./auth/RequireAdmin.jsx";
import { useSession } from "./auth/session-context.jsx";
import { AdminEventsPage } from "./pages/AdminEventsPage.jsx";
import { LoginPage } from "./pages/LoginPage.jsx";

export default function App({ session: providedSession }) {
  const contextSession = useSession();
  const session = providedSession ?? contextSession;
  const path = window.location.hash || "#/login";
  if (path === "#/admin/events") {
    // UX guard only; API remains the authorization boundary.
    return <RequireAdmin session={session}><AdminEventsPage /></RequireAdmin>;
  }
  return <LoginPage />;
}
