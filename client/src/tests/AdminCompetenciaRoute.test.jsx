import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import App from "../App.jsx";
import { apiRequest } from "../api/http.js";

vi.mock("../api/http.js", () => ({ apiRequest: vi.fn() }));

function mockApi(events) {
  apiRequest.mockImplementation((path) => {
    if (path === "/api/v1/events") return Promise.resolve(events);
    if (path.endsWith("/troupes")) return Promise.resolve([]);
    if (path.endsWith("/categories")) return Promise.resolve([]);
    if (path.endsWith("/specialties")) return Promise.resolve([]);
    if (path.endsWith("/rubrics")) return Promise.resolve([]);
    if (path.endsWith("/orphaned-criteria")) return Promise.resolve([]);
    return Promise.reject(new Error(`Solicitud inesperada: ${path}`));
  });
}

describe("ruta de Competencia con evento activo", () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
    window.localStorage.clear();
    window.location.hash = "";
  });

  it("entra directamente a la competencia y no vuelve a listar eventos", async () => {
    window.location.hash = "#/admin/competencia";
    mockApi([{ id: "e1", name: "Carnaval 2027", status: "CONFIGURING" }, { id: "e2", name: "Prueba", status: "OPEN" }]);

    render(<App session={{ status: "authenticated", roles: ["ADMIN"], user: { name: "Admin" } }} />);

    expect(await screen.findByRole("heading", { name: "Carnaval 2027" })).toBeInTheDocument();
    expect(screen.queryByText("Selecciona un evento para administrar su competencia.")).not.toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: "Evento activo" })).toHaveValue("e1");
  });

  it("muestra un empty state navegable cuando no hay evento activo", async () => {
    window.location.hash = "#/admin/competencia";
    mockApi([]);

    render(<App session={{ status: "authenticated", roles: ["ADMIN"], user: { name: "Admin" } }} />);

    expect(await screen.findByRole("heading", { name: "Primero seleccioná un evento" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Seleccionar evento" })).toHaveAttribute("href", "#/admin/events");
  });
});
