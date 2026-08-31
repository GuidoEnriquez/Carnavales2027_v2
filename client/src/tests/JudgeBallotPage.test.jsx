import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ApiError, apiRequest } from "../api/http.js";
import { JudgeBallotPage } from "../pages/JudgeBallotPage.jsx";

vi.mock("../api/http.js", () => ({
  ApiError: class ApiError extends Error {
    constructor({ code, details }) { super(code); this.code = code; this.details = details; }
  },
  apiRequest: vi.fn(),
}));

const ballot = {
  id: "ballot-1",
  eventName: "Carnaval",
  nightName: "Noche 1",
  specialtyName: "Baile",
  status: "OPEN",
  scores: [
    { id: "score-1", nightScheduleId: "schedule-1", presentationOrder: 1, troupeName: "Comparsa Uno", rubricId: "rubric-1", rubricName: "Reina", itemName: "Presencia", score: null, evaluationState: "PENDING", status: "DRAFT" },
    { id: "score-2", nightScheduleId: "schedule-2", presentationOrder: 2, troupeName: "Comparsa Dos", rubricId: "rubric-1", rubricName: "Reina", itemName: "Presencia", score: null, evaluationState: "PENDING", status: "DRAFT" },
  ],
};

describe("JudgeBallotPage", () => {
  afterEach(() => { cleanup(); vi.clearAllMocks(); });

  it("carga comparsas, separa no presentado de la escala y confirma la planilla", async () => {
    apiRequest.mockImplementation((path, options) => {
      if (path === "/api/v1/judge/ballots/ballot-1" && !options) return Promise.resolve(ballot);
      if (path.endsWith("/scores/score-1")) return Promise.resolve({ id: "score-1", score: 0, evaluationState: "NOT_PRESENTED", status: "DRAFT" });
      if (path.endsWith("/scores/score-2")) return Promise.resolve({ id: "score-2", score: 8, evaluationState: "SCORED", status: "DRAFT" });
      if (path.endsWith("/submit")) return Promise.resolve({ id: "ballot-1", status: "SUBMITTED" });
      return Promise.resolve({});
    });
    render(<JudgeBallotPage ballotId="ballot-1" />);

    expect(await screen.findByText("Comparsa Uno")).toBeInTheDocument();
    expect(screen.getByText("Comparsa Dos")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "0" })).not.toBeInTheDocument();
    fireEvent.click(screen.getAllByRole("button", { name: "No se presentó" })[0]);
    await waitFor(() => expect(apiRequest).toHaveBeenCalledWith(
      "/api/v1/judge/ballots/ballot-1/scores/score-1",
      { method: "PUT", body: JSON.stringify({ evaluationState: "NOT_PRESENTED" }) },
    ));
    fireEvent.click(screen.getAllByRole("button", { name: "8" })[1]);
    await waitFor(() => expect(apiRequest).toHaveBeenCalledWith(
      "/api/v1/judge/ballots/ballot-1/scores/score-2",
      { method: "PUT", body: JSON.stringify({ evaluationState: "SCORED", score: 8 }) },
    ));
    fireEvent.click(screen.getByRole("button", { name: "Confirmar planilla" }));
    await waitFor(() => expect(apiRequest).toHaveBeenCalledWith(
      "/api/v1/judge/ballots/ballot-1/submit",
      { method: "POST" },
    ));
    expect(await screen.findByText(/planilla confirmada/i)).toBeInTheDocument();
  });

  it("permite quitar una decisión antes de confirmar", async () => {
    apiRequest.mockImplementation((path, options) => {
      if (!options) return Promise.resolve({ ...ballot, scores: [{ ...ballot.scores[0], score: 4, evaluationState: "SCORED" }] });
      if (path.endsWith("/scores/score-1")) return Promise.resolve({ id: "score-1", score: null, evaluationState: "PENDING", status: "DRAFT" });
      return Promise.resolve({});
    });
    render(<JudgeBallotPage ballotId="ballot-1" />);

    await screen.findByText("Comparsa Uno");
    fireEvent.click(screen.getByRole("button", { name: "Quitar decisión" }));
    await waitFor(() => expect(apiRequest).toHaveBeenCalledWith(
      "/api/v1/judge/ballots/ballot-1/scores/score-1",
      { method: "PUT", body: JSON.stringify({ evaluationState: "PENDING" }) },
    ));
  });

  it("informa los ítems pendientes al rechazar la confirmación", async () => {
    apiRequest.mockImplementation((path, options) => {
      if (!options) return Promise.resolve(ballot);
      if (path.endsWith("/submit")) return Promise.reject(new ApiError({
        code: "BALLOT_INCOMPLETE",
        details: [{ id: "score-1", name: "Presencia", code: "PRESENCIA" }],
      }));
      return Promise.resolve({});
    });
    render(<JudgeBallotPage ballotId="ballot-1" />);

    await screen.findByText("Comparsa Uno");
    fireEvent.click(screen.getByRole("button", { name: "Confirmar planilla" }));
    expect(await screen.findByText(/faltan puntuaciones.*presencia/i)).toBeInTheDocument();
  });
});
