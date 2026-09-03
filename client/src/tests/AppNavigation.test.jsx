import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { apiRequest } from "../api/http.js";
import { AppNavigation } from "../components/AppNavigation.jsx";

vi.mock("../api/http.js", () => ({ apiRequest: vi.fn() }));

describe("AppNavigation", () => {
  afterEach(() => { cleanup(); vi.clearAllMocks(); window.location.hash = ""; });

  it("no simula un cierre de sesión cuando el servidor falla", async () => {
    const clear = vi.fn();
    apiRequest.mockRejectedValue({ code: "NETWORK_ERROR" });
    render(<AppNavigation session={{ user: { name: "Admin" }, roles: ["ADMIN"], clear }} />);
    fireEvent.click(screen.getByRole("button", { name: "Salir" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Tu acceso continúa activo");
    expect(clear).not.toHaveBeenCalled();
    expect(window.location.hash).toBe("");
  });

  it("agrupa la administración y marca la sección activa", () => {
    window.location.hash = "#/admin/judges";
    render(<AppNavigation session={{ user: { name: "Admin" }, roles: ["ADMIN"] }} />);
    expect(screen.getByText("Administración")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Personas" })).toHaveAttribute("href", "#/admin/judges");
    expect(screen.getByRole("link", { name: "Personas" })).toHaveAttribute("aria-current", "page");
    expect(screen.queryByRole("link", { name: "Accesos" })).not.toBeInTheDocument();
  });

  it("muestra el enlace de Penalizaciones para el rol COMISARIO", () => {
    window.location.hash = "#/admin/penalties";
    render(<AppNavigation session={{ user: { name: "Comisario" }, roles: ["COMISARIO"] }} />);
    expect(screen.getByText("Administración")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Penalizaciones" })).toHaveAttribute("href", "#/admin/penalties");
    expect(screen.getByRole("link", { name: "Penalizaciones" })).toHaveAttribute("aria-current", "page");
    expect(screen.queryByRole("link", { name: "Evento" })).not.toBeInTheDocument();
  });
});
