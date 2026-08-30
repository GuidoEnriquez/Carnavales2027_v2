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
    { id: "score-1", nightScheduleId: "schedule-1", presentationOrder: 1, troupeName: "Comparsa Uno", rubricId: "rubric-1", rubricName: "Reina", itemName: "Presencia", score: null, status: "DRAFT" },
    { id: "score-2", nightScheduleId: "schedule-2", presentationOrder: 2, troupeName: "Comparsa Dos", rubricId: "rubric-1", rubricName: "Reina", itemName: "Presencia", score: null, status: "DRAFT" },
  ],
};

describe("JudgeBallotPage", () => {
  afterEach(() => { cleanup(); vi.clearAllMocks(); });

  it("carga comparsas, guarda 0 explícito y confirma la planilla", async () => {
    apiRequest.mockImplementation((path, options) => {
      if (path === "/api/v1/judge/ballots/ballot-1" && !options) return Promise.resolve(ballot);
      if (path.endsWith("/scores/score-1")) return Promise.resolve({ id: "score-1", score: 0, status: "DRAFT" });
      if (path.endsWith("/scores/score-2")) return Promise.resolve({ id: "score-2", score: 8, status: "DRAFT" });
      if (path.endsWith("/submit")) return Promise.resolve({ id: "ballot-1", status: "SUBMITTED" });
      return Promise.resolve({});
    });
    render(<JudgeBallotPage ballotId="ballot-1" />);

    expect(await screen.findByText("Comparsa Uno")).toBeInTheDocument();
    expect(screen.getByText("Comparsa Dos")).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Comparsa Uno: Presencia"), { target: { value: "0" } });
    await waitFor(() => expect(apiRequest).toHaveBeenCalledWith(
      "/api/v1/judge/ballots/ballot-1/scores/score-1",
      { method: "PUT", body: JSON.stringify({ score: 0 }) },
    ));
    fireEvent.change(screen.getByLabelText("Comparsa Dos: Presencia"), { target: { value: "8" } });
    await waitFor(() => expect(apiRequest).toHaveBeenCalledWith(
      "/api/v1/judge/ballots/ballot-1/scores/score-2",
      { method: "PUT", body: JSON.stringify({ score: 8 }) },
    ));
    fireEvent.click(screen.getByRole("button", { name: "Confirmar planilla" }));
    await waitFor(() => expect(apiRequest).toHaveBeenCalledWith(
      "/api/v1/judge/ballots/ballot-1/submit",
      { method: "POST" },
    ));
    expect(await screen.findByText(/planilla confirmada/i)).toBeInTheDocument();
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
