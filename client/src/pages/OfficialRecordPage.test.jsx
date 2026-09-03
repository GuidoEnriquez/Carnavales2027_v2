import { cleanup, fireEvent, render, waitFor, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { OfficialRecordPage } from "./OfficialRecordPage.jsx";

const apiRequestMock = vi.hoisted(() => vi.fn());
vi.mock("../api/http.js", () => ({ apiRequest: apiRequestMock }));

const useSessionMock = vi.hoisted(() => vi.fn(() => ({ roles: ["ESCRIBANO"] })));
vi.mock("../auth/session-context.jsx", () => ({ useSession: useSessionMock }));

const mockEvent = { id: "event-1", name: "Carnaval Oficial 2027" };

const mockRecordData = {
  id: "record-1",
  event_id: "event-1",
  record_number: "ACTA-2027-EVT1-01",
  certified_by: "user-escribano-1",
  certified_role: "ESCRIBANO",
  record_hash: "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
  created_at: "2027-02-15T03:30:00.000Z",
  integrityVerified: true,
  payload: {
    recordNumber: "ACTA-2027-EVT1-01",
    event: { id: "event-1", name: "Carnaval Oficial 2027" },
    certifiedAt: "2027-02-15T03:30:00.000Z",
    certifiedBy: { userId: "user-escribano-1", name: "Dr. Juan Pérez", role: "ESCRIBANO" },
    judges: [
      { judgeProfileId: "jp-1", judgeName: "Dra. Laura Gómez", specialtyName: "Coreografía" },
    ],
    troupes: [
      { troupeId: "troupe-1", troupeName: "Sapucay", categoryName: "Comparsa Mayor" },
      { troupeId: "troupe-2", troupeName: "Ara Berá", categoryName: "Comparsa Mayor" },
    ],
    rubricRankings: [
      {
        rubricId: "rub-1",
        rubricName: "Batería",
        rubricCode: "BATERIA",
        winners: [{ troupeId: "troupe-1", troupeName: "Sapucay", totalScore: 10 }],
      },
    ],
    overallRanking: [
      { rank: 1, troupeId: "troupe-1", troupeName: "Sapucay", grossScore: 100, totalPenalties: 0, netScore: 100 },
      { rank: 2, troupeId: "troupe-2", troupeName: "Ara Berá", grossScore: 99, totalPenalties: 2, netScore: 97 },
    ],
    bestTroupe: {
      winnerTroupeId: "troupe-1",
      winnerTroupeName: "Sapucay",
      tieBreaker: null,
    },
  },
};

describe("OfficialRecordPage", () => {
  afterEach(() => {
    cleanup();
    apiRequestMock.mockReset();
    useSessionMock.mockReturnValue({ roles: ["ESCRIBANO"] });
  });

  it("muestra estado pendiente y aviso normativo para ADMIN sin botón de emisión", async () => {
    useSessionMock.mockReturnValue({ roles: ["ADMIN"] });
    apiRequestMock.mockImplementation((path) => {
      if (path === "/api/v1/results/events") return Promise.resolve([mockEvent]);
      if (path === "/api/v1/events/event-1/scrutiny-record") {
        return Promise.reject({ code: "OFFICIAL_RECORD_NOT_FOUND" });
      }
      return Promise.reject(new Error(`Inesperado: ${path}`));
    });

    render(<OfficialRecordPage />);

    await waitFor(() => {
      expect(screen.getByText("Acta Oficial no emitida")).toBeInTheDocument();
    });

    expect(screen.getByText(/Por normativa de segregación de funciones/i)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Certificar y emitir/i })).not.toBeInTheDocument();
  });

  it("permite al ESCRIBANO ver el botón de certificación y emitir el acta", async () => {
    apiRequestMock.mockImplementation((path, options) => {
      if (path === "/api/v1/results/events") return Promise.resolve([mockEvent]);
      if (path === "/api/v1/events/event-1/scrutiny-record" && !options?.method) {
        return Promise.reject({ code: "OFFICIAL_RECORD_NOT_FOUND" });
      }
      if (path === "/api/v1/events/event-1/scrutiny-record" && options?.method === "POST") {
        return Promise.resolve({ record: mockRecordData, alreadyCertified: false, integrityVerified: true });
      }
      return Promise.reject(new Error(`Inesperado: ${path}`));
    });

    render(<OfficialRecordPage />);

    await waitFor(() => {
      expect(screen.getByText("Acta Oficial no emitida")).toBeInTheDocument();
    });

    const certifyBtn = screen.getByRole("button", { name: "Certificar y emitir Acta Oficial" });
    expect(certifyBtn).toBeInTheDocument();

    fireEvent.click(certifyBtn);

    await waitFor(() => {
      expect(screen.getByText(/Acta Oficial emitida y sellada/i)).toBeInTheDocument();
    });

    expect(screen.getByText("ACTA-2027-EVT1-01")).toBeInTheDocument();
    expect(screen.getByText("✓ INTEGRIDAD DIGITAL VERIFICADA")).toBeInTheDocument();
  });

  it("renderiza el documento notarial completo cuando el acta ya está emitida", async () => {
    apiRequestMock.mockImplementation((path) => {
      if (path === "/api/v1/results/events") return Promise.resolve([mockEvent]);
      if (path === "/api/v1/events/event-1/scrutiny-record") {
        return Promise.resolve(mockRecordData);
      }
      return Promise.reject(new Error(`Inesperado: ${path}`));
    });

    render(<OfficialRecordPage />);

    await waitFor(() => {
      expect(screen.getByText("ACTA NOTARIAL DE ESCRUTINIO DEFINITIVO")).toBeInTheDocument();
    });

    // Hash y sello de integridad
    expect(screen.getByText("e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855")).toBeInTheDocument();
    expect(screen.getByText("✓ INTEGRIDAD DIGITAL VERIFICADA")).toBeInTheDocument();

    // Tabla de Mejor Comparsa con triple columna
    expect(screen.getAllByText("Sapucay").length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText("CAMPEONA")).toBeInTheDocument();
    expect(screen.getAllByText("100 pts").length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText("−2 pts")).toBeInTheDocument();
    expect(screen.getByText("97 pts")).toBeInTheDocument();

    // Firmas hológrafas
    expect(screen.getByText("Dr. Juan Pérez")).toBeInTheDocument();
    expect(screen.getByText("Escribano Público Titular")).toBeInTheDocument();

    // Botón de impresión
    const printBtn = screen.getByRole("button", { name: /Imprimir \/ Exportar PDF/i });
    expect(printBtn).toBeInTheDocument();

    const originalPrint = window.print;
    window.print = vi.fn();
    fireEvent.click(printBtn);
    expect(window.print).toHaveBeenCalled();
    window.print = originalPrint;
  });
});
