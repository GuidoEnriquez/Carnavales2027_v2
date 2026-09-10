import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { apiRequest } from "../api/http.js";
import { AdminEventsPage } from "../pages/AdminEventsPage.jsx";
import { AdminEventProvider } from "../context/AdminEventContext.jsx";

vi.mock("../api/http.js", () => ({ apiRequest: vi.fn() }));

describe("AdminEventsPage", () => {
  afterEach(() => { cleanup(); vi.clearAllMocks(); });

  it("renderiza bajo la capa de instrumento data-layer='instrument' (RF-177)", async () => {
    apiRequest.mockResolvedValueOnce([]).mockResolvedValueOnce([]);
    const { container } = render(<AdminEventsPage />);
    expect(container.querySelector("main.container")).toHaveAttribute("data-layer", "instrument");
  });

  it("espera las noches antes de habilitar la configuracion", async () => {
    const pending = [];
    apiRequest
      .mockResolvedValueOnce([{ id: "e1", name: "Goya", status: "CONFIGURING" }])
      .mockResolvedValueOnce([])
      .mockImplementation(() => new Promise((resolve) => pending.push(resolve)));

    render(<AdminEventsPage />);
    fireEvent.click(await screen.findByRole("button", { name: "Usar este evento" }));

    expect(await screen.findByText("Cargando configuracion...")).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Jornadas" })).not.toBeInTheDocument();

    pending.forEach((resolve) => resolve([]));
    expect(await screen.findByRole("heading", { name: "Jornadas" })).toBeInTheDocument();
  });

  it("muestra error cuando las noches no pueden cargarse", async () => {
    let nightsCalls = 0;
    apiRequest.mockImplementation((path) => {
      if (path === "/api/v1/events") return Promise.resolve([{ id: "e1", name: "Goya", status: "CONFIGURING" }]);
      if (path === "/api/v1/users") return Promise.resolve([]);
      if (path === "/api/v1/judges") return Promise.resolve([]);
      if (path === "/api/v1/events/e1/nights") {
        nightsCalls += 1;
        return nightsCalls === 2 ? Promise.reject(new Error("network")) : Promise.resolve([]);
      }
      if (path.endsWith("/troupes") || path.endsWith("/rubrics")) return Promise.resolve([]);
      return Promise.resolve([]);
    });

    render(<AdminEventsPage />);
    fireEvent.click(await screen.findByRole("button", { name: "Usar este evento" }));
    expect(await screen.findByRole("heading", { name: "No se pudo cargar la configuracion" })).toBeInTheDocument();
  });

  it("destaca el evento activo y muestra acciones según el estado", async () => {
    apiRequest.mockImplementation((path) => {
      if (path === "/api/v1/events") return Promise.resolve([
        { id: "e1", name: "Carnaval 2027", status: "CONFIGURING" },
        { id: "e2", name: "Competencia abierta", status: "OPEN" },
        { id: "e3", name: "Carnaval cerrado", status: "CLOSED" },
      ]);
      if (path === "/api/v1/users" || path === "/api/v1/judges") return Promise.resolve([]);
      if (path.endsWith("/nights")) return Promise.resolve([{ id: "n1", kind: "COMPETITION" }]);
      if (path.endsWith("/troupes")) return Promise.resolve([{ id: "t1", active: true }]);
      if (path.endsWith("/rubrics")) return Promise.resolve([{ id: "r1", active: true }]);
      return Promise.resolve([]);
    });

    render(
      <AdminEventProvider>
        <AdminEventsPage />
      </AdminEventProvider>,
    );

    expect(await screen.findByText("✓ Evento activo")).toBeInTheDocument();
    expect((await screen.findAllByText("1", { selector: ".event-summary-stats strong" })).length).toBeGreaterThanOrEqual(3);
    expect(screen.getByRole("button", { name: "Continuar preparación" })).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: "Usar este evento" }).length).toBe(2);
    expect(screen.getByRole("link", { name: "Ir a supervisión" })).toHaveAttribute("href", "#/veedor");
    expect(screen.getByRole("link", { name: "Ver resultados" })).toHaveAttribute("href", "#/admin/results");
  });

  it("abre el diálogo accesible para crear un evento", async () => {
    apiRequest.mockResolvedValue([]);
    render(<AdminEventsPage />);
    fireEvent.click(screen.getByRole("button", { name: "+ Nuevo evento" }));
    expect(await screen.findByRole("dialog", { name: "Nuevo evento" })).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: "Nombre del evento" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Cancelar" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Crear evento" })).toBeInTheDocument();
  });
});
