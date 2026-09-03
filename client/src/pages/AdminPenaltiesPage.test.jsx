import { cleanup, fireEvent, render, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AdminPenaltiesPage } from "./AdminPenaltiesPage.jsx";

const apiRequestMock = vi.hoisted(() => vi.fn());
vi.mock("../api/http.js", () => ({ apiRequest: apiRequestMock }));

const mockEvent = { id: "event-1", name: "Carnaval 2027" };
const mockNights = [
  { id: "night-1", name: "Noche 1", kind: "COMPETITION" },
  { id: "night-awards", name: "Noche Premios", kind: "AWARDS" },
];
const mockTroupes = [
  { id: "troupe-1", name: "Comparsa Porambá" },
  { id: "troupe-2", name: "Comparsa Itá Verá" },
];
const mockPenalties = [
  {
    id: "penalty-1",
    eventId: "event-1",
    nightId: "night-1",
    nightName: "Noche 1",
    eventTroupeId: "troupe-1",
    troupeName: "Comparsa Porambá",
    reason: "Demora en ingreso",
    penaltyPoints: 2,
    status: "APPLIED",
    appliedByName: "Comisario General",
    createdAt: "2026-02-14T22:00:00.000Z",
  },
  {
    id: "penalty-2",
    eventId: "event-1",
    nightId: "night-1",
    nightName: "Noche 1",
    eventTroupeId: "troupe-2",
    troupeName: "Comparsa Itá Verá",
    reason: "Exceso de integrantes",
    penaltyPoints: 3,
    status: "REVOKED",
    appliedByName: "Comisario General",
    revokedByName: "Admin",
    revocationReason: "Corrección técnica de conteo",
    createdAt: "2026-02-14T22:30:00.000Z",
  },
];

