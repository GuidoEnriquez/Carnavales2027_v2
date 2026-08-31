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

const ballot = {
  id: "ballot-1",
  eventName: "Carnaval",
  nightName: "Noche 1",
  specialtyName: "Baile",
  status: "OPEN",
  revision: 0,
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
      if (path.endsWith("/sync")) {
        const request = JSON.parse(options.body);
        return Promise.resolve({ revision: request.baseRevision + request.operations.length, operations: request.operations });
      }
      return Promise.resolve({});
    });
    render(<JudgeBallotPage ballotId="ballot-1" />);

    expect(await screen.findByText("Comparsa Uno")).toBeInTheDocument();
    expect(screen.getByText("Comparsa Dos")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "0" })).not.toBeInTheDocument();
    fireEvent.click(screen.getAllByRole("button", { name: "No se presentó" })[0]);
    await waitFor(() => expect(apiRequest).toHaveBeenCalledWith(
      "/api/v1/judge/ballots/ballot-1/sync",
      expect.objectContaining({ method: "POST" }),
    ));
    fireEvent.click(screen.getAllByRole("button", { name: "8" })[1]);
    await waitFor(() => expect(apiRequest).toHaveBeenCalledTimes(3));
    fireEvent.click(screen.getByRole("button", { name: "Confirmar planilla" }));
    await waitFor(() => expect(apiRequest).toHaveBeenCalledTimes(4));
    expect(await screen.findByText(/planilla confirmada/i)).toBeInTheDocument();
  });

  it("permite quitar una decisión antes de confirmar", async () => {
    apiRequest.mockImplementation((path, options) => {
      if (!options) return Promise.resolve({ ...ballot, scores: [{ ...ballot.scores[0], score: 4, evaluationState: "SCORED" }] });
      if (path.endsWith("/sync")) return Promise.resolve({ revision: 1, operations: [] });
      return Promise.resolve({});
    });
    render(<JudgeBallotPage ballotId="ballot-1" />);

    await screen.findByText("Comparsa Uno");
    fireEvent.click(screen.getByRole("button", { name: "Quitar decisión" }));
    await waitFor(() => expect(apiRequest).toHaveBeenCalledWith(
      "/api/v1/judge/ballots/ballot-1/sync",
      expect.objectContaining({ method: "POST" }),
    ));
  });

  it("muestra todos los pendientes en un diálogo y no envía una confirmación incompleta", async () => {
    apiRequest.mockImplementation((path, options) => {
      if (!options) return Promise.resolve(ballot);
      return Promise.resolve({});
    });
    render(<JudgeBallotPage ballotId="ballot-1" />);

    await screen.findByText("Comparsa Uno");
    const submitButton = screen.getByRole("button", { name: "Confirmar planilla" });
    fireEvent.click(submitButton);

    const dialog = await screen.findByRole("dialog", { name: "Faltan decisiones por resolver" });
    expect(dialog).toHaveAttribute("aria-modal", "true");
    expect(dialog).toHaveAttribute("aria-describedby", "pending-dialog-description");
    expect(within(dialog).getByText("Asigná una puntuación de 1 a 10 o marcá No se presentó en cada ítem antes de confirmar.")).toBeInTheDocument();
    expect(within(dialog).getAllByRole("listitem")).toHaveLength(2);
    expect(within(dialog).getByText("Comparsa Uno")).toBeInTheDocument();
    expect(within(dialog).getByText("Comparsa Dos")).toBeInTheDocument();
    expect(within(dialog).getAllByText("Reina")).toHaveLength(2);
    expect(within(dialog).getAllByText("Presencia")).toHaveLength(2);
    expect(apiRequest).not.toHaveBeenCalledWith(
      "/api/v1/judge/ballots/ballot-1/submit",
      { method: "POST" },
    );

    fireEvent.click(within(dialog).getByRole("button", { name: "Volver a la planilla" }));
    await waitFor(() => expect(submitButton).toHaveFocus());

    fireEvent.click(submitButton);
    const reopenedDialog = await screen.findByRole("dialog", { name: "Faltan decisiones por resolver" });
    fireEvent(reopenedDialog, new Event("cancel", { cancelable: true }));
    await waitFor(() => expect(submitButton).toHaveFocus());
  });

  it("muestra el mismo diálogo si el servidor rechaza una planilla desactualizada", async () => {
    const completeBallot = {
      ...ballot,
      scores: ballot.scores.map((score) => ({ ...score, score: 8, evaluationState: "SCORED" })),
    };
    apiRequest.mockImplementation((path, options) => {
      if (!options) return Promise.resolve(completeBallot);
      if (path.endsWith("/sync") && JSON.parse(options.body).operations.some((operation) => operation.type === "SUBMIT_BALLOT")) return Promise.reject(new ApiError({
        code: "BALLOT_INCOMPLETE",
        details: [{ id: "score-1", name: "Presencia", code: "PRESENCIA" }],
      }));
      return Promise.resolve({});
    });
    render(<JudgeBallotPage ballotId="ballot-1" />);

    await screen.findByText("Comparsa Uno");
    fireEvent.click(screen.getByRole("button", { name: "Confirmar planilla" }));

    const dialog = await screen.findByRole("dialog", { name: "Faltan decisiones por resolver" });
    expect(within(dialog).getByText("Comparsa Uno")).toBeInTheDocument();
    expect(within(dialog).getByText("Reina")).toBeInTheDocument();
    expect(within(dialog).getByText("Presencia")).toBeInTheDocument();
  });

  it("detiene la cola ante un conflicto de revisión sin sobrescribir la planilla", async () => {
    apiRequest.mockImplementation((path, options) => {
      if (!options) return Promise.resolve(ballot);
      if (path.endsWith("/sync")) return Promise.reject(new ApiError({ code: "BALLOT_REVISION_CONFLICT" }));
      return Promise.resolve({});
    });
    render(<JudgeBallotPage ballotId="ballot-1" />);

    await screen.findByText("Comparsa Uno");
    fireEvent.click(screen.getAllByRole("button", { name: "No se presentó" })[0]);

    expect(await screen.findByText(/cambió en otro dispositivo/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Recargar estado canónico" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Descartar cambios locales" })).toBeInTheDocument();
  });
});
