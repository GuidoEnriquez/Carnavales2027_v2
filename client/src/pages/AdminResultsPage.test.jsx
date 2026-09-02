import { cleanup, fireEvent, render, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AdminResultsPage } from "./AdminResultsPage.jsx";

const apiRequestMock = vi.hoisted(() => vi.fn());
vi.mock("../api/http.js", () => ({ apiRequest: apiRequestMock }));

const event = { id: "event-1", name: "test_prueba" };
const tieError = Object.assign(new Error("TIE_BREAKER_REQUIRES_MANUAL_DRAW"), {
  code: "TIE_BREAKER_REQUIRES_MANUAL_DRAW",
  details: {
    remainingTroupeIds: ["troupe-a", "troupe-b"],
    tieBreakerContext: {
      wonRubricsCounts: [
        { troupeId: "troupe-a", wonRubrics: 2 },
        { troupeId: "troupe-b", wonRubrics: 2 },
      ],
    },
  },
});
const missingDraw = Object.assign(new Error("TIE_BREAKER_DRAW_NOT_FOUND"), {
  code: "TIE_BREAKER_DRAW_NOT_FOUND",
});

describe("AdminResultsPage", () => {
  afterEach(() => {
    cleanup();
    apiRequestMock.mockReset();
  });

  it("carga test_prueba y muestra el empate listo para sorteo ceremonial", async () => {
    apiRequestMock.mockImplementation((path) => {
      if (path === "/api/v1/results/events") return Promise.resolve([event]);
      if (path === "/api/v1/results/events/event-1/troupes") return Promise.resolve([
        { id: "troupe-a", name: "Comparsa Test A" },
        { id: "troupe-b", name: "Comparsa Test B" },
      ]);
      if (path === "/api/v1/events/event-1/results") return Promise.reject(tieError);
      if (path === "/api/v1/events/event-1/tie-breaker/ceremonial-draw") return Promise.reject(missingDraw);
      return Promise.reject(new Error(`request inesperado: ${path}`));
    });

    const { getByRole, getByText } = render(<AdminResultsPage />);

    await waitFor(() => expect(getByRole("heading", { name: "Empate pendiente" })).toBeVisible());
    expect(getByRole("option", { name: "test_prueba" })).toBeVisible();
    expect(getByText("Comparsa Test A")).toBeVisible();
    expect(getByText("Comparsa Test B")).toBeVisible();
    expect(getByRole("button", { name: /iniciar sorteo ceremonial/i })).toBeVisible();
  });

  it("muestra la ganadora auditada al volver a cargar el empate", async () => {
    apiRequestMock.mockImplementation((path) => {
      if (path === "/api/v1/results/events") return Promise.resolve([event]);
      if (path === "/api/v1/results/events/event-1/troupes") return Promise.resolve([
        { id: "troupe-a", name: "Comparsa Test A" },
        { id: "troupe-b", name: "Comparsa Test B" },
      ]);
      if (path === "/api/v1/events/event-1/results") return Promise.reject(tieError);
      if (path === "/api/v1/events/event-1/tie-breaker/ceremonial-draw") {
        return Promise.resolve({ eventId: "event-1", winnerTroupeId: "troupe-b", auditEventId: "audit-1" });
      }
      return Promise.reject(new Error(`request inesperado: ${path}`));
    });
    const { getByText, queryByRole } = render(<AdminResultsPage />);

    await waitFor(() => expect(getByText("Ganadora:")).toBeVisible());
    expect(getByText("Ganadora:").parentElement).toHaveTextContent("Comparsa Test B");
    expect(queryByRole("button", { name: /iniciar sorteo ceremonial/i })).not.toBeInTheDocument();
  });

  it("no queda cargando indefinidamente si falla la carga de competencias", async () => {
    apiRequestMock.mockRejectedValue(new Error("API caída"));

    const { getByText, queryByText } = render(<AdminResultsPage />);

    await waitFor(() => expect(getByText(/no se pudieron cargar las competencias/i)).toBeVisible());
    expect(queryByText(/cargando resultados/i)).not.toBeInTheDocument();
  });

  it("permite liberar resultados autorizados y vuelve a consultarlos", async () => {
    const notReleased = Object.assign(new Error("RESULTS_NOT_RELEASED"), { code: "RESULTS_NOT_RELEASED" });
    let resultCalls = 0;
    apiRequestMock.mockImplementation((path, options) => {
      if (path === "/api/v1/results/events") return Promise.resolve([event]);
      if (path === "/api/v1/results/events/event-1/troupes") return Promise.resolve([]);
      if (path === "/api/v1/events/event-1/results") {
        resultCalls += 1;
        return resultCalls === 1 ? Promise.reject(notReleased) : Promise.resolve({ overallRanking: [] });
      }
      if (path === "/api/v1/events/event-1/results/release" && options?.method === "POST") return Promise.resolve({ eventId: "event-1" });
      return Promise.reject(new Error(`request inesperado: ${path}`));
    });
    const { getByRole } = render(<AdminResultsPage />);
    const button = await waitFor(() => getByRole("button", { name: "Liberar resultados" }));
    fireEvent.click(button);
    await waitFor(() => expect(apiRequestMock).toHaveBeenCalledWith(
      "/api/v1/events/event-1/results/release", { method: "POST" },
    ));
    await waitFor(() => expect(resultCalls).toBe(2));
  });
});