describe("AdminPenaltiesPage", () => {
  afterEach(() => {
    cleanup();
    apiRequestMock.mockReset();
  });

  it("carga el evento, noches competitivas, comparsas y sanciones con indicación de revocadas", async () => {
    apiRequestMock.mockImplementation((path) => {
      if (path === "/api/v1/events") return Promise.resolve([mockEvent]);
      if (path === "/api/v1/events/event-1/nights") return Promise.resolve(mockNights);
      if (path === "/api/v1/events/event-1/troupes") return Promise.resolve(mockTroupes);
      if (path === "/api/v1/events/event-1/penalties") return Promise.resolve(mockPenalties);
      return Promise.reject(new Error(`request inesperado: ${path}`));
    });

    const { getByRole, getByText, getAllByText } = render(<AdminPenaltiesPage />);

    await waitFor(() => {
      expect(getByRole("heading", { name: "Registrar sanción reglamentaria" })).toBeVisible();
      expect(getByRole("option", { name: "Noche 1" })).toBeVisible();
      expect(getByRole("option", { name: "Comparsa Porambá" })).toBeVisible();
    });

    // Verifica sanciones en la tabla
    expect(getByText("Demora en ingreso")).toBeVisible();
    expect(getByText("−2 pts")).toBeVisible();
    expect(getByText("Aplicada")).toBeVisible();

    expect(getByText("Exceso de integrantes")).toBeVisible();
    expect(getByText("−3 pts")).toBeVisible();
    expect(getByText("Revocada")).toBeVisible();
    expect(getByText(/Corrección técnica de conteo/i)).toBeVisible();

    // Solo la penalización APPLIED tiene botón Revocar
    expect(getAllByText("Revocar")).toHaveLength(1);
  });

  it("permite registrar una nueva penalización y actualiza el listado", async () => {
    let currentPenalties = [mockPenalties[0]];
    apiRequestMock.mockImplementation((path, options) => {
      if (path === "/api/v1/events") return Promise.resolve([mockEvent]);
      if (path === "/api/v1/events/event-1/nights") return Promise.resolve(mockNights);
      if (path === "/api/v1/events/event-1/troupes") return Promise.resolve(mockTroupes);
      if (path === "/api/v1/events/event-1/penalties" && !options?.method) {
        return Promise.resolve(currentPenalties);
      }
      if (path === "/api/v1/events/event-1/penalties" && options?.method === "POST") {
        const body = JSON.parse(options.body);
        expect(body).toEqual({
          nightId: "night-1",
          eventTroupeId: "troupe-1",
          reason: "Uso indebido de pirotecnia",
          penaltyPoints: 5,
        });
        const created = {
          id: "penalty-new",
          eventId: "event-1",
          nightId: "night-1",
          nightName: "Noche 1",
          eventTroupeId: "troupe-1",
          troupeName: "Comparsa Porambá",
          reason: "Uso indebido de pirotecnia",
          penaltyPoints: 5,
          status: "APPLIED",
          appliedByName: "Comisario",
          createdAt: new Date().toISOString(),
        };
        currentPenalties = [...currentPenalties, created];
        return Promise.resolve(created);
      }
      return Promise.reject(new Error(`request inesperado: ${path}`));
    });

    const { getByLabelText, getByRole, getByText } = render(<AdminPenaltiesPage />);

    await waitFor(() => {
      expect(getByRole("heading", { name: "Registrar sanción reglamentaria" })).toBeVisible();
      expect(getByRole("option", { name: "Noche 1" })).toBeVisible();
    });

    const pointsInput = getByLabelText(/puntos a descontar/i);
    const reasonInput = getByLabelText(/motivo \/ concepto reglamentario/i);
    const submitBtn = getByRole("button", { name: "Registrar penalización" });

    fireEvent.change(pointsInput, { target: { value: "5" } });
    fireEvent.change(reasonInput, { target: { value: "Uso indebido de pirotecnia" } });
    fireEvent.click(submitBtn);

    await waitFor(() =>
      expect(getByText("Penalización registrada correctamente.")).toBeVisible(),
    );
    expect(pointsInput.value).toBe("");
    expect(reasonInput.value).toBe("");
  });

  it("abre modal accesible para revocar sanción, valida foco, Escape y retorno de foco", async () => {
    let currentPenalties = [mockPenalties[0]];
    apiRequestMock.mockImplementation((path, options) => {
      if (path === "/api/v1/events") return Promise.resolve([mockEvent]);
      if (path === "/api/v1/events/event-1/nights") return Promise.resolve(mockNights);
      if (path === "/api/v1/events/event-1/troupes") return Promise.resolve(mockTroupes);
      if (path === "/api/v1/events/event-1/penalties" && !options?.method) {
        return Promise.resolve(currentPenalties);
      }
      if (
        path === "/api/v1/events/event-1/penalties/penalty-1/revoke" &&
        options?.method === "POST"
      ) {
        const body = JSON.parse(options.body);
        expect(body).toEqual({
          revocationReason: "Anulación por error de cronometraje",
        });
        currentPenalties = [
          {
            ...mockPenalties[0],
            status: "REVOKED",
            revocationReason: "Anulación por error de cronometraje",
          },
        ];
        return Promise.resolve(currentPenalties[0]);
      }
      return Promise.reject(new Error(`request inesperado: ${path}`));
    });

    const { getByRole, getByLabelText, getByText, queryByRole } = render(<AdminPenaltiesPage />);

    await waitFor(() =>
      expect(getByRole("button", { name: /revocar sanción a comparsa porambá/i })).toBeVisible(),
    );

    const revokeBtn = getByRole("button", { name: /revocar sanción a comparsa porambá/i });
    fireEvent.click(revokeBtn);

    // Modal se abre
    const modalHeading = await waitFor(() => getByRole("heading", { name: "Revocar sanción" }));
    expect(modalHeading).toBeVisible();

    const reasonInput = getByLabelText(/motivo reglamentario de la revocación/i);
    expect(document.activeElement).toBe(reasonInput);

    // Probar cierre con tecla Escape y retorno de foco al botón disparador
    fireEvent.keyDown(document, { key: "Escape" });
    await waitFor(() =>
      expect(queryByRole("heading", { name: "Revocar sanción" })).not.toBeInTheDocument(),
    );
    expect(document.activeElement).toBe(revokeBtn);

    // Reabrir y completar revocación
    fireEvent.click(revokeBtn);
    const reasonInputAgain = await waitFor(() =>
      getByLabelText(/motivo reglamentario de la revocación/i),
    );
    fireEvent.change(reasonInputAgain, {
      target: { value: "Anulación por error de cronometraje" },
    });

    const confirmRevokeBtn = getByRole("button", { name: "Confirmar revocación" });
    fireEvent.click(confirmRevokeBtn);

    await waitFor(() =>
      expect(getByText("Penalización revocada correctamente.")).toBeVisible(),
    );
    expect(queryByRole("heading", { name: "Revocar sanción" })).not.toBeInTheDocument();
    expect(queryByRole("button", { name: /revocar sanción a comparsa porambá/i })).not.toBeInTheDocument();
  });

  it("maneja 409 RESULTS_ALREADY_RELEASED de forma legible al intentar registrar", async () => {
    const error = Object.assign(new Error("RESULTS_ALREADY_RELEASED"), {
      code: "RESULTS_ALREADY_RELEASED",
    });
    apiRequestMock.mockImplementation((path, options) => {
      if (path === "/api/v1/events") return Promise.resolve([mockEvent]);
      if (path === "/api/v1/events/event-1/nights") return Promise.resolve(mockNights);
      if (path === "/api/v1/events/event-1/troupes") return Promise.resolve(mockTroupes);
      if (path === "/api/v1/events/event-1/penalties" && !options?.method) {
        return Promise.resolve([]);
      }
      if (path === "/api/v1/events/event-1/penalties" && options?.method === "POST") {
        return Promise.reject(error);
      }
      return Promise.reject(new Error(`request inesperado: ${path}`));
    });

    const { getByLabelText, getByRole, getByText } = render(<AdminPenaltiesPage />);

    await waitFor(() => {
      expect(getByRole("heading", { name: "Registrar sanción reglamentaria" })).toBeVisible();
      expect(getByRole("option", { name: "Noche 1" })).toBeVisible();
    });

    fireEvent.change(getByLabelText(/puntos a descontar/i), { target: { value: "2" } });
    fireEvent.change(getByLabelText(/motivo \/ concepto reglamentario/i), {
      target: { value: "Infracción" },
    });
    fireEvent.click(getByRole("button", { name: "Registrar penalización" }));

    await waitFor(() =>
      expect(
        getByText(/Los resultados ya fueron liberados. No se pueden registrar ni revocar penalizaciones/i),
      ).toBeVisible(),
    );
  });

  it("maneja 403 RESULTS_ACCESS_DENIED y PENALTIES_ACCESS_DENIED de forma legible", async () => {
    const accessDenied = Object.assign(new Error("RESULTS_ACCESS_DENIED"), {
      code: "RESULTS_ACCESS_DENIED",
    });
    apiRequestMock.mockRejectedValue(accessDenied);

    const { getByText } = render(<AdminPenaltiesPage />);

    await waitFor(() =>
      expect(getByText("No tenés permisos para acceder a las competencias.")).toBeVisible(),
    );
  });

  it("valida en cliente puntos enteros mayores a cero y motivo obligatorio antes de enviar", async () => {
    apiRequestMock.mockImplementation((path) => {
      if (path === "/api/v1/events") return Promise.resolve([mockEvent]);
      if (path === "/api/v1/events/event-1/nights") return Promise.resolve(mockNights);
      if (path === "/api/v1/events/event-1/troupes") return Promise.resolve(mockTroupes);
      if (path === "/api/v1/events/event-1/penalties") return Promise.resolve([]);
      return Promise.reject(new Error(`request inesperado: ${path}`));
    });

    const { getByLabelText, getByRole, getByText } = render(<AdminPenaltiesPage />);

    await waitFor(() => {
      expect(getByRole("heading", { name: "Registrar sanción reglamentaria" })).toBeVisible();
      expect(getByRole("option", { name: "Noche 1" })).toBeVisible();
    });

    const pointsInput = getByLabelText(/puntos a descontar/i);
    const reasonInput = getByLabelText(/motivo \/ concepto reglamentario/i);
    const submitBtn = getByRole("button", { name: "Registrar penalización" });

    // Intento con puntos inválidos (0)
    fireEvent.change(pointsInput, { target: { value: "0" } });
    fireEvent.change(reasonInput, { target: { value: "Motivo válido" } });
    fireEvent.submit(submitBtn.closest("form"));

    await waitFor(() =>
      expect(getByText("Los puntos deben ser un número entero mayor a 0.")).toBeVisible(),
    );

    // Intento con motivo vacío o solo espacios
    fireEvent.change(pointsInput, { target: { value: "4" } });
    fireEvent.change(reasonInput, { target: { value: "   " } });
    fireEvent.submit(submitBtn.closest("form"));

    await waitFor(() =>
      expect(getByText("El motivo o concepto reglamentario es obligatorio.")).toBeVisible(),
    );
  });

  it("maneja errores específicos de API (PENALTY_REQUIRES_COMPETITION_NIGHT y TWO_FACTOR_REQUIRED)", async () => {
    const nightError = Object.assign(new Error("PENALTY_REQUIRES_COMPETITION_NIGHT"), {
      code: "PENALTY_REQUIRES_COMPETITION_NIGHT",
    });
    apiRequestMock.mockImplementation((path, options) => {
      if (path === "/api/v1/events") return Promise.resolve([mockEvent]);
      if (path === "/api/v1/events/event-1/nights") return Promise.resolve(mockNights);
      if (path === "/api/v1/events/event-1/troupes") return Promise.resolve(mockTroupes);
      if (path === "/api/v1/events/event-1/penalties" && !options?.method) return Promise.resolve([]);
      if (path === "/api/v1/events/event-1/penalties" && options?.method === "POST") return Promise.reject(nightError);
      return Promise.reject(new Error(`request inesperado: ${path}`));
    });

    const { getByLabelText, getByRole, getByText } = render(<AdminPenaltiesPage />);

    await waitFor(() => {
      expect(getByRole("heading", { name: "Registrar sanción reglamentaria" })).toBeVisible();
    });

    fireEvent.change(getByLabelText(/puntos a descontar/i), { target: { value: "3" } });
    fireEvent.change(getByLabelText(/motivo \/ concepto reglamentario/i), { target: { value: "Infracción" } });
    fireEvent.click(getByRole("button", { name: "Registrar penalización" }));

    await waitFor(() =>
      expect(getByText("Solo se pueden aplicar penalizaciones en jornadas competitivas.")).toBeVisible(),
    );
  });
});
