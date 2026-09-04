import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { apiRequest } from "../api/http.js";
import { VeedorMonitorPage } from "../pages/VeedorMonitorPage.jsx";

vi.mock("../api/http.js", () => ({ apiRequest: vi.fn() }));

const payload = [{
  id: "event-1",
  name: "Carnaval 2027",
  status: "OPEN",
  nights: [{
    id: "night-1",
    name: "Noche 1",
    status: "OPEN",
    votingStatus: "OPEN",
    counts: { OPEN: 2, SUBMITTED: 3, REOPENED: 1, REPLACED: 1 },
    total: 6,
  }],
}];

afterEach(() => { cleanup(); vi.clearAllMocks(); vi.useRealTimers(); });

describe("VeedorMonitorPage", () => {
  it("muestra conteos agregados y porcentaje de confirmación", async () => {
    apiRequest.mockResolvedValue(payload);
    render(<VeedorMonitorPage />);

    expect(await screen.findByRole("heading", { name: "Noche 1" })).toBeInTheDocument();
    expect(screen.getByText("Confirmadas").nextElementSibling).toHaveTextContent("3");
    expect(screen.getByText("50%")).toBeInTheDocument();
    expect(screen.queryByText("score")).not.toBeInTheDocument();
  });

  it("refresca cada 15 segundos, se pausa oculta y reanuda visible", async () => {
    vi.useFakeTimers();
    Object.defineProperty(document, "visibilityState", { configurable: true, value: "visible" });
    apiRequest.mockResolvedValue(payload);
    render(<VeedorMonitorPage />);
    expect(apiRequest).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(15_000);
    expect(apiRequest).toHaveBeenCalledTimes(2);
    Object.defineProperty(document, "visibilityState", { configurable: true, value: "hidden" });
    await vi.advanceTimersByTimeAsync(15_000);
    expect(apiRequest).toHaveBeenCalledTimes(2);
    Object.defineProperty(document, "visibilityState", { configurable: true, value: "visible" });
    fireEvent(document, new Event("visibilitychange"));
    await Promise.resolve();
    expect(apiRequest).toHaveBeenCalledTimes(3);
  });
});
