import { cleanup, render, screen, within } from "@testing-library/react";
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
    expect(screen.getByRole("region", { name: "Progreso general" })).toHaveTextContent("1 de 2 comparsas evaluadas");
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
    expect(screen.getByRole("region", { name: "Progreso general" })).toHaveTextContent("1 de 2 comparsas evaluadas");
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

    // Comparsa 2: Bloqueada, compacta en PRÓXIMAS, sin botón ni link (TAREA 1)
    expect(screen.getByRole("heading", { name: "Sapucay", level: 3 })).toBeInTheDocument();
    expect(screen.getByText("En espera")).toBeInTheDocument();
    // La explicación del orden de pasada aparece una sola vez, no por comparsa
    expect(screen.getAllByText(/se habilitan según el orden de pasada/i)).toHaveLength(1);
    expect(screen.queryByRole("button", { name: /En espera de pasada/ })).not.toBeInTheDocument();

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

    // Comparsa 1: completa, consulta secundaria en Evaluadas
    expect(await screen.findByRole("heading", { name: "Ara Berá", level: 3 })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Ver evaluación/ })).toHaveAttribute("href", "#/judge/ballot?ballotId=ballot-1&troupeId=sched-1");

    // Comparsa 2: Desbloqueada y lista para comenzar
    expect(screen.getByRole("heading", { name: "Sapucay", level: 3 })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Comenzar/ })).toHaveAttribute("href", "#/judge/ballot?ballotId=ballot-1&troupeId=sched-2");

    // Comparsa 3: Bloqueada en espera, compacta y sin acción (TAREA 1)
    expect(screen.getByRole("heading", { name: "Kamarr", level: 3 })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /En espera de pasada/ })).not.toBeInTheDocument();
  });

  it("muestra una única comparsa protagonista con CTA primario (TAREA 2)", async () => {
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
                { troupeId: "sched-1", troupeName: "Ara Berá", presentationOrder: 1, total: 2, resolved: 1 },
                { troupeId: "sched-2", troupeName: "Sapucay", presentationOrder: 2, total: 2, resolved: 0 },
            ],
          },
        ]);
      }
      return Promise.reject(new Error(`Llamada inesperada: ${path}`));
    });

    render(<JudgeHomePage session={{ user: { id: "judge-1", name: "Juana Pérez" }, judgeProfile: { registrationStatus: "REGISTERED" } }} />);

    const nowSection = await screen.findByRole("region", { name: "Comparsa actual" });
    const cta = nowSection.querySelector("a.judge-now-cta");
    expect(cta).not.toBeNull();
    expect(cta).toHaveTextContent(/Continuar evaluación →/);
    expect(cta).toHaveAttribute("href", "#/judge/ballot?ballotId=ballot-1&troupeId=sched-1");
    // Un solo CTA primario en toda la pantalla
    expect(document.querySelectorAll("a.judge-now-cta")).toHaveLength(1);
  });

  it("mantiene acceso a planillas cerradas con acción secundaria (TAREA 2)", async () => {
    apiRequest.mockImplementation((path) => {
      if (path === "/api/v1/judge/ballots?include=progress") {
        return Promise.resolve([
          {
            id: "ballot-1",
            eventName: "Carnaval Goya",
            nightName: "Noche 1",
            specialtyName: "Baile",
            status: "SUBMITTED",
            totalScores: 2,
            resolvedScores: 2,
            troupes: [
                { troupeId: "sched-1", troupeName: "Ara Berá", presentationOrder: 1, total: 2, resolved: 2 },
            ],
          },
        ]);
      }
      return Promise.reject(new Error(`Llamada inesperada: ${path}`));
    });

    render(<JudgeHomePage session={{ user: { id: "judge-1", name: "Juana Pérez" }, judgeProfile: { registrationStatus: "REGISTERED" } }} />);

    const evaluated = await screen.findByRole("region", { name: "Comparsas evaluadas" });
    const verPlanilla = evaluated.querySelector("a.judge-list-action");
    expect(verPlanilla).not.toBeNull();
    expect(verPlanilla).toHaveTextContent(/Ver planilla →/);
    expect(verPlanilla).toHaveAttribute("href", "#/judge/ballot?ballotId=ballot-1&troupeId=sched-1");
    // Sin sección protagonista cuando todo está confirmado
    expect(screen.queryByRole("region", { name: "Comparsa actual" })).not.toBeInTheDocument();
    expect(screen.getByText("Planillas confirmadas")).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /Revisar planilla/ })).not.toBeInTheDocument();
  });

  it("destaca la tercera comparsa tras completar dos y conserva la cuarta bloqueada", async () => {
    apiRequest.mockResolvedValue([{
      id: "ballot-1", nightName: "Noche 1", specialtyName: "Vestuario", status: "OPEN",
      totalScores: 56, resolvedScores: 28,
      troupes: [
        { troupeId: "sched-1", troupeName: "Ará Porá", presentationOrder: 1, total: 14, resolved: 14 },
        { troupeId: "sched-2", troupeName: "Imperio del Sur", presentationOrder: 2, total: 14, resolved: 14 },
        { troupeId: "sched-3", troupeName: "Yasí Berá", presentationOrder: 3, total: 14, resolved: 0 },
        { troupeId: "sched-4", troupeName: "Samba del Paraná", presentationOrder: 4, total: 14, resolved: 0 },
      ],
    }]);
    render(<JudgeHomePage session={{ user: { id: "judge-1" }, judgeProfile: { registrationStatus: "REGISTERED" } }} />);

    const now = within(await screen.findByRole("region", { name: "Comparsa actual" }));
    expect(now.getByRole("heading", { name: "Yasí Berá" })).toBeInTheDocument();
    expect(now.getByRole("link", { name: /Comenzar evaluación/ })).toHaveAttribute("href", "#/judge/ballot?ballotId=ballot-1&troupeId=sched-3");
    const evaluated = within(screen.getByRole("region", { name: "Comparsas evaluadas" }));
    expect(evaluated.getAllByRole("listitem")).toHaveLength(2);
    expect(evaluated.getByRole("heading", { name: "Ará Porá" })).toBeInTheDocument();
    expect(evaluated.getByRole("heading", { name: "Imperio del Sur" })).toBeInTheDocument();
    expect(evaluated.getAllByText("Evaluación completa")).toHaveLength(2);
    expect(evaluated.getAllByRole("link", { name: /Ver evaluación/ }).map((link) => link.getAttribute("href"))).toEqual([
      "#/judge/ballot?ballotId=ballot-1&troupeId=sched-1",
      "#/judge/ballot?ballotId=ballot-1&troupeId=sched-2",
    ]);
    const upcoming = within(screen.getByRole("region", { name: "Próximas comparsas" }));
    expect(upcoming.getAllByRole("listitem")).toHaveLength(1);
    expect(upcoming.getByRole("heading", { name: "Samba del Paraná" })).toBeInTheDocument();
    expect(upcoming.getByText("En espera")).toBeInTheDocument();
    expect(upcoming.queryByRole("link")).not.toBeInTheDocument();
    const progress = within(screen.getByRole("region", { name: "Progreso general" }));
    expect(progress.getByText("2 de 4 comparsas evaluadas")).toBeInTheDocument();
    expect(progress.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "28");
    expect(progress.getByRole("progressbar")).toHaveAttribute("aria-valuemax", "56");
    expect(screen.queryByText(/Planilla confirmada/)).not.toBeInTheDocument();
    expect(apiRequest).toHaveBeenCalledTimes(1);
  });

  it.each(["OPEN", "REOPENED"])("ofrece revisión por planilla %s completa sin anunciar confirmación", async (status) => {
    apiRequest.mockResolvedValue([{
      id: "ballot-1", nightName: "Noche 1", specialtyName: "Vestuario", status,
      totalScores: 2, resolvedScores: 2,
      troupes: [
        { troupeId: "sched-1", troupeName: "Ará Porá", presentationOrder: 1, total: 1, resolved: 1 },
        { troupeId: "sched-2", troupeName: "Imperio del Sur", presentationOrder: 2, total: 1, resolved: 1 },
      ],
    }]);
    render(<JudgeHomePage session={{ user: { id: "judge-1" }, judgeProfile: { registrationStatus: "REGISTERED" } }} />);
    const review = within(await screen.findByRole("region", { name: "Planillas listas para confirmar" }));
    expect(review.getByText("Evaluación completa · Planilla sin confirmar")).toBeInTheDocument();
    expect(review.getByRole("link", { name: /Revisar planilla/ })).toHaveAttribute("href", "#/judge/ballot?ballotId=ballot-1");
    expect(screen.getByText("2 de 2 comparsas evaluadas")).toBeInTheDocument();
    expect(screen.queryByRole("region", { name: "Comparsa actual" })).not.toBeInTheDocument();
    expect(screen.queryByRole("region", { name: "Próximas comparsas" })).not.toBeInTheDocument();
    expect(screen.queryByText("Planillas confirmadas")).not.toBeInTheDocument();
    expect(screen.queryByText("No tenés votaciones pendientes.")).not.toBeInTheDocument();
  });

  it.each([
    { label: "una confirmada y otra completa", states: ["SUBMITTED", "OPEN"], resolved: [2, 2], ready: [2], pending: false },
    { label: "una completa y otra con pendientes", states: ["OPEN", "OPEN"], resolved: [2, 1], ready: [1], pending: true },
    { label: "dos completas sin confirmar", states: ["OPEN", "REOPENED"], resolved: [2, 2], ready: [1, 2], pending: false },
  ])("mantiene revisión y confirmación independientes con $label", async ({ states, resolved, ready, pending }) => {
    apiRequest.mockResolvedValue(states.map((status, index) => ({
      id: `ballot-${index + 1}`, nightName: `Noche ${index + 1}`, specialtyName: "Vestuario", status,
      totalScores: 2, resolvedScores: resolved[index],
      troupes: [{ troupeId: `sched-${index + 1}`, troupeName: `Comparsa ${index + 1}`, presentationOrder: 1, total: 2, resolved: resolved[index] }],
    })));
    render(<JudgeHomePage session={{ user: { id: "judge-1" }, judgeProfile: { registrationStatus: "REGISTERED" } }} />);
    const review = within(await screen.findByRole("region", { name: "Planillas listas para confirmar" }));
    expect(review.getAllByRole("link", { name: /Revisar planilla/ }).map((link) => link.getAttribute("href"))).toEqual(
      ready.map((id) => `#/judge/ballot?ballotId=ballot-${id}`),
    );
    expect(screen.queryByText("Planillas confirmadas")).not.toBeInTheDocument();
    expect(screen.queryByText("No tenés votaciones pendientes.")).not.toBeInTheDocument();
    if (pending) {
      const now = within(screen.getByRole("region", { name: "Comparsa actual" }));
      expect(now.getByRole("heading", { name: "Comparsa 2" })).toBeInTheDocument();
      expect(now.getByText("Falta 1 puntuación")).toBeInTheDocument();
    } else {
      expect(screen.queryByRole("region", { name: "Comparsa actual" })).not.toBeInTheDocument();
    }
    if (states.includes("SUBMITTED")) {
      expect(screen.getByText("Planilla confirmada")).toBeInTheDocument();
      expect(screen.getByText("Evaluación completa")).toBeInTheDocument();
    }
  });

  it("deriva revisión del fallback con puntuaciones y no presentados confirmados", async () => {
    apiRequest.mockImplementation((path) => {
      if (path === "/api/v1/judge/ballots?include=progress") return Promise.resolve([
        { id: "ballot-1", nightName: "Noche 1", specialtyName: "Vestuario", status: "OPEN" },
      ]);
      if (path === "/api/v1/judge/ballots/ballot-1") return Promise.resolve({ scores: [
        { nightScheduleId: "sched-1", troupeName: "Ará Porá", presentationOrder: 1, evaluationState: "SCORED" },
        { nightScheduleId: "sched-1", troupeName: "Ará Porá", presentationOrder: 1, evaluationState: "NOT_PRESENTED" },
      ] });
      return Promise.reject(new Error(`Llamada inesperada: ${path}`));
    });
    render(<JudgeHomePage session={{ user: { id: "judge-1" }, judgeProfile: { registrationStatus: "REGISTERED" } }} />);
    const review = within(await screen.findByRole("region", { name: "Planillas listas para confirmar" }));
    expect(review.getByRole("link", { name: /Revisar planilla/ })).toHaveAttribute("href", "#/judge/ballot?ballotId=ballot-1");
    expect(screen.getByText("Evaluación completa")).toBeInTheDocument();
    expect(screen.getByText("1 de 1 comparsas evaluadas")).toBeInTheDocument();
    expect(screen.queryByText("Planillas confirmadas")).not.toBeInTheDocument();
    expect(screen.queryByRole("region", { name: "Comparsa actual" })).not.toBeInTheDocument();
    expect(apiRequest).toHaveBeenCalledTimes(2);
  });

  it("no anuncia finalización por redondear a 100% cuando queda un ítem pendiente", async () => {
    apiRequest.mockResolvedValue([{
      id: "ballot-1", nightName: "Noche 1", status: "OPEN", totalScores: 300, resolvedScores: 299,
      troupes: [{ troupeId: "sched-1", troupeName: "Ará Porá", presentationOrder: 1, total: 300, resolved: 299 }],
    }]);
    render(<JudgeHomePage session={{ user: { id: "judge-1" }, judgeProfile: { registrationStatus: "REGISTERED" } }} />);
    expect(await screen.findByText("Falta 1 puntuación")).toBeInTheDocument();
    expect(screen.getByText("0 de 1 comparsas evaluadas")).toBeInTheDocument();
    expect(screen.queryByRole("region", { name: "Planillas listas para confirmar" })).not.toBeInTheDocument();
    expect(screen.queryByText("Planillas confirmadas")).not.toBeInTheDocument();
    expect(screen.queryByText("No tenés votaciones pendientes.")).not.toBeInTheDocument();
  });

  it("no presenta como evaluada ni lista para confirmar una comparsa sin ítems", async () => {
    apiRequest.mockResolvedValue([{
      id: "ballot-1", nightName: "Noche 1", status: "OPEN", totalScores: 0, resolvedScores: 0,
      troupes: [{ troupeId: "sched-1", troupeName: "Ará Porá", presentationOrder: 1, total: 0, resolved: 0 }],
    }]);
    render(<JudgeHomePage session={{ user: { id: "judge-1" }, judgeProfile: { registrationStatus: "REGISTERED" } }} />);
    expect(await screen.findByText("0 de 1 comparsas evaluadas")).toBeInTheDocument();
    expect(screen.queryByRole("region", { name: "Comparsas evaluadas" })).not.toBeInTheDocument();
    expect(screen.queryByRole("region", { name: "Comparsa actual" })).not.toBeInTheDocument();
    expect(screen.queryByRole("region", { name: "Planillas listas para confirmar" })).not.toBeInTheDocument();
  });
});
