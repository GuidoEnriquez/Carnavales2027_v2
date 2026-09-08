import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { apiRequest } from "../api/http.js";
import { VeedorMonitorPage } from "../pages/VeedorMonitorPage.jsx";

vi.mock("../api/http.js", () => ({ apiRequest: vi.fn() }));

const payload = [
  {
    id: "event-1",
    name: "Carnaval 2027",
    status: "OPEN",
    nights: [
      {
        id: "night-1",
        name: "Noche 1",
        status: "OPEN",
        votingStatus: "OPEN",
        counts: { OPEN: 2, SUBMITTED: 3, REOPENED: 1, REPLACED: 1 },
        total: 6,
      },
    ],
  },
];

class MockEventSource {
  constructor(url) {
    this.url = url;
    this.listeners = {};
    MockEventSource.latestInstance = this;
  }

  addEventListener(event, callback) {
    if (!this.listeners[event]) this.listeners[event] = [];
    this.listeners[event].push(callback);
  }

  removeEventListener(event, callback) {
    if (!this.listeners[event]) return;
    this.listeners[event] = this.listeners[event].filter((cb) => cb !== callback);
  }

  dispatch(event, data) {
    const list = this.listeners[event] || [];
    for (const cb of list) {
      cb({ data: typeof data === "string" ? data : JSON.stringify(data) });
    }
  }

  simulateError() {
    if (this.onerror) this.onerror(new Event("error"));
  }

  close() {
    this.closed = true;
  }
}

describe("VeedorMonitorPage SSE & Wallboard (Spec 022)", () => {
  beforeEach(() => {
    window.EventSource = MockEventSource;
    MockEventSource.latestInstance = null;
    apiRequest.mockResolvedValue(payload);
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
    delete window.EventSource;
  });

  it("conecta vía SSE y muestra estado '● En vivo' al recibir evento connected (RF-191, RF-193)", async () => {
    render(<VeedorMonitorPage />);

    expect(await screen.findByRole("heading", { name: "Noche 1" })).toBeInTheDocument();
    expect(MockEventSource.latestInstance).toBeTruthy();

    // Disparar evento connected desde SSE
    MockEventSource.latestInstance.dispatch("connected", { status: "connected" });

    await waitFor(() => {
      expect(screen.getByText("● En vivo")).toBeInTheDocument();
    });
  });

  it("actualiza inmediatamente datos al recibir evento 'monitor_update' vía SSE (RF-192)", async () => {
    render(<VeedorMonitorPage />);
    expect(await screen.findByRole("heading", { name: "Noche 1" })).toBeInTheDocument();
    expect(apiRequest).toHaveBeenCalledTimes(1);

    // Disparar evento monitor_update
    MockEventSource.latestInstance.dispatch("monitor_update", {
      type: "BALLOT_SUBMITTED",
      eventId: "event-1",
    });

    await waitFor(() => {
      expect(apiRequest).toHaveBeenCalledTimes(2);
    });
  });

  it("cae a '○ Polling de respaldo' ante desconexión o fallo de SSE (RF-193)", async () => {
    render(<VeedorMonitorPage />);
    expect(await screen.findByRole("heading", { name: "Noche 1" })).toBeInTheDocument();

    // Simular error en EventSource
    MockEventSource.latestInstance.simulateError();

    await waitFor(() => {
      expect(screen.getByText("○ Polling de respaldo")).toBeInTheDocument();
    });
  });

  it("detecta anomalía de intento de cierre incompleto y permite descartar la alerta (RF-194)", async () => {
    render(<VeedorMonitorPage />);
    expect(await screen.findByRole("heading", { name: "Noche 1" })).toBeInTheDocument();

    // Emitir anomalía CLOSE_ATTEMPT_INCOMPLETE
    MockEventSource.latestInstance.dispatch("monitor_update", {
      type: "CLOSE_ATTEMPT_INCOMPLETE",
      eventId: "event-1",
      pendingCount: 2,
    });

    expect(
      await screen.findByText(/Intento de cierre de votación bloqueado: aún hay 2 planilla\(s\) pendientes/),
    ).toBeInTheDocument();

    // Descartar alerta
    const discardBtn = screen.getByRole("button", { name: "Descartar alerta" });
    fireEvent.click(discardBtn);

    await waitFor(() => {
      expect(
        screen.queryByText(/Intento de cierre de votación bloqueado/),
      ).not.toBeInTheDocument();
    });
  });

  it("alterna modo 'Pared de Sala' / Wallboard con atributos accesibles (RF-195)", async () => {
    const { container } = render(<VeedorMonitorPage />);
    expect(await screen.findByRole("heading", { name: "Noche 1" })).toBeInTheDocument();

    const toggleBtn = screen.getByRole("button", { name: "Modo Pared de Sala" });
    expect(toggleBtn).toHaveAttribute("aria-pressed", "false");
    expect(container.querySelector(".monitor-page.is-wallboard")).toBeNull();

    // Activar modo pared
    fireEvent.click(toggleBtn);
    expect(toggleBtn).toHaveAttribute("aria-pressed", "true");
    expect(toggleBtn).toHaveTextContent("Salir de Pared de Sala");
    expect(container.querySelector(".monitor-page.is-wallboard")).not.toBeNull();

    // Desactivar modo pared
    fireEvent.click(toggleBtn);
    expect(toggleBtn).toHaveAttribute("aria-pressed", "false");
    expect(toggleBtn).toHaveTextContent("Modo Pared de Sala");
    expect(container.querySelector(".monitor-page.is-wallboard")).toBeNull();
  });
});
