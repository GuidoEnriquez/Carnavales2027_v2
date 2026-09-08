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
      if (path.startsWith("/api/v1/judge/ballots")) {
        if (path.endsWith("ballot-1")) return Promise.resolve({ scores: [
          { nightScheduleId: "schedule-1", troupeName: "Ara Berá", presentationOrder: 1, evaluationState: "SCORED" },
          { nightScheduleId: "schedule-1", troupeName: "Ara Berá", presentationOrder: 1, evaluationState: "PENDING" },
        ] });
        if (path.endsWith("ballot-2")) return Promise.resolve({ scores: [
          { nightScheduleId: "schedule-2", troupeName: "Porambá", presentationOrder: 2, evaluationState: "SCORED" },
        ] });
        return Promise.resolve([
          { id: "ballot-1", eventName: "Carnaval", nightName: "Noche 1", specialtyName: "Baile", status: "OPEN" },
          { id: "ballot-2", eventName: "Carnaval", nightName: "Noche 2", specialtyName: "Vestuario", status: "SUBMITTED" },
        ]);
      }
      return Promise.resolve({});
    });

    render(<JudgeHomePage session={{ user: { id: "judge-1", name: "Juana Pérez" }, judgeProfile: { registrationStatus: "REGISTERED" } }} />);

    expect(await screen.findByText("En progreso")).toBeInTheDocument();
    expect(screen.getByText("Planilla confirmada")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Ara Berá", level: 3 })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Continuar/ })).toHaveAttribute("href", "#/judge/ballot?ballotId=ballot-1&troupeId=schedule-1");
    expect(screen.getByRole("region", { name: "Progreso general" })).toHaveTextContent("Comparsas evaluadas 1 / 2");
  });

  it("renderiza progreso y comparsas directamente con include=progress sin llamadas N+1 (RF-183)", async () => {
    apiRequest.mockImplementation((path) => {
      if (path === "/api/v1/judge/ballots?include=progress") {
        return Promise.resolve([
          {
            id: "ballot-1",
            eventName: "Carnaval Goya",
            nightName: "Noche 1",
            specialtyName: "Baile",
            status: "OPEN",
            totalScores: 4,
            resolvedScores: 2,
            troupes: [
              {
                troupeId: "sched-1",
                troupeName: "Ara Berá",
                brandColor: "#10B981",
                presentationOrder: 1,
                total: 2,
                resolved: 2,
              },
              {
                troupeId: "sched-2",
                troupeName: "Sapucay",
                brandColor: "#3B82F6",
                presentationOrder: 2,
                total: 2,
                resolved: 0,
              },
            ],
          },
        ]);
      }
      return Promise.reject(new Error(`Llamada inesperada: ${path}`));
    });

    render(<JudgeHomePage session={{ user: { id: "judge-1", name: "Juana Pérez" }, judgeProfile: { registrationStatus: "REGISTERED" } }} />);

    expect(await screen.findByRole("heading", { name: "Ara Berá", level: 3 })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Sapucay", level: 3 })).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Progreso general" })).toHaveTextContent("Comparsas evaluadas 0 / 2");
    expect(apiRequest).toHaveBeenCalledTimes(1);
    expect(apiRequest).toHaveBeenCalledWith("/api/v1/judge/ballots?include=progress");
  });

  it("renderiza bajo la capa de instrumento data-layer='instrument'", () => {
    const { container } = render(<JudgeHomePage session={{ user: { id: "judge-1" }, judgeProfile: { registrationStatus: "REGISTERED" } }} />);
    expect(container.querySelector("main.judge-home")).toHaveAttribute("data-layer", "instrument");
  });

  it("bloquea comparsas posteriores si la comparsa precedente tiene evaluaciones pendientes (Spec 025 / RF-189, RF-190)", async () => {
    apiRequest.mockImplementation((path) => {
      if (path === "/api/v1/judge/ballots?include=progress") {
        return Promise.resolve([
          {
            id: "ballot-1",
            eventName: "Carnaval Goya",
            nightName: "Noche 1",
            specialtyName: "Música",
            status: "OPEN",
            totalScores: 4,
            resolvedScores: 1,
            troupes: [
              {
                troupeId: "sched-1",
                troupeName: "Ara Berá",
                presentationOrder: 1,
                total: 2,
                resolved: 1,
              },
              {
                troupeId: "sched-2",
                troupeName: "Sapucay",
                presentationOrder: 2,
                total: 2,
                resolved: 0,
              },
            ],
          },
        ]);
      }
      return Promise.reject(new Error(`Llamada inesperada: ${path}`));
    });

    render(<JudgeHomePage session={{ user: { id: "judge-1", name: "Juana Pérez" }, judgeProfile: { registrationStatus: "REGISTERED" } }} />);

    // Comparsa 1: Habilitada para continuar
    expect(await screen.findByRole("heading", { name: "Ara Berá", level: 3 })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Continuar/ })).toHaveAttribute("href", "#/judge/ballot?ballotId=ballot-1&troupeId=sched-1");

    // Comparsa 2: Bloqueada con candado y botón inactivo
    expect(screen.getByRole("heading", { name: "Sapucay", level: 3 })).toBeInTheDocument();
    expect(screen.getByText("En espera")).toBeInTheDocument();
    expect(screen.getByText(/Se habilitará al completar la comparsa anterior/)).toBeInTheDocument();

    const disabledBtn = screen.getByRole("button", { name: /En espera de pasada/ });
    expect(disabledBtn).toBeDisabled();
    expect(disabledBtn).toHaveAttribute("aria-disabled", "true");

    // No debe existir link de navegación para Sapucay
    expect(screen.queryByRole("link", { name: /Comenzar/ })).not.toBeInTheDocument();
  });

  it("desbloquea secuencialmente la siguiente comparsa en cuanto la anterior está completa (Spec 025 / RF-189, RF-190)", async () => {
    apiRequest.mockImplementation((path) => {
      if (path === "/api/v1/judge/ballots?include=progress") {
        return Promise.resolve([
          {
            id: "ballot-1",
            eventName: "Carnaval Goya",
            nightName: "Noche 1",
            specialtyName: "Música",
            status: "OPEN",
            totalScores: 6,
            resolvedScores: 2,
            troupes: [
              {
                troupeId: "sched-1",
                troupeName: "Ara Berá",
                presentationOrder: 1,
                total: 2,
                resolved: 2, // Completa al 100%
              },
              {
                troupeId: "sched-2",
                troupeName: "Sapucay",
                presentationOrder: 2,
                total: 2,
                resolved: 0, // Habilitada porque la anterior terminó
              },
              {
                troupeId: "sched-3",
                troupeName: "Kamarr",
                presentationOrder: 3,
                total: 2,
                resolved: 0, // Bloqueada porque Sapucay aún no terminó
              },
            ],
          },
        ]);
      }
      return Promise.reject(new Error(`Llamada inesperada: ${path}`));
    });

    render(<JudgeHomePage session={{ user: { id: "judge-1", name: "Juana Pérez" }, judgeProfile: { registrationStatus: "REGISTERED" } }} />);

    // Comparsa 1: Lista para revisar
    expect(await screen.findByRole("heading", { name: "Ara Berá", level: 3 })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Continuar/ })).toHaveAttribute("href", "#/judge/ballot?ballotId=ballot-1&troupeId=sched-1");

    // Comparsa 2: Desbloqueada y lista para comenzar
    expect(screen.getByRole("heading", { name: "Sapucay", level: 3 })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Comenzar/ })).toHaveAttribute("href", "#/judge/ballot?ballotId=ballot-1&troupeId=sched-2");

    // Comparsa 3: Bloqueada en espera
    expect(screen.getByRole("heading", { name: "Kamarr", level: 3 })).toBeInTheDocument();
    const kamarrBtn = screen.getByRole("button", { name: /En espera de pasada/ });
    expect(kamarrBtn).toBeDisabled();
  });
});
