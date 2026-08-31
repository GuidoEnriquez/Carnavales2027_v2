import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { apiRequest } from "../api/http.js";
import { AdminVotingPage } from "../pages/AdminVotingPage.jsx";

vi.mock("../api/http.js", () => ({ apiRequest: vi.fn() }));

describe("AdminVotingPage", () => {
  afterEach(() => { cleanup(); vi.clearAllMocks(); });

  it("abre, cierra y reabre sin exponer puntuaciones", async () => {
    apiRequest.mockImplementation((path, options) => {
      if (path === "/api/v1/events") return Promise.resolve([{ id: "event-1", name: "Carnaval", status: "OPEN" }]);
      if (path === "/api/v1/events/event-1/nights") return Promise.resolve([{ id: "night-1", name: "Noche 1", kind: "COMPETITION", status: "OPEN" }]);
      if (path === "/api/v1/events/event-1/nights/night-1/voting/status") return Promise.resolve({ nightId: "night-1", nightStatus: "OPEN", counts: { OPEN: 1, SUBMITTED: 1, REOPENED: 0 }, total: 2 });
      if (path === "/api/v1/events/event-1/nights/night-1/voting/ballots") return Promise.resolve([{ id: "ballot-1", judgeName: "Jurado Uno", specialtyName: "Baile", status: "SUBMITTED", reopenCount: 0 }]);
      if (path.endsWith("/voting/open")) return Promise.resolve({ ballotsCreated: 2 });
      if (path.endsWith("/voting/close")) return Promise.resolve({ autoSubmitted: 1 });
      if (path.endsWith("/ballots/ballot-1/reopen")) return Promise.resolve({ status: "REOPENED" });
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

    fireEvent.change(screen.getByLabelText("Motivo de reapertura"), { target: { value: "Corrección" } });
    fireEvent.submit(screen.getByRole("button", { name: "Reabrir una vez" }).closest("form"));
    await waitFor(() => expect(apiRequest).toHaveBeenCalledWith(
      "/api/v1/events/event-1/ballots/ballot-1/reopen",
      { method: "POST", body: JSON.stringify({ reason: "Corrección" }) },
    ));
  });

  it("identifica los ítems pendientes cuando el cierre es rechazado", async () => {
    apiRequest.mockImplementation((path) => {
      if (path === "/api/v1/events") return Promise.resolve([{ id: "event-1", name: "Carnaval", status: "OPEN" }]);
      if (path === "/api/v1/events/event-1/nights") return Promise.resolve([{ id: "night-1", name: "Noche 1", kind: "COMPETITION", status: "OPEN" }]);
      if (path.endsWith("/voting/status")) return Promise.resolve({ nightId: "night-1", nightStatus: "OPEN", counts: { OPEN: 1, SUBMITTED: 0, REOPENED: 0 }, total: 1 });
      if (path.endsWith("/voting/ballots")) return Promise.resolve([]);
      if (path.endsWith("/voting/close")) return Promise.reject({ code: "VOTING_CLOSE_INCOMPLETE_BALLOTS", details: [{ name: "Presencia", code: "PRESENCIA", judgeName: "Jurado Uno", troupeName: "Comparsa Azul" }] });
      return Promise.resolve({});
    });
    render(<AdminVotingPage />);

    fireEvent.click(await screen.findByRole("button", { name: "Cerrar votación" }));
    expect(await screen.findByRole("status")).toHaveTextContent("faltan decisiones en Jurado Uno: Comparsa Azul - Presencia");
  });
});
