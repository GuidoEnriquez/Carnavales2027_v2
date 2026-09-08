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
  id: "ballot-1", nightName: "Noche 1", specialtyName: "Baile", status: "OPEN", revision: 0,
  scores: [
    { id: "score-1", nightScheduleId: "schedule-1", presentationOrder: 1, troupeName: "Comparsa Uno", rubricId: "rubric-1", rubricName: "Reina", itemName: "Presencia", score: null, evaluationState: "PENDING", status: "DRAFT" },
    { id: "score-2", nightScheduleId: "schedule-2", presentationOrder: 2, troupeName: "Comparsa Dos", rubricId: "rubric-1", rubricName: "Reina", itemName: "Presencia", score: null, evaluationState: "PENDING", status: "DRAFT" },
  ],
};

function onlineApi() {
  apiRequest.mockImplementation((path, options) => {
    if (!options) return Promise.resolve(ballot);
    if (path.endsWith("/scores/score-1")) return Promise.resolve({ id: "score-1", evaluationState: "NOT_PRESENTED", score: 0, status: "DRAFT", revision: 1 });
    if (path.endsWith("/scores/score-2")) return Promise.resolve({ id: "score-2", evaluationState: "SCORED", score: 8, status: "DRAFT", revision: 2 });
    if (path.endsWith("/submit")) return Promise.resolve({ status: "SUBMITTED", revision: 3 });
    return Promise.resolve({});
  });
}

