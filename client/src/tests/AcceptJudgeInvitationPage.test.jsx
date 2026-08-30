import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { apiRequest } from "../api/http.js";
import { AcceptJudgeInvitationPage } from "../pages/AcceptJudgeInvitationPage.jsx";

vi.mock("../api/http.js", () => ({ apiRequest: vi.fn() }));

describe("AcceptJudgeInvitationPage", () => {
  afterEach(() => { cleanup(); vi.clearAllMocks(); window.location.hash = ""; });

  it("inspecciona por POST y acepta sin mostrar el secreto", async () => {
    apiRequest
      .mockResolvedValueOnce({ valid: true, maskedEmail: "j*****@example.test", expiresAt: "2026-09-02T12:00:00Z" })
      .mockResolvedValueOnce({ accepted: true, next: "TWO_FACTOR_SETUP" });
    const secret = "raw-invitation-secret";
    render(<AcceptJudgeInvitationPage secret={secret} />);
    expect(await screen.findByText(/j\*+@example\.test/)).toBeInTheDocument();
    expect(document.body.textContent).not.toContain(secret);

    fireEvent.change(screen.getByLabelText("Nueva contraseña"), { target: { value: "JudgePassword-2026!" } });
    fireEvent.change(screen.getByLabelText("Repetir contraseña"), { target: { value: "JudgePassword-2026!" } });
    fireEvent.click(screen.getByRole("button", { name: "Crear cuenta" }));

    await waitFor(() => expect(apiRequest).toHaveBeenLastCalledWith("/api/v1/judge-invitations/accept", {
      method: "POST",
      body: JSON.stringify({ secret, password: "JudgePassword-2026!" }),
    }));
    expect(await screen.findByRole("heading", { name: "Cuenta creada" })).toBeInTheDocument();
    expect(screen.getByText(/Todavía no tenés una asignación/)).toBeInTheDocument();
  });

  it("rechaza una invitación sin secreto", () => {
    render(<AcceptJudgeInvitationPage secret="" />);
    expect(screen.getByRole("alert")).toHaveTextContent("La invitación no es válida");
    expect(apiRequest).not.toHaveBeenCalled();
  });

  it("permite reintentar una inspección ante un fallo transitorio", async () => {
    apiRequest
      .mockRejectedValueOnce({ code: "NETWORK_ERROR" })
      .mockResolvedValueOnce({ valid: true, maskedEmail: "j***@example.test", expiresAt: "2026-09-02T12:00:00Z" });
    render(<AcceptJudgeInvitationPage secret="retry-secret" />);
    fireEvent.click(await screen.findByRole("button", { name: "Reintentar" }));
    expect(await screen.findByText(/j\*+@example\.test/)).toBeInTheDocument();
  });

  it("ofrece iniciar sesión cuando la aceptación tuvo un resultado ambiguo", async () => {
    apiRequest
      .mockResolvedValueOnce({ valid: true, maskedEmail: "j***@example.test", expiresAt: "2026-09-02T12:00:00Z" })
      .mockRejectedValueOnce({ code: "NETWORK_ERROR" });
    render(<AcceptJudgeInvitationPage secret="ambiguous-secret" />);
    await screen.findByText(/j\*+@example\.test/);
    fireEvent.change(screen.getByLabelText("Nueva contraseña"), { target: { value: "JudgePassword-2026!" } });
    fireEvent.change(screen.getByLabelText("Repetir contraseña"), { target: { value: "JudgePassword-2026!" } });
    fireEvent.click(screen.getByRole("button", { name: "Crear cuenta" }));
    expect(await screen.findByRole("link", { name: "Probar inicio de sesión" })).toHaveAttribute("href", "#/login");
  });
});
