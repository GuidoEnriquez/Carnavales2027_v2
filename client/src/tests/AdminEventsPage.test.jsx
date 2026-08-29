import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { apiRequest } from "../api/http.js";
import { AdminEventsPage } from "../pages/AdminEventsPage.jsx";

vi.mock("../api/http.js", () => ({ apiRequest: vi.fn() }));

describe("AdminEventsPage", () => {
  afterEach(() => { cleanup(); vi.clearAllMocks(); });

  it("espera las listas iniciales antes de habilitar la configuración", async () => {
    const pending = [];
    apiRequest
      .mockResolvedValueOnce([{ id: "e1", name: "Goya", status: "CONFIGURING" }])
      .mockImplementation(() => new Promise((resolve) => pending.push(resolve)));

    render(<AdminEventsPage />);
    fireEvent.click(await screen.findByRole("button", { name: "Goya (CONFIGURING)" }));

    expect(await screen.findByText("Cargando configuración…")).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Jornadas" })).not.toBeInTheDocument();

    pending.forEach((resolve) => resolve([]));
    expect(await screen.findByRole("heading", { name: "Jornadas" })).toBeInTheDocument();
  });
});
