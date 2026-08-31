import { createContext, useContext, useEffect, useRef, useState } from "react";
import { apiRequest } from "../api/http.js";
import { clearUserOfflineData } from "../offline/ballot-store.js";

const SessionContext = createContext({
  status: "loading",
  roles: [],
  user: null,
  judgeProfile: null,
  refresh: async () => ({ status: "anonymous", roles: [] }),
  clear: () => {},
});
export const useSession = () => useContext(SessionContext);

export function SessionProvider({ children }) {
  const [session, setSession] = useState({ status: "loading", roles: [], user: null, judgeProfile: null });
  const requestRevision = useRef(0);
  const activeUserId = useRef(null);
  const refresh = async () => {
    const revision = ++requestRevision.current;
    try {
      const data = await apiRequest("/api/v1/me");
      if (activeUserId.current && activeUserId.current !== data.user?.id) {
        await clearUserOfflineData(activeUserId.current);
      }
      activeUserId.current = data.user?.id ?? null;
      const next = { status: "authenticated", ...data };
      if (revision === requestRevision.current) setSession(next);
      return next;
    } catch (error) {
      const status = error.code === "UNAUTHENTICATED"
        ? "anonymous"
        : error.code === "TWO_FACTOR_REQUIRED"
          ? "second-factor-required"
          : "error";
      const next = { status, roles: [], user: null, judgeProfile: null };
      if (revision === requestRevision.current) setSession(next);
      return next;
    }
  };
  useEffect(() => {
    void refresh();
    return () => { requestRevision.current += 1; };
  }, []);
  return <SessionContext.Provider value={{
    ...session,
    refresh,
      clear: () => {
        requestRevision.current += 1;
        if (activeUserId.current) void clearUserOfflineData(activeUserId.current);
        activeUserId.current = null;
        setSession({ status: "anonymous", roles: [], user: null, judgeProfile: null });
    },
  }}>{children}</SessionContext.Provider>;
}
