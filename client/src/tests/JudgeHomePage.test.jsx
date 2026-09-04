import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { apiRequest } from "../api/http.js";
import { JudgeHomePage } from "../pages/JudgeHomePage.jsx";

vi.mock("../api/http.js", () => ({ apiRequest: vi.fn() }));

describe("JudgeHomePage", () => {
  afterEach(() => { cleanup(); vi.clearAllMocks(); });

  it("aclara que un jurado registrado todavía no tiene planillas habilitadas", () => {
    render(<JudgeHomePage session={{ judgeProfile: { registrationStatus: "REGISTERED" } }} />);
    expect(screen.getByText(/no tenés planillas habilitadas/)).toBeInTheDocument();
    expect(screen.queryByText(/puntuar comparsa/i)).not.toBeInTheDocument();
  });

  it("muestra suspensión sin capacidades operativas", () => {
    render(<JudgeHomePage session={{ judgeProfile: { registrationStatus: "SUSPENDED" } }} />);
    expect(screen.getByRole("alert")).toHaveTextContent("Acceso suspendido");
  });

  it("deriva el progreso y el estado de cada planilla desde sus decisiones", async () => {
    apiRequest.mockImplementation((path) => {
      if (path === "/api/v1/judge/ballots") return Promise.resolve([
        { id: "ballot-1", eventName: "Carnaval", nightName: "Noche 1", specialtyName: "Baile", status: "OPEN" },
        { id: "ballot-2", eventName: "Carnaval", nightName: "Noche 2", specialtyName: "Vestuario", status: "SUBMITTED" },
      ]);
      if (path.endsWith("ballot-1")) return Promise.resolve({ scores: [
        { nightScheduleId: "schedule-1", troupeName: "Ara Berá", presentationOrder: 1, evaluationState: "SCORED" },
        { nightScheduleId: "schedule-1", troupeName: "Ara Berá", presentationOrder: 1, evaluationState: "PENDING" },
      ] });
      return Promise.resolve({ scores: [{ nightScheduleId: "schedule-2", troupeName: "Porambá", presentationOrder: 2, evaluationState: "SCORED" }] });
    });

    render(<JudgeHomePage session={{ user: { id: "judge-1", name: "Juana Pérez" }, judgeProfile: { registrationStatus: "REGISTERED" } }} />);

    expect(await screen.findByText("En progreso")).toBeInTheDocument();
    expect(screen.getByText("Planilla confirmada")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Ara Berá", level: 3 })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Continuar/ })).toHaveAttribute("href", "#/judge/ballot?ballotId=ballot-1&troupeId=schedule-1");
    expect(screen.getByRole("region", { name: "Progreso general" })).toHaveTextContent("Comparsas evaluadas 1 / 2");
  });
});
