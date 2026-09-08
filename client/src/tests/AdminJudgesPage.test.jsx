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
  invitation: { id: "i1", status: "USED" },
};

describe("AdminJudgesPage", () => {
  afterEach(() => { cleanup(); vi.clearAllMocks(); vi.restoreAllMocks(); });

  it("renderiza bajo la capa de instrumento data-layer='instrument' (RF-177)", async () => {
    apiRequest.mockImplementation((path) => {
      if (path === "/api/v1/operational-profiles" || path === "/api/v1/judges") return Promise.resolve([]);
      return Promise.resolve({});
    });
    const { container } = render(<AdminJudgesPage />);
    expect(container.querySelector("main.admin-shell")).toHaveAttribute("data-layer", "instrument");
  });

  it("crea un perfil sin especialidad y actualiza el padrón", async () => {
    let judgeRequests = 0;
    apiRequest.mockImplementation((path, options) => {
      if (path === "/api/v1/operational-profiles") return Promise.resolve([]);
      if (path === "/api/v1/judges" && !options) {
        judgeRequests += 1;
        return Promise.resolve(judgeRequests === 1 ? [] : [registered]);
      }
      if (path === "/api/v1/judges") return Promise.resolve({ judge: { id: "j1" } });
      return Promise.resolve({});
    });
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

  it("genera una invitación auxiliar desde la misma sección", async () => {
    apiRequest.mockImplementation((path, options) => {
      if (path === "/api/v1/judges" && !options) return Promise.resolve([]);
      if (path === "/api/v1/operational-profiles" && !options) return Promise.resolve([]);
      if (path === "/api/v1/operational-profiles") return Promise.resolve({
        operationalProfile: { id: "op1", name: "Comisario Test" },
        invitation: { id: "inv1", status: "PENDING", expiresAt: new Date().toISOString(), deliveryStatus: "SENT" },
      });
      return Promise.resolve([]);
    });
    render(<AdminJudgesPage />);
    await screen.findByText("Todavía no hay jurados registrados.");

    fireEvent.change(screen.getByLabelText("Tipo de alta"), { target: { value: "COMISARIO" } });
    fireEvent.change(screen.getByLabelText("Nombre completo"), { target: { value: "Comisario Test" } });
    fireEvent.change(screen.getByLabelText("Correo"), { target: { value: "comisario@example.test" } });
    fireEvent.change(screen.getByLabelText("DNI"), { target: { value: "87654321" } });
    fireEvent.click(screen.getByRole("button", { name: "Registrar e invitar" }));

    await waitFor(() => expect(apiRequest).toHaveBeenCalledWith("/api/v1/operational-profiles", {
      method: "POST",
      body: JSON.stringify({
        name: "Comisario Test",
        email: "comisario@example.test",
        documentNumber: "87654321",
        roleCodes: ["COMISARIO"],
      }),
    }));
    expect(await screen.findByText("Perfil registrado e invitación enviada.")).toBeInTheDocument();
  });

  it("suspende con confirmación y refresca el estado", async () => {
    vi.spyOn(window, "confirm").mockReturnValue(true);
    let judgeRequests = 0;
    apiRequest.mockImplementation((path, options) => {
      if (path === "/api/v1/operational-profiles") return Promise.resolve([]);
      if (path === "/api/v1/judges" && !options) {
        judgeRequests += 1;
        return Promise.resolve(judgeRequests === 1 ? [registered] : [{ ...registered, registrationStatus: "SUSPENDED" }]);
      }
      if (path === "/api/v1/judges/j1/suspend") return Promise.resolve({ suspended: true });
      return Promise.resolve({});
    });
    render(<AdminJudgesPage />);
    fireEvent.click(await screen.findByRole("button", { name: "Suspender a Jurado Registrado" }));
    await waitFor(() => expect(apiRequest).toHaveBeenCalledWith("/api/v1/judges/j1/suspend", { method: "POST" }));
    expect(await screen.findByText("Suspendido")).toBeInTheDocument();
  });
});
