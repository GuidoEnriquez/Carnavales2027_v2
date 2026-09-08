import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { apiRequest } from "../api/http.js";
import { AdminVotingPage } from "../pages/AdminVotingPage.jsx";

vi.mock("../api/http.js", () => ({ apiRequest: vi.fn() }));

describe("AdminVotingPage", () => {
  afterEach(() => { cleanup(); vi.clearAllMocks(); });

  it("renderiza bajo la capa de instrumento data-layer='instrument' (RF-177)", async () => {
    apiRequest.mockImplementation(() => Promise.resolve([]));
    const { container } = render(<AdminVotingPage />);
    expect(container.querySelector("main.admin-shell")).toHaveAttribute("data-layer", "instrument");
  });

  it("abre y cierra sin exponer puntuaciones ni controles de reapertura", async () => {
    apiRequest.mockImplementation((path, options) => {
      if (path === "/api/v1/events") return Promise.resolve([{ id: "event-1", name: "Carnaval", status: "OPEN" }]);
      if (path === "/api/v1/events/event-1/nights") return Promise.resolve([{ id: "night-1", name: "Noche 1", kind: "COMPETITION", status: "OPEN" }]);
      if (path === "/api/v1/events/event-1/nights/night-1/voting/status") return Promise.resolve({ nightId: "night-1", nightStatus: "OPEN", counts: { OPEN: 1, SUBMITTED: 1, REOPENED: 0 }, total: 2 });
      if (path === "/api/v1/events/event-1/nights/night-1/voting/ballots") return Promise.resolve([{ id: "ballot-1", judgeName: "Jurado Uno", specialtyName: "Baile", status: "SUBMITTED", reopenCount: 0 }]);
      if (path.endsWith("/voting/open")) return Promise.resolve({ ballotsCreated: 2 });
      if (path.endsWith("/voting/close")) return Promise.resolve({ autoSubmitted: 1 });
      return Promise.resolve({});
    });
    render(<AdminVotingPage />);

    expect(await screen.findByText("Jurado Uno")).toBeInTheDocument();
    expect(screen.getByText("Confirmadas")).toBeInTheDocument();
    expect(screen.queryByText(/puntaje|ranking|total artístico/i)).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Abrir votación" }));
    await waitFor(() => expect(apiRequest).toHaveBeenCalledWith(
      "/api/v1/events/event-1/nights/night-1/voting/open",
      { method: "POST" },
    ));

    fireEvent.click(screen.getByRole("button", { name: "Cerrar votación" }));
    await waitFor(() => expect(apiRequest).toHaveBeenCalledWith(
      "/api/v1/events/event-1/nights/night-1/voting/close",
      { method: "POST" },
    ));

    expect(screen.queryByRole("button", { name: /reabrir/i })).not.toBeInTheDocument();
  });

  it("identifica los ítems pendientes cuando el cierre es rechazado", async () => {
    apiRequest.mockImplementation((path) => {
      if (path === "/api/v1/events") return Promise.resolve([{ id: "event-1", name: "Carnaval", status: "OPEN" }]);
      if (path === "/api/v1/events/event-1/nights") return Promise.resolve([{ id: "night-1", name: "Noche 1", kind: "COMPETITION", status: "OPEN" }]);
      if (path.endsWith("/voting/status")) return Promise.resolve({ nightId: "night-1", nightStatus: "OPEN", counts: { OPEN: 1, SUBMITTED: 0, REOPENED: 0 }, total: 1 });
      if (path.endsWith("/voting/ballots")) return Promise.resolve([]);
      if (path.endsWith("/voting/close")) return Promise.reject({ code: "VOTING_CLOSE_INCOMPLETE_BALLOTS", details: [{ id: "score-1", name: "Presencia", code: "PRESENCIA", rubricName: "Desfile", judgeName: "Jurado Uno", troupeName: "Comparsa Azul" }] });
      return Promise.resolve({});
    });
    render(<AdminVotingPage />);

    const closeButton = await screen.findByRole("button", { name: "Cerrar votación" });
    fireEvent.click(closeButton);
    const dialog = await screen.findByRole("dialog", { name: "Faltan votos por resolver" });
    expect(dialog).toHaveAttribute("aria-modal", "true");
    expect(dialog).toHaveTextContent("Jurado Uno · Comparsa Azul");
    expect(dialog).toHaveTextContent("Desfile");
    expect(dialog).toHaveTextContent("Presencia");
    expect(screen.queryByRole("status")).not.toHaveTextContent("faltan decisiones");

    fireEvent.click(screen.getByRole("button", { name: "Volver al control" }));
    await waitFor(() => expect(closeButton).toHaveFocus());

    fireEvent.click(closeButton);
    const reopenedDialog = await screen.findByRole("dialog", { name: "Faltan votos por resolver" });
    fireEvent(reopenedDialog, new Event("cancel", { bubbles: true, cancelable: true }));
    await waitFor(() => expect(closeButton).toHaveFocus());
  });

  it("visualiza la comparsa activa en pista y el cronograma secuencial de pasadas (RF-194)", async () => {
    apiRequest.mockImplementation((path) => {
      if (path === "/api/v1/events") return Promise.resolve([{ id: "event-1", name: "Carnaval", status: "OPEN" }]);
      if (path === "/api/v1/events/event-1/nights") return Promise.resolve([{ id: "night-1", name: "Noche 1", kind: "COMPETITION", status: "OPEN" }]);
      if (path.endsWith("/voting/status")) return Promise.resolve({
        nightId: "night-1",
        nightStatus: "OPEN",
        counts: { OPEN: 2, SUBMITTED: 1, REOPENED: 0 },
        total: 3,
        troupes: [
          { scheduleId: "sch-1", presentationOrder: 1, troupeName: "Comparsa Fénix", brandColor: "#e11d48", totalScores: 10, resolvedScores: 10, status: "COMPLETED" },
          { scheduleId: "sch-2", presentationOrder: 2, troupeName: "Comparsa Samba Show", brandColor: "#2563eb", totalScores: 10, resolvedScores: 4, status: "IN_RUNWAY" },
          { scheduleId: "sch-3", presentationOrder: 3, troupeName: "Comparsa Bella Samba", brandColor: "#16a34a", totalScores: 10, resolvedScores: 0, status: "WAITING" },
        ],
        activeTroupe: {
          scheduleId: "sch-2",
          presentationOrder: 2,
          troupeName: "Comparsa Samba Show",
          brandColor: "#2563eb",
          totalScores: 10,
          resolvedScores: 4,
          status: "IN_RUNWAY",
        },
      });
      if (path.endsWith("/voting/ballots")) return Promise.resolve([]);
      return Promise.resolve({});
    });

    render(<AdminVotingPage />);

    expect(await screen.findByRole("heading", { name: "Control de pista y orden de pasada" })).toBeInTheDocument();
    expect(screen.getByText("Salida #2")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Comparsa Samba Show" })).toBeInTheDocument();
    expect(screen.getAllByText("EN PISTA").length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText("4 / 10")).toBeInTheDocument();

    // Cronograma secuencial
    expect(screen.getByText("COMPLETADA")).toBeInTheDocument();
    expect(screen.getByText("EN ESPERA")).toBeInTheDocument();
    expect(screen.getByText("Comparsa Fénix")).toBeInTheDocument();
    expect(screen.getByText("Comparsa Bella Samba")).toBeInTheDocument();

    // Botón de actualización de pista
    const refreshBtn = screen.getByRole("button", { name: "Actualizar estado de pista" });
    fireEvent.click(refreshBtn);
    await waitFor(() => {
      expect(apiRequest).toHaveBeenCalledWith("/api/v1/events/event-1/nights/night-1/voting/status");
    });
  });
});
