import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { apiRequest } from "../api/http.js";
import { AdminJudgesPage } from "../pages/AdminJudgesPage.jsx";

vi.mock("../api/http.js", () => ({ apiRequest: vi.fn() }));

const registered = {
  id: "j1",
  name: "Jurado Registrado",
  email: "jurado@example.test",
  documentNumber: "12345678",
  registrationStatus: "REGISTERED",
  invitation: { id: "i1", status: "USED", deliveryStatus: "SENT" },
};

describe("AdminJudgesPage", () => {
  afterEach(() => { cleanup(); vi.clearAllMocks(); vi.restoreAllMocks(); });

  it("crea un perfil sin especialidad y actualiza el padrón", async () => {
    apiRequest
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce({ judge: { id: "j1" } })
      .mockResolvedValueOnce([registered]);
    render(<AdminJudgesPage />);
    await screen.findByText("Todavía no hay jurados registrados.");

    fireEvent.change(screen.getByLabelText("Nombre completo"), { target: { value: "Jurado Registrado" } });
    fireEvent.change(screen.getByLabelText("Correo"), { target: { value: "jurado@example.test" } });
    fireEvent.change(screen.getByLabelText("DNI"), { target: { value: "12345678" } });
    fireEvent.click(screen.getByRole("button", { name: "Registrar e invitar" }));

    await waitFor(() => expect(apiRequest).toHaveBeenCalledWith("/api/v1/judges", {
      method: "POST",
      body: JSON.stringify({
        name: "Jurado Registrado",
        email: "jurado@example.test",
        documentNumber: "12345678",
      }),
    }));
    expect(await screen.findByText("Jurado Registrado")).toBeInTheDocument();
    expect(JSON.stringify(apiRequest.mock.calls)).not.toContain("specialty");
  });

  it("suspende con confirmación y refresca el estado", async () => {
    vi.spyOn(window, "confirm").mockReturnValue(true);
    apiRequest
      .mockResolvedValueOnce([registered])
      .mockResolvedValueOnce({ suspended: true })
      .mockResolvedValueOnce([{ ...registered, registrationStatus: "SUSPENDED" }]);
    render(<AdminJudgesPage />);
    fireEvent.click(await screen.findByRole("button", { name: "Suspender a Jurado Registrado" }));
    await waitFor(() => expect(apiRequest).toHaveBeenCalledWith("/api/v1/judges/j1/suspend", { method: "POST" }));
    expect(await screen.findByText("Suspendido")).toBeInTheDocument();
  });
});
