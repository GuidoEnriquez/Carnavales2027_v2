import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { apiRequest } from "../api/http.js";
import { AcceptRoleInvitationPage } from "../pages/AcceptRoleInvitationPage.jsx";

vi.mock("../api/http.js", () => ({ apiRequest: vi.fn() }));

describe("AcceptRoleInvitationPage", () => {
  afterEach(() => { cleanup(); vi.clearAllMocks(); window.location.hash = ""; });

  it("inspecciona y acepta sin retener el token en la URL", async () => {
    apiRequest
      .mockResolvedValueOnce({ maskedEmail: "c********@example.test", roleCode: "COMISARIO", expiresAt: "2026-09-02T12:00:00Z" })
      .mockResolvedValueOnce({ roleCode: "COMISARIO" });
    window.location.hash = "#/invitations/role/accept?token=raw-operational-token";
    render(<AcceptRoleInvitationPage token="raw-operational-token" />);
    expect(await screen.findByText(/c\*+@example\.test/)).toBeInTheDocument();
    expect(window.location.hash).toBe("#/invitations/role/accept");
    expect(document.body.textContent).not.toContain("raw-operational-token");

    fireEvent.change(screen.getByLabelText("Nueva contraseña"), { target: { value: "OperationalPassword-2026!" } });
    fireEvent.change(screen.getByLabelText("Repetir contraseña"), { target: { value: "OperationalPassword-2026!" } });
    fireEvent.click(screen.getByRole("button", { name: "Crear cuenta" }));
    await waitFor(() => expect(apiRequest).toHaveBeenLastCalledWith("/api/v1/invitations/role/accept", {
      method: "POST",
      body: JSON.stringify({ token: "raw-operational-token", password: "OperationalPassword-2026!" }),
    }));
    expect(await screen.findByRole("heading", { name: "Cuenta creada" })).toBeInTheDocument();
  });

  it("impide enviar contraseñas diferentes", async () => {
    apiRequest.mockResolvedValueOnce({ maskedEmail: "v***@example.test", roleCode: "VEEDOR", expiresAt: "2026-09-02T12:00:00Z" });
    render(<AcceptRoleInvitationPage token="token" />);
    await screen.findByText(/v\*+@example\.test/);
    fireEvent.change(screen.getByLabelText("Nueva contraseña"), { target: { value: "OperationalPassword-2026!" } });
    fireEvent.change(screen.getByLabelText("Repetir contraseña"), { target: { value: "OtraPassword-2026!" } });
    fireEvent.click(screen.getByRole("button", { name: "Crear cuenta" }));
    expect(await screen.findByText("Las contraseñas no coinciden.")).toBeInTheDocument();
    expect(apiRequest).toHaveBeenCalledTimes(1);
  });
});
