import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PublicResultsPage } from "../pages/PublicResultsPage.jsx";

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

const mockEventsList = {
  events: [
    {
      id: "ev-1",
      name: "Carnaval Goya 2027",
      latestVersion: 1,
      snapshotHash: "abc123hash",
      updatedAt: "2027-02-01T20:00:00.000Z",
    },
  ],
};

const mockReleasedResults = {
  version: 1,
  snapshotHash: "11223344556677889900aabbccddeeff11223344556677889900aabbccddeeff",
  event: {
    id: "ev-1",
    name: "Carnaval Goya 2027",
  },
  releasedAt: "2027-02-01T22:00:00.000Z",
  bestTroupe: {
    winnerTroupeId: "troupe-1",
    winnerTroupeName: "Comparsa Porambá",
    tieBreaker: null,
  },
  overallRanking: [
    {
      rank: 1,
      troupeId: "troupe-1",
      troupeName: "Comparsa Porambá",
      grossScore: 98,
      totalPenalties: 2,
      netScore: 96,
    },
    {
      rank: 2,
      troupeId: "troupe-2",
      troupeName: "Comparsa Itá Verá",
      grossScore: 92,
      totalPenalties: 0,
      netScore: 92,
    },
  ],
  rubricRankings: [
    {
      rubricId: "rub-1",
      rubricName: "Coreografía",
      rubricCode: "COREO",
      rubricKind: "NOMINATIVE",
      winnerTroupeIds: ["troupe-1"],
      winners: [{ troupeId: "troupe-1", troupeName: "Comparsa Porambá", totalScore: 30 }],
      troupes: [
        { troupeId: "troupe-1", troupeName: "Comparsa Porambá", totalScore: 30, rank: 1 },
        { troupeId: "troupe-2", troupeName: "Comparsa Itá Verá", totalScore: 28, rank: 2 },
      ],
    },
  ],
  officialRecord: {
    recordNumber: "ACTA-2027-GOYA-01",
    certifiedRole: "ESCRIBANO",
    recordHash: "99887766554433221100ffeeddccbbaa99887766554433221100ffeeddccbbaa",
    certifiedAt: "2027-02-01T22:30:00.000Z",
  },
};

