import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { apiRequest } from "../api/http.js";
import { AdminEventsPage } from "../pages/AdminEventsPage.jsx";

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
    fireEvent.click(await screen.findByRole("button", { name: "Configurar evento" }));
    fireEvent.click(await screen.findByRole("button", { name: "Goya Configurando" }));

    expect(await screen.findByText("Cargando configuracion...")).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Jornadas" })).not.toBeInTheDocument();

    pending.forEach((resolve) => resolve([]));
    expect(await screen.findByRole("heading", { name: "Jornadas" })).toBeInTheDocument();
  });

  it("muestra error cuando las noches no pueden cargarse", async () => {
    apiRequest
      .mockResolvedValueOnce([{ id: "e1", name: "Goya", status: "CONFIGURING" }])
      .mockResolvedValueOnce([])
      .mockRejectedValueOnce(new Error("network"))
      .mockResolvedValue([]);

    render(<AdminEventsPage />);
    fireEvent.click(await screen.findByRole("button", { name: "Configurar evento" }));
    fireEvent.click(await screen.findByRole("button", { name: "Goya Configurando" }));
    expect(await screen.findByRole("heading", { name: "No se pudo cargar la configuracion" })).toBeInTheDocument();
  });
});
