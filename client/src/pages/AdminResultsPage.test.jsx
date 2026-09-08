import { cleanup, fireEvent, render, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AdminResultsPage } from "./AdminResultsPage.jsx";

const apiRequestMock = vi.hoisted(() => vi.fn());
vi.mock("../api/http.js", () => ({ apiRequest: apiRequestMock }));

const useSessionMock = vi.hoisted(() => vi.fn(() => ({ roles: ["SCRUTINEER"] })));
vi.mock("../auth/session-context.jsx", () => ({ useSession: useSessionMock }));

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
    useSessionMock.mockReturnValue({ roles: ["SCRUTINEER"] });
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

  it("muestra nota explicativa y no muestra el botón de liberar si el usuario es ADMIN", async () => {
    useSessionMock.mockReturnValue({ roles: ["ADMIN"] });
    const notReleased = Object.assign(new Error("RESULTS_NOT_RELEASED"), { code: "RESULTS_NOT_RELEASED" });
    apiRequestMock.mockImplementation((path) => {
      if (path === "/api/v1/results/events") return Promise.resolve([event]);
      if (path === "/api/v1/results/events/event-1/troupes") return Promise.resolve([]);
      if (path === "/api/v1/events/event-1/results") return Promise.reject(notReleased);
      return Promise.reject(new Error(`request inesperado: ${path}`));
    });
    const { getByRole, queryByRole } = render(<AdminResultsPage />);
    await waitFor(() => expect(getByRole("note")).toHaveTextContent(/corresponde exclusivamente a Escrutinio o Escribanía/i));
    expect(queryByRole("button", { name: "Liberar resultados" })).not.toBeInTheDocument();
  });

  it("muestra las tres columnas de puntaje bruto, penalizaciones y neto en el ranking general", async () => {
    apiRequestMock.mockImplementation((path) => {
      if (path === "/api/v1/results/events") return Promise.resolve([event]);
      if (path === "/api/v1/results/events/event-1/troupes") return Promise.resolve([
        { id: "troupe-a", name: "Comparsa Porambá" },
        { id: "troupe-b", name: "Comparsa Itá Verá" },
      ]);
      if (path === "/api/v1/events/event-1/results") return Promise.resolve({
        overallRanking: [
          {
            rank: 1,
            troupeId: "troupe-a",
            troupeName: "Comparsa Porambá",
            grossScore: 120,
            totalPenalties: 2,
            netScore: 118,
            totalScore: 118,
          },
          {
            rank: 2,
            troupeId: "troupe-b",
            troupeName: "Comparsa Itá Verá",
            grossScore: 115,
            totalPenalties: 0,
            netScore: 115,
            totalScore: 115,
          },
        ],
      });
      return Promise.reject(new Error(`request inesperado: ${path}`));
    });

    const { getByText, getAllByText, getByRole } = render(<AdminResultsPage />);

    await waitFor(() => expect(getByRole("heading", { name: "Ranking general" })).toBeVisible());
    expect(getByText("Puntaje bruto")).toBeVisible();
    expect(getByText("Penalizaciones")).toBeVisible();
    expect(getByText("Puntaje final neto")).toBeVisible();

    expect(getByText("Comparsa Porambá")).toBeVisible();
    expect(getByText("120 pts")).toBeVisible();
    expect(getByText("−2 pts")).toBeVisible();
    expect(getByText("118 pts")).toBeVisible();

    expect(getByText("Comparsa Itá Verá")).toBeVisible();
    expect(getAllByText("115 pts")).toHaveLength(2);
    expect(getByText("0 pts")).toBeVisible();
  });

  it("muestra deducción con penalizaciones que superan el puntaje bruto respetando piso cero y data-label accesibles (RF-117, RF-119, RF-120)", async () => {
    apiRequestMock.mockImplementation((path) => {
      if (path === "/api/v1/results/events") return Promise.resolve([event]);
      if (path === "/api/v1/results/events/event-1/troupes") return Promise.resolve([
        { id: "troupe-a", name: "Comparsa Penalizada al Cero" },
      ]);
      if (path === "/api/v1/events/event-1/results") return Promise.resolve({
        overallRanking: [
          {
            rank: 1,
            troupeId: "troupe-a",
            troupeName: "Comparsa Penalizada al Cero",
            grossScore: 5,
            totalPenalties: 12,
            netScore: 0,
            totalScore: 0,
          },
        ],
      });
      return Promise.reject(new Error(`request inesperado: ${path}`));
    });

    const { getByText, getByRole } = render(<AdminResultsPage />);

    await waitFor(() => expect(getByRole("heading", { name: "Ranking general" })).toBeVisible());
    expect(getByText("Comparsa Penalizada al Cero")).toBeVisible();
    expect(getByText("5 pts")).toBeVisible();
    expect(getByText("−12 pts")).toBeVisible();
    expect(getByText("0 pts")).toBeVisible();

    const grossCell = getByText("5 pts");
    const penaltiesCell = getByText("−12 pts");
    const netCell = getByText("0 pts");
    expect(grossCell).toHaveAttribute("data-label", "Puntaje bruto");
    expect(penaltiesCell).toHaveAttribute("data-label", "Penalizaciones");
    expect(netCell).toHaveAttribute("data-label", "Puntaje final neto");
  });

  it("aplica data-layer='brand' y muestra el panel de condiciones previas cuando los resultados no están liberados (RF-200, RF-204)", async () => {
    const notReleased = Object.assign(new Error("RESULTS_NOT_RELEASED"), { code: "RESULTS_NOT_RELEASED" });
    apiRequestMock.mockImplementation((path) => {
      if (path === "/api/v1/results/events") return Promise.resolve([event]);
      if (path === "/api/v1/results/events/event-1/troupes") return Promise.resolve([]);
      if (path === "/api/v1/events/event-1/results") return Promise.reject(notReleased);
      return Promise.reject(new Error(`request inesperado: ${path}`));
    });

    const { container, getByRole, getByText } = render(<AdminResultsPage />);

    await waitFor(() => expect(getByRole("heading", { name: "Condiciones previas para liberar resultados (RF-94a)" })).toBeVisible());
    const main = container.querySelector("main");
    expect(main).toHaveAttribute("data-layer", "brand");
    expect(getByText(/Votación de todas las jornadas cerrada por el Administrador/)).toBeVisible();
    expect(getByText(/Todas las planillas en estado Confirmada/)).toBeVisible();
    expect(getByText(/Cero ítems pendientes de calificación/)).toBeVisible();
    expect(getByText(/Rol autorizado: Escrutinio/)).toBeVisible();
  });
});