describe("PublicResultsPage (Spec 024)", () => {
  beforeEach(() => {
    vi.stubGlobal("EventSource", MockEventSource);
    MockEventSource.latestInstance = null;
    Object.defineProperty(navigator, "clipboard", {
      value: {
        writeText: vi.fn().mockResolvedValue(undefined),
      },
      configurable: true,
      writable: true,
    });
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it("renderiza el portal bajo la capa de marca y muestra estado no liberado", async () => {
    vi.stubGlobal("fetch", vi.fn(async (url) => {
      if (url === "/api/v1/public/events") {
        return { ok: true, json: async () => mockEventsList };
      }
      if (url.includes("/results")) {
        return {
          ok: false,
          status: 404,
          json: async () => ({ code: "RESULTS_NOT_RELEASED", error: "No liberado" }),
        };
      }
      return { ok: false, status: 500 };
    }));

    render(<PublicResultsPage initialEventId="ev-1" />);

    expect(screen.getByRole("main")).toHaveAttribute("data-layer", "brand");

    await waitFor(() => {
      expect(screen.getByText("Resultados en Proceso de Escrutinio")).toBeInTheDocument();
    });
    expect(screen.getByText(/Las planillas y el cómputo final para este evento aún no han sido liberados/)).toBeInTheDocument();
  });

  it("renderiza resultados oficiales completos cuando están liberados", async () => {
    vi.stubGlobal("fetch", vi.fn(async (url) => {
      if (url === "/api/v1/public/events") {
        return { ok: true, json: async () => mockEventsList };
      }
      if (url.includes("/results")) {
        return {
          ok: true,
          status: 200,
          json: async () => mockReleasedResults,
        };
      }
      return { ok: false, status: 500 };
    }));

    render(<PublicResultsPage initialEventId="ev-1" />);

    await waitFor(() => {
      expect(screen.getAllByText("Comparsa Porambá").length).toBeGreaterThan(0);
    });

    // Tarjeta de honor para el campeón
    expect(screen.getByText("Comparsa Campeona Oficial")).toBeInTheDocument();
    expect(screen.getAllByText("96").length).toBeGreaterThan(0);

    // Tabla de Ranking General
    expect(screen.getByText("Ranking General de Comparsas")).toBeInTheDocument();
    expect(screen.getByText("Comparsa Itá Verá")).toBeInTheDocument();
    expect(screen.getByText("-2")).toBeInTheDocument(); // Penalizaciones

    // Ganadores por rubro
    expect(screen.getByText("Ganadores por Rubro")).toBeInTheDocument();
    expect(screen.getByText("Coreografía")).toBeInTheDocument();

    // Certificación Notarial
    expect(screen.getByText("Certificación Notarial de Escrutinio")).toBeInTheDocument();
    expect(screen.getByText("ACTA-2027-GOYA-01")).toBeInTheDocument();
    expect(screen.getByText("ESCRIBANO")).toBeInTheDocument();
    expect(screen.getByText(mockReleasedResults.officialRecord.recordHash)).toBeInTheDocument();
  });

  it("permite copiar el sello notarial al portapapeles con feedback accesible", async () => {
    vi.stubGlobal("fetch", vi.fn(async (url) => {
      if (url === "/api/v1/public/events") {
        return { ok: true, json: async () => mockEventsList };
      }
      if (url.includes("/results")) {
        return {
          ok: true,
          status: 200,
          json: async () => mockReleasedResults,
        };
      }
      return { ok: false, status: 500 };
    }));

    render(<PublicResultsPage initialEventId="ev-1" />);

    await waitFor(() => {
      expect(screen.getByText("Copiar Sello")).toBeInTheDocument();
    });

    const copyBtn = screen.getByRole("button", { name: /Copiar sello notarial al portapapeles/i });
    fireEvent.click(copyBtn);

    expect(navigator.clipboard.writeText).toHaveBeenCalledWith(
      expect.stringContaining(mockReleasedResults.officialRecord.recordHash),
    );

    await waitFor(() => {
      expect(screen.getByText("¡Sello notarial copiado al portapapeles!")).toBeInTheDocument();
    });
  });

  it("actualiza estado en vivo con EventSource y refresca ante 'results_updated'", async () => {
    const fetchMock = vi.fn(async (url) => {
      if (url === "/api/v1/public/events") {
        return { ok: true, json: async () => mockEventsList };
      }
      if (url.includes("/results")) {
        return {
          ok: true,
          status: 200,
          json: async () => mockReleasedResults,
        };
      }
      return { ok: false, status: 500 };
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<PublicResultsPage initialEventId="ev-1" />);

    await waitFor(() => {
      expect(MockEventSource.latestInstance).toBeTruthy();
    });

    // Simular evento "connected"
    MockEventSource.latestInstance.dispatch("connected", { status: "connected" });

    await waitFor(() => {
      expect(screen.getByText("En vivo")).toBeInTheDocument();
    });

    const initialFetchCalls = fetchMock.mock.calls.length;

    // Simular evento "results_updated" desde el backend (payload { eventId, version })
    MockEventSource.latestInstance.dispatch("results_updated", {
      eventId: "ev-1",
      version: 2,
    });

    await waitFor(() => {
      expect(fetchMock.mock.calls.length).toBeGreaterThan(initialFetchCalls);
    });
  });

  it("conmuta a 'Respaldo (30s)' si el canal SSE emite error", async () => {
    vi.stubGlobal("fetch", vi.fn(async (url) => {
      if (url === "/api/v1/public/events") {
        return { ok: true, json: async () => mockEventsList };
      }
      if (url.includes("/results")) {
        return {
          ok: true,
          status: 200,
          json: async () => mockReleasedResults,
        };
      }
      return { ok: false, status: 500 };
    }));

    render(<PublicResultsPage initialEventId="ev-1" />);

    await waitFor(() => {
      expect(MockEventSource.latestInstance).toBeTruthy();
    });

    MockEventSource.latestInstance.simulateError();

    await waitFor(() => {
      expect(screen.getByText("Respaldo (30s)")).toBeInTheDocument();
    });
  });
});
