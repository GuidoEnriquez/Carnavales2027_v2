import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ApiError, apiRequest } from "../api/http.js";
import { JudgeBallotPage } from "../pages/JudgeBallotPage.jsx";

vi.mock("../api/http.js", () => ({
  ApiError: class ApiError extends Error {
    constructor({ code, details }) { super(code); this.code = code; this.details = details; }
  },
  apiRequest: vi.fn(),
}));

const ballotV3 = {
  id: "ballot-v3",
  nightName: "Noche 1 - Inaugural",
  specialtyName: "Música y Batería",
  status: "OPEN",
  revision: 1,
  scores: [
    {
      id: "score-1",
      nightScheduleId: "schedule-1",
      presentationOrder: 1,
      troupeName: "Comparsa Verde",
      brandColor: "#10B981",
      rubricId: "rubric-1",
      rubricName: "Batería",
      itemName: "Ritmo y Cadencia",
      score: null,
      evaluationState: "PENDING",
      status: "DRAFT",
    },
    {
      id: "score-2",
      nightScheduleId: "schedule-1",
      presentationOrder: 1,
      troupeName: "Comparsa Verde",
      brandColor: "#10B981",
      rubricId: "rubric-1",
      rubricName: "Batería",
      itemName: "Afinación",
      score: null,
      evaluationState: "PENDING",
      status: "DRAFT",
    },
    {
      id: "score-3",
      nightScheduleId: "schedule-2",
      presentationOrder: 2,
      troupeName: "Comparsa Azul",
      brandColor: "#3B82F6",
      rubricId: "rubric-1",
      rubricName: "Batería",
      itemName: "Ritmo y Cadencia",
      score: null,
      evaluationState: "PENDING",
      status: "DRAFT",
    },
  ],
};

