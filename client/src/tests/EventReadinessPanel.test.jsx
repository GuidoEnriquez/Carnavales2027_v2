import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { apiRequest } from "../api/http.js";
import { EventReadinessPanel } from "../features/EventReadinessPanel.jsx";

vi.mock("../api/http.js", () => ({ apiRequest: vi.fn() }));

describe("EventReadinessPanel", () => {
  afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.clearAllMocks(); });

  it("muestra mensajes humanos para los faltantes", async () => {
    apiRequest.mockResolvedValue({
      ready: false,
      missing: ["ACTIVE_SPECIALTY", "ACTIVE_RUBRIC"],
      incompleteTroupes: [{ id: "t1", name: "Comparsa incompleta" }],
      incompleteRubrics: [{ id: "r1", name: "Coreografia", code: "COREO" }],
    });
    render(<EventReadinessPanel event={{ id: "e1" }} locked={false} />);
    await screen.findByText(/No hay especialidades activas configuradas/);
    expect(screen.getByText(/No existe ningun rubro activo/)).toBeInTheDocument();
    expect(screen.getByText(/Comparsa incompleta/)).toBeInTheDocument();
    expect(screen.getByText(/Coreografia/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Abrir evento" })).toBeDisabled();
  });

  it("muestra ok cuando todo esta completo", async () => {
    apiRequest.mockResolvedValue({
      ready: true,
      missing: [],
      incompleteTroupes: [],
      incompleteRubrics: [],
    });
    render(<EventReadinessPanel event={{ id: "e1" }} locked={false} />);
    expect(await screen.findByText(/Configuracion completa/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Abrir evento" })).not.toBeDisabled();
  });

  it("notifica la apertura exitosa para bloquear la edicion", async () => {
    vi.spyOn(window, "confirm").mockReturnValue(true);
    const onOpened = vi.fn();
    apiRequest
      .mockResolvedValueOnce({ ready: true, missing: [], incompleteTroupes: [], incompleteRubrics: [] })
      .mockResolvedValueOnce({ id: "e1", status: "OPEN" })
      .mockResolvedValueOnce({ ready: true, missing: [], incompleteTroupes: [], incompleteRubrics: [] });
    render(<EventReadinessPanel event={{ id: "e1" }} locked={false} onOpened={onOpened} />);
    fireEvent.click(await screen.findByRole("button", { name: "Abrir evento" }));
    await waitFor(() => expect(onOpened).toHaveBeenCalled());
  });

  it("no abre sin confirmacion explicita", async () => {
    vi.spyOn(window, "confirm").mockReturnValue(false);
    apiRequest.mockResolvedValueOnce({ ready: true, missing: [], incompleteTroupes: [], incompleteRubrics: [] });
    render(<EventReadinessPanel event={{ id: "e1" }} locked={false} />);
    fireEvent.click(await screen.findByRole("button", { name: "Abrir evento" }));
    expect(apiRequest).toHaveBeenCalledTimes(1);
  });

  it("reemplaza readiness con los detalles de un rechazo concurrente", async () => {
    vi.spyOn(window, "confirm").mockReturnValue(true);
    apiRequest
      .mockResolvedValueOnce({ ready: true, missing: [], incompleteTroupes: [], incompleteRubrics: [] })
      .mockRejectedValueOnce({
        code: "EVENT_CONFIGURATION_INCOMPLETE",
        details: { ready: false, missing: ["ACTIVE_SPECIALTY"], incompleteTroupes: [], incompleteRubrics: [] },
      });
    render(<EventReadinessPanel event={{ id: "e1" }} locked={false} />);
    fireEvent.click(await screen.findByRole("button", { name: "Abrir evento" }));
    expect(await screen.findByText(/No hay especialidades activas configuradas/)).toBeInTheDocument();
  });
});
