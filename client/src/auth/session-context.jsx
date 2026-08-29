import { createContext, useContext, useEffect, useState } from "react";
import { apiRequest } from "../api/http.js";

const SessionContext = createContext({ status: "loading", roles: [] });
export const useSession = () => useContext(SessionContext);

export function SessionProvider({ children }) {
  const [session, setSession] = useState({ status: "loading", roles: [] });
  useEffect(() => {
    apiRequest("/api/v1/me")
      .then((data) => setSession({ status: "authenticated", ...data }))
      .catch(() => setSession({ status: "anonymous", roles: [] }));
  }, []);
  return <SessionContext.Provider value={session}>{children}</SessionContext.Provider>;
}
