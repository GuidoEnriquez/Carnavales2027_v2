import { cleanup, render, waitFor } from "@testing-library/react";
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
      return Promise.reject(new Error(`request inesperado: ${path}`));
    });

    const { getByRole, getByText } = render(<AdminResultsPage />);

    await waitFor(() => expect(getByRole("heading", { name: "Empate pendiente" })).toBeVisible());
    expect(getByRole("option", { name: "test_prueba" })).toBeVisible();
    expect(getByText("Comparsa Test A")).toBeVisible();
    expect(getByText("Comparsa Test B")).toBeVisible();
    expect(getByRole("button", { name: /iniciar sorteo ceremonial/i })).toBeVisible();
  });

  it("no queda cargando indefinidamente si falla la carga de competencias", async () => {
    apiRequestMock.mockRejectedValue(new Error("API caída"));

    const { getByText, queryByText } = render(<AdminResultsPage />);

    await waitFor(() => expect(getByText(/no se pudieron cargar las competencias/i)).toBeVisible());
    expect(queryByText(/cargando resultados/i)).not.toBeInTheDocument();
  });
});