describe("JudgeBallotPage", () => {
  afterEach(() => { cleanup(); vi.clearAllMocks(); });

  it("confirma decisiones y planilla exclusivamente mediante API online", async () => {
    onlineApi();
    render(<JudgeBallotPage ballotId="ballot-1" />);
    await screen.findByRole("heading", { name: "Comparsa Uno", level: 2 });

    fireEvent.click(screen.getAllByRole("button", { name: "No se presentó" })[0]);
    fireEvent.click(screen.getByRole("button", { name: "Confirmar" }));
    await waitFor(() => expect(apiRequest).toHaveBeenCalledWith(
      "/api/v1/judge/ballots/ballot-1/scores/score-1",
      expect.objectContaining({ method: "PUT" }),
    ));

    const secondScore = screen.getByLabelText("Comparsa Dos: Presencia");
    fireEvent.click(within(secondScore).getByRole("radio", { name: /8.*Muy bueno/ }));
    fireEvent.click(screen.getByRole("radio", { name: "Confirmar" }));
    await waitFor(() => expect(apiRequest).toHaveBeenCalledWith(
      "/api/v1/judge/ballots/ballot-1/scores/score-2",
      expect.objectContaining({ method: "PUT" }),
    ));

    fireEvent.click(screen.getByRole("button", { name: "Confirmar planilla" }));
    fireEvent.click(await screen.findByRole("button", { name: "Confirmar y cerrar" }));
    await waitFor(() => expect(apiRequest).toHaveBeenCalledWith(
      "/api/v1/judge/ballots/ballot-1/submit",
      { method: "POST" },
    ));
    expect(await screen.findByRole("region", { name: "Planilla confirmada" })).toBeInTheDocument();
    expect(screen.queryByText(/pendiente de sincronización/i)).not.toBeInTheDocument();
  });

  it("conserva el ítem pendiente cuando no hay conexión", async () => {
    apiRequest.mockImplementation((path, options) => {
      if (!options) return Promise.resolve(ballot);
      if (path.includes("/scores/")) return Promise.reject(new ApiError({ code: "NETWORK_ERROR" }));
      return Promise.resolve({});
    });
    render(<JudgeBallotPage ballotId="ballot-1" />);
    await screen.findByRole("heading", { name: "Comparsa Uno", level: 2 });
    fireEvent.click(screen.getAllByRole("button", { name: "No se presentó" })[0]);
    fireEvent.click(screen.getByRole("button", { name: "Confirmar" }));
    expect(await screen.findByText(/no hay conexión/i)).toBeInTheDocument();
    expect(screen.getByRole("group", { name: "Comparsa Uno: Presencia" })).toBeInTheDocument();
  });

  it("muestra pendientes sin enviar una confirmación incompleta", async () => {
    apiRequest.mockResolvedValue(ballot);
    render(<JudgeBallotPage ballotId="ballot-1" />);
    await screen.findByRole("heading", { name: "Comparsa Uno", level: 2 });
    fireEvent.click(screen.getByRole("button", { name: "Confirmar planilla" }));
    const dialog = await screen.findByRole("dialog", { name: "Faltan decisiones por resolver" });
    expect(within(dialog).getAllByRole("listitem")).toHaveLength(2);
    expect(apiRequest).not.toHaveBeenCalledWith("/api/v1/judge/ballots/ballot-1/submit", { method: "POST" });
  });

  it("muestra pendientes si el servidor rechaza la confirmación", async () => {
    const complete = { ...ballot, scores: ballot.scores.map((score) => ({ ...score, score: 8, evaluationState: "SCORED" })) };
    apiRequest.mockImplementation((path, options) => {
      if (!options) return Promise.resolve(complete);
      if (path.endsWith("/submit")) return Promise.reject(new ApiError({ code: "BALLOT_INCOMPLETE", details: [{ id: "score-1", name: "Presencia", code: "PRESENCIA" }] }));
      return Promise.resolve({});
    });
    render(<JudgeBallotPage ballotId="ballot-1" />);
    await screen.findByRole("heading", { name: "Comparsa Uno", level: 2 });
    fireEvent.click(screen.getByRole("button", { name: "Confirmar planilla" }));
    fireEvent.click(await screen.findByRole("button", { name: "Confirmar y cerrar" }));
    expect(await screen.findByRole("dialog", { name: "Faltan decisiones por resolver" })).toBeInTheDocument();
  });

  it("bloquea acceso directo por URL a una comparsa en espera y redirige a la comparsa activa (RF-191)", async () => {
    apiRequest.mockResolvedValue(ballot);
    render(<JudgeBallotPage ballotId="ballot-1" troupeId="schedule-2" />);

    expect(await screen.findByRole("heading", { name: "Comparsa en espera de pasada", level: 1 })).toBeInTheDocument();
    expect(screen.getByText(/Debes calificar y confirmar los rubros de/i)).toBeInTheDocument();
    expect(screen.getByText("Comparsa Uno")).toBeInTheDocument();

    expect(screen.queryByRole("group", { name: "Comparsa Dos: Presencia" })).not.toBeInTheDocument();

    const redirectLink = screen.getByRole("link", { name: /Ir a comparsa actual/i });
    expect(redirectLink).toHaveAttribute("href", "#/judge/ballot?ballotId=ballot-1&troupeId=schedule-1");

    fireEvent.click(redirectLink);

    expect(screen.queryByRole("heading", { name: "Comparsa en espera de pasada" })).not.toBeInTheDocument();
    expect(await screen.findByRole("heading", { name: "Comparsa Uno", level: 2 })).toBeInTheDocument();
  });

  it("despliega banner de continuidad al completar el último ítem de una comparsa y avanza a la siguiente (RF-192)", async () => {
    onlineApi();
    render(<JudgeBallotPage ballotId="ballot-1" troupeId="schedule-1" />);
    await screen.findByRole("heading", { name: "Comparsa Uno", level: 2 });

    fireEvent.click(screen.getAllByRole("button", { name: "No se presentó" })[0]);
    fireEvent.click(screen.getByRole("button", { name: "Confirmar" }));

    const banner = await screen.findByRole("region", { name: "Pasada completada" });
    expect(within(banner).getByText(/¡Completaste la evaluación de Comparsa Uno!/i)).toBeInTheDocument();
    expect(within(banner).getByText(/Siguiente comparsa en pista:/i)).toBeInTheDocument();
    expect(within(banner).getByText("Comparsa Dos")).toBeInTheDocument();

    const nextBtn = within(banner).getByRole("button", { name: /Comenzar siguiente pasada/i });
    fireEvent.click(nextBtn);

    expect(screen.queryByRole("region", { name: "Pasada completada" })).not.toBeInTheDocument();
    expect(screen.getByRole("group", { name: "Comparsa Dos: Presencia" })).toBeInTheDocument();
  });

  it("muestra comparsa posterior como bloqueada en la barra lateral y en la lista (RF-190, RF-191)", async () => {
    apiRequest.mockResolvedValue(ballot);
    render(<JudgeBallotPage ballotId="ballot-1" troupeId="schedule-1" />);
    await screen.findByRole("heading", { name: "Comparsa Uno", level: 2 });

    const sidebarItems = screen.getAllByRole("button", { name: /Comparsa/ });
    const comparsaDosSidebar = sidebarItems.find((el) => el.textContent.includes("Comparsa Dos"));
    expect(comparsaDosSidebar).toBeDisabled();
    expect(comparsaDosSidebar).toHaveAttribute("aria-disabled", "true");

    expect(screen.getByText(/Se habilitará automáticamente al completar la comparsa anterior \(Comparsa Uno\)/i)).toBeInTheDocument();
  });
});