describe("JudgeBallotPage v3 (Spec 021)", () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("permite alternar entre modo tarjeta y lista completa (RF-184)", async () => {
    apiRequest.mockResolvedValue(ballotV3);
    render(<JudgeBallotPage ballotId="ballot-v3" />);

    await screen.findByRole("heading", { name: "Comparsa Verde", level: 2 });

    const toggleBtn = screen.getByRole("button", { name: /Ver tarjeta única|Ver lista completa/ });
    expect(toggleBtn).toBeInTheDocument();

    // Toggle to card mode
    fireEvent.click(toggleBtn);
    expect(await screen.findByText(/Salida 1 · Música y Batería/)).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Ritmo y Cadencia", level: 3 })).toBeInTheDocument();

    // Toggle back to list mode
    fireEvent.click(screen.getByRole("button", { name: /Ver lista completa/ }));
    expect(screen.getByRole("region", { name: "Puntuaciones por comparsa" })).toBeInTheDocument();
  });

  it("implementa doble tap in situ: 1er tap preselecciona, 2do tap en el mismo botón guarda inmutablemente (RF-185)", async () => {
    apiRequest.mockImplementation((path, options) => {
      if (!options) return Promise.resolve(ballotV3);
      if (path.endsWith("/scores/score-1")) {
        return Promise.resolve({ id: "score-1", evaluationState: "SCORED", score: 9, status: "DRAFT", revision: 2 });
      }
      return Promise.resolve({});
    });

    render(<JudgeBallotPage ballotId="ballot-v3" />);
    await screen.findByRole("heading", { name: "Comparsa Verde", level: 2 });

    const scoreItem = screen.getByRole("group", { name: "Comparsa Verde: Ritmo y Cadencia" });
    const btn9 = within(scoreItem).getByRole("radio", { name: /9 Excelente/ });

    // 1st tap: preselects 9 (staged) without calling save API
    fireEvent.click(btn9);
    expect(apiRequest).not.toHaveBeenCalledWith(
      expect.stringContaining("/scores/score-1"),
      expect.anything(),
    );
    expect(btn9).toHaveClass("is-staged");
    expect(within(scoreItem).getByRole("radio", { name: "Confirmar" })).toBeInTheDocument();

    // Tapping another number (e.g. 7) moves the staged selection without saving
    const btn7 = within(scoreItem).getByRole("radio", { name: /7 Bueno/ });
    fireEvent.click(btn7);
    expect(apiRequest).not.toHaveBeenCalledWith(
      expect.stringContaining("/scores/score-1"),
      expect.anything(),
    );
    expect(btn7).toHaveClass("is-staged");
    expect(btn9).not.toHaveClass("is-staged");

    // 2nd tap on the staged button 7 confirms and triggers saveScore
    fireEvent.click(within(scoreItem).getByRole("radio", { name: "Confirmar" }));
    await waitFor(() => {
      expect(apiRequest).toHaveBeenCalledWith(
        "/api/v1/judge/ballots/ballot-v3/scores/score-1",
        expect.objectContaining({
          method: "PUT",
          body: JSON.stringify({ evaluationState: "SCORED", score: 7 }),
        }),
      );
    });
  });

  it("segrega 'No se presentó' y exige confirmación en modal dedicado (RF-186)", async () => {
    apiRequest.mockImplementation((path, options) => {
      if (!options) return Promise.resolve(ballotV3);
      if (path.endsWith("/scores/score-1")) {
        return Promise.resolve({ id: "score-1", evaluationState: "NOT_PRESENTED", score: 0, status: "DRAFT", revision: 2 });
      }
      return Promise.resolve({});
    });

    render(<JudgeBallotPage ballotId="ballot-v3" />);
    await screen.findByRole("heading", { name: "Comparsa Verde", level: 2 });

    // Click "No se presentó"
    fireEvent.click(screen.getAllByRole("button", { name: "No se presentó" })[0]);

    // Modal dialog appears
    const dialog = await screen.findByRole("dialog", { name: "Confirmación de voto" });
    expect(within(dialog).getByText(/Esta acción registrará 0 \(cero\) puntos de manera inmutable/)).toBeInTheDocument();

    // Confirm inside modal
    fireEvent.click(within(dialog).getByRole("button", { name: "Confirmar" }));

    await waitFor(() => {
      expect(apiRequest).toHaveBeenCalledWith(
        "/api/v1/judge/ballots/ballot-v3/scores/score-1",
        expect.objectContaining({
          method: "PUT",
          body: JSON.stringify({ evaluationState: "NOT_PRESENTED", score: 0 }),
        }),
      );
    });
  });

  it("maneja fallo de red con estado granular y botón 'Reintentar' aislado sin bloquear otros ítems (RF-187)", async () => {
    let callCount = 0;
    apiRequest.mockImplementation((path, options) => {
      if (!options) return Promise.resolve(ballotV3);
      if (path.endsWith("/scores/score-1")) {
        callCount++;
        if (callCount === 1) {
          return Promise.reject(new ApiError({ code: "NETWORK_ERROR" }));
        }
        return Promise.resolve({ id: "score-1", evaluationState: "SCORED", score: 8, status: "DRAFT", revision: 2 });
      }
      if (path.endsWith("/scores/score-2")) {
        return Promise.resolve({ id: "score-2", evaluationState: "SCORED", score: 10, status: "DRAFT", revision: 3 });
      }
      return Promise.resolve({});
    });

    render(<JudgeBallotPage ballotId="ballot-v3" />);
    await screen.findByRole("heading", { name: "Comparsa Verde", level: 2 });

    const score1 = screen.getByRole("group", { name: "Comparsa Verde: Ritmo y Cadencia" });
    const score2 = screen.getByRole("group", { name: "Comparsa Verde: Afinación" });

    // Click 8 on score-1, then click Confirmar -> fails with NETWORK_ERROR
    fireEvent.click(within(score1).getByRole("radio", { name: /8 Muy bueno/ }));
    fireEvent.click(within(score1).getByRole("radio", { name: "Confirmar" }));

    // score-1 shows error and Reintentar
    const retryBtn = await within(score1).findByRole("button", { name: "Reintentar" });
    expect(retryBtn).toBeInTheDocument();

    // Meanwhile, score-2 is NOT blocked: we can interact with score-2
    const score2Btn = within(score2).getByRole("radio", { name: /10 Excelente/ });
    expect(score2Btn).not.toBeDisabled();
    fireEvent.click(score2Btn);
    fireEvent.click(within(score2).getByRole("radio", { name: "Confirmar" }));

    await waitFor(() => {
      expect(apiRequest).toHaveBeenCalledWith(
        "/api/v1/judge/ballots/ballot-v3/scores/score-2",
        expect.anything(),
      );
    });

    // Now click Reintentar on score-1 -> succeeds
    fireEvent.click(retryBtn);
    await waitFor(() => {
      expect(callCount).toBe(2);
    });
  });

  it("muestra barra inferior fija con avance y diálogo de faltantes con salto directo (RF-188)", async () => {
    apiRequest.mockResolvedValue(ballotV3);
    render(<JudgeBallotPage ballotId="ballot-v3" />);
    await screen.findByRole("heading", { name: "Comparsa Verde", level: 2 });

    // Bottom navigation bar is rendered
    const bottomBar = screen.getByRole("navigation", { name: "Navegación de planilla" });
    expect(bottomBar).toBeInTheDocument();
    expect(within(bottomBar).getByText("Ítem 1 de 3")).toBeInTheDocument();

    // Click "Faltantes (3)"
    const faltantesBtn = within(bottomBar).getByRole("button", { name: /Faltantes \(3\)/ });
    fireEvent.click(faltantesBtn);

    // Dialog opens with pending list
    const dialog = await screen.findByRole("dialog", { name: "Ítems pendientes" });
    const items = within(dialog).getAllByRole("listitem");
    expect(items).toHaveLength(3);

    // Click on the 3rd pending item (Comparsa Azul: Ritmo y Cadencia)
    const thirdItemBtn = within(items[2]).getByRole("button");
    expect(thirdItemBtn).toHaveTextContent("Comparsa Azul");
    fireEvent.click(thirdItemBtn);

    // Dialog closes and bottom counter updates
    await waitFor(() => {
      expect(screen.queryByRole("dialog", { name: "Ítems pendientes" })).not.toBeInTheDocument();
    });
    expect(within(bottomBar).getByText("Ítem 3 de 3")).toBeInTheDocument();
  });

  it("soporta atajos de teclado numérico (1-0) y Enter para confirmar en desktop (RF-189)", async () => {
    apiRequest.mockImplementation((path, options) => {
      if (!options) return Promise.resolve(ballotV3);
      if (path.endsWith("/scores/score-1")) {
        return Promise.resolve({ id: "score-1", evaluationState: "SCORED", score: 8, status: "DRAFT", revision: 2 });
      }
      return Promise.resolve({});
    });

    render(<JudgeBallotPage ballotId="ballot-v3" />);
    await screen.findByRole("heading", { name: "Comparsa Verde", level: 2 });

    // Press '8' on keyboard
    fireEvent.keyDown(window, { key: "8" });

    const score1 = screen.getByRole("group", { name: "Comparsa Verde: Ritmo y Cadencia" });
    const btn8 = within(score1).getByRole("radio", { name: "Confirmar" });
    expect(btn8).toHaveClass("is-staged");

    // Press 'Enter' on keyboard
    fireEvent.keyDown(window, { key: "Enter" });

    await waitFor(() => {
      expect(apiRequest).toHaveBeenCalledWith(
        "/api/v1/judge/ballots/ballot-v3/scores/score-1",
        expect.objectContaining({
          method: "PUT",
          body: JSON.stringify({ evaluationState: "SCORED", score: 8 }),
        }),
      );
    });
  });
});
