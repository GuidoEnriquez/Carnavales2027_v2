import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { apiRequest } from "../api/http.js";
import { EventReadinessPanel } from "../features/EventReadinessPanel.jsx";

vi.mock("../api/http.js", () => ({ apiRequest: vi.fn() }));

describe("EventReadinessPanel", () => {
  afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.clearAllMocks(); });

  it("muestra todos los faltantes estructurados", async () => {
    apiRequest.mockResolvedValue({
      ready: false,
      missing: ["ACTIVE_SPECIALTY"],
      incompleteTroupes: [{ id: "t1", name: "Comparsa incompleta" }],
      incompleteRubrics: [{ id: "r1", code: "RUBRO_INCOMPLETO" }],
    });
    render(<EventReadinessPanel event={{ id: "e1" }} locked={false} />);
    expect(await screen.findByText("ACTIVE_SPECIALTY")).toBeInTheDocument();
    expect(screen.getByText("Comparsa incompleta")).toBeInTheDocument();
    expect(screen.getByText("RUBRO_INCOMPLETO")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Abrir evento" })).toBeDisabled();
  });

  it("notifica la apertura exitosa para bloquear la edición", async () => {
    vi.spyOn(window, "confirm").mockReturnValue(true);
    const onOpened = vi.fn();
    apiRequest
      .mockResolvedValueOnce({ ready: true, missing: [], incompleteTroupes: [], incompleteRubrics: [] })
      .mockResolvedValueOnce({ id: "e1", status: "OPEN" })
      .mockResolvedValueOnce({ ready: true, missing: [], incompleteTroupes: [], incompleteRubrics: [] });
    render(<EventReadinessPanel event={{ id: "e1" }} locked={false} onOpened={onOpened} />);
    fireEvent.click(await screen.findByRole("button", { name: "Abrir evento" }));
    await waitFor(() => expect(onOpened).toHaveBeenCalledWith({ id: "e1", status: "OPEN" }));
  });

  it("no abre sin confirmación explícita", async () => {
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
    expect(await screen.findByText("ACTIVE_SPECIALTY")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Abrir evento" })).toBeDisabled();
  });

  it("no deja que una lectura pendiente sobrescriba el rechazo de apertura", async () => {
    vi.spyOn(window, "confirm").mockReturnValue(true);
    let resolvePendingReadiness;
    apiRequest
      .mockResolvedValueOnce({ ready: true, missing: [], incompleteTroupes: [], incompleteRubrics: [] })
      .mockImplementationOnce(() => new Promise((resolve) => { resolvePendingReadiness = resolve; }))
      .mockRejectedValueOnce({
        code: "EVENT_CONFIGURATION_INCOMPLETE",
        details: { ready: false, missing: ["ACTIVE_SPECIALTY"], incompleteTroupes: [], incompleteRubrics: [] },
      });
    const { rerender } = render(<EventReadinessPanel event={{ id: "e1" }} locked={false} refreshKey={0} />);
    const openButton = await screen.findByRole("button", { name: "Abrir evento" });
    rerender(<EventReadinessPanel event={{ id: "e1" }} locked={false} refreshKey={1} />);
    fireEvent.click(openButton);
    expect(await screen.findByText("ACTIVE_SPECIALTY")).toBeInTheDocument();
    resolvePendingReadiness({ ready: true, missing: [], incompleteTroupes: [], incompleteRubrics: [] });
    await waitFor(() => expect(screen.getByText("ACTIVE_SPECIALTY")).toBeInTheDocument());
  });

  it("descarta respuestas obsoletas al refrescar readiness", async () => {
    let resolveFirst;
    let resolveSecond;
    apiRequest
      .mockImplementationOnce(() => new Promise((resolve) => { resolveFirst = resolve; }))
      .mockImplementationOnce(() => new Promise((resolve) => { resolveSecond = resolve; }));
    const { rerender } = render(<EventReadinessPanel event={{ id: "e1" }} locked={false} refreshKey={0} />);
    rerender(<EventReadinessPanel event={{ id: "e1" }} locked={false} refreshKey={1} />);

    resolveSecond({ ready: true, missing: [], incompleteTroupes: [], incompleteRubrics: [] });
    expect(await screen.findByText("Configuración completa")).toBeInTheDocument();
    resolveFirst({ ready: false, missing: ["ACTIVE_SPECIALTY"], incompleteTroupes: [], incompleteRubrics: [] });

    await waitFor(() => expect(screen.queryByText("ACTIVE_SPECIALTY")).not.toBeInTheDocument());
    expect(screen.getByText("Configuración completa")).toBeInTheDocument();
  });
});
