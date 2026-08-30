import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { apiRequest } from "../api/http.js";
import { SessionProvider, useSession } from "../auth/session-context.jsx";

vi.mock("../api/http.js", () => ({ apiRequest: vi.fn() }));

function SessionState() {
  const session = useSession();
  return <><p>{session.status}:{session.roles.join(",")}:{session.user?.name ?? ""}</p><button onClick={session.clear}>Limpiar</button></>;
}

describe("SessionProvider", () => {
  afterEach(() => { cleanup(); vi.clearAllMocks(); });

  it("carga una sesión JUDGE sin exigir ADMIN", async () => {
    apiRequest.mockResolvedValue({
      user: { id: "u1", name: "Jurado", email: "jurado@example.test" },
      roles: ["JUDGE"],
      judgeProfile: { id: "j1", registrationStatus: "REGISTERED" },
    });
    render(<SessionProvider><SessionState /></SessionProvider>);
    expect(await screen.findByText("authenticated:JUDGE:Jurado")).toBeInTheDocument();
  });

  it("distingue anonimato, segundo factor y errores transitorios", async () => {
    apiRequest.mockRejectedValueOnce({ code: "UNAUTHENTICATED" });
    const first = render(<SessionProvider><SessionState /></SessionProvider>);
    expect(await screen.findByText("anonymous::")).toBeInTheDocument();
    first.unmount();

    apiRequest.mockRejectedValueOnce({ code: "TWO_FACTOR_REQUIRED" });
    const second = render(<SessionProvider><SessionState /></SessionProvider>);
    expect(await screen.findByText("second-factor-required::")).toBeInTheDocument();
    second.unmount();

    apiRequest.mockRejectedValueOnce({ code: "INTERNAL_ERROR" });
    render(<SessionProvider><SessionState /></SessionProvider>);
    expect(await screen.findByText("error::")).toBeInTheDocument();
  });

  it("no restaura una lectura pendiente después de limpiar la sesión", async () => {
    let resolveSession;
    apiRequest.mockReturnValue(new Promise((resolve) => { resolveSession = resolve; }));
    render(<SessionProvider><SessionState /></SessionProvider>);
    fireEvent.click(screen.getByRole("button", { name: "Limpiar" }));
    resolveSession({ user: { name: "Sesión vieja" }, roles: ["ADMIN"], judgeProfile: null });
    await waitFor(() => expect(screen.getByText("anonymous::")).toBeInTheDocument());
    expect(screen.queryByText(/Sesión vieja/)).not.toBeInTheDocument();
  });
});
