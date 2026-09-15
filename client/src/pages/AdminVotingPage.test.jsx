import { cleanup, fireEvent, render, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AdminVotingPage } from "./AdminVotingPage.jsx";

const apiRequestMock = vi.hoisted(() => vi.fn());
vi.mock("../api/http.js", () => ({ apiRequest: apiRequestMock }));

const mockEvent = { id: "event-1", name: "Carnaval 2027", status: "OPEN" };
const mockNights = [{ id: "night-1", name: "Noche 1", kind: "COMPETITION", status: "OPEN" }];

describe("AdminVotingPage NIGHT_SCHEDULE_EMPTY", () => {
  afterEach(() => {
    cleanup();
    apiRequestMock.mockReset();
  });

  it("muestra mensaje humano al abrir votación sin comparsas programadas", async () => {
    const scheduleError = Object.assign(new Error("NIGHT_SCHEDULE_EMPTY"), {
      code: "NIGHT_SCHEDULE_EMPTY",
    });
    apiRequestMock.mockImplementation((path, options) => {
      if (path === "/api/v1/events") return Promise.resolve([mockEvent]);
      if (path === "/api/v1/events/event-1/nights") return Promise.resolve(mockNights);
      if (path.endsWith("/voting/status")) {
        return Promise.resolve({ counts: { OPEN: 0, SUBMITTED: 0, REOPENED: 0 }, total: 0 });
      }
      if (path.endsWith("/voting/ballots")) return Promise.resolve([]);
      if (path.endsWith("/voting/open") && options?.method === "POST") {
        return Promise.reject(scheduleError);
      }
      return Promise.reject(new Error(`request inesperado: ${path}`));
    });

    const { getByRole, getByText } = render(<AdminVotingPage />);

    await waitFor(() => {
      expect(getByRole("button", { name: "Abrir votación" })).toBeVisible();
    });

    fireEvent.click(getByRole("button", { name: "Abrir votación" }));

    await waitFor(() => {
      expect(
        getByText("Programá comparsas en la jornada antes de abrir la votación."),
      ).toBeVisible();
    });
  });

  it("abre la jornada DRAFT desde la mesa de control", async () => {
    const draftNight = { id: "night-1", name: "Noche 1", kind: "COMPETITION", status: "DRAFT", displayOrder: 1, eventDate: "2026-09-15" };
    let nights = [draftNight];
    apiRequestMock.mockImplementation((path, options) => {
      if (path === "/api/v1/events") return Promise.resolve([mockEvent]);
      if (path === "/api/v1/events/event-1/nights") return Promise.resolve(nights);
      if (path.endsWith("/voting/status")) {
        return Promise.resolve({ counts: { OPEN: 0, SUBMITTED: 0, REOPENED: 0 }, total: 0 });
      }
      if (path.endsWith("/voting/ballots")) return Promise.resolve([]);
      if (path === "/api/v1/nights/night-1" && options?.method === "PATCH") {
        nights = [{ ...draftNight, status: "OPEN" }];
        return Promise.resolve(nights[0]);
      }
      return Promise.reject(new Error(`request inesperado: ${path}`));
    });

    const { getByRole, getByText, findByText, queryByRole } = render(<AdminVotingPage />);

    await waitFor(() => {
      expect(getByRole("button", { name: "Abrir jornada" })).toBeVisible();
    });
    expect(getByText("Borrador")).toBeVisible();
    expect(getByRole("button", { name: "Abrir votación" })).toBeDisabled();

    fireEvent.click(getByRole("button", { name: "Abrir jornada" }));

    await waitFor(() => {
      expect(apiRequestMock).toHaveBeenCalledWith("/api/v1/nights/night-1", {
        method: "PATCH",
        body: JSON.stringify({ name: "Noche 1", displayOrder: 1, kind: "COMPETITION", eventDate: "2026-09-15", status: "OPEN" }),
      });
    });
    await findByText("Jornada abierta.");
    await waitFor(() => {
      expect(queryByRole("button", { name: "Abrir jornada" })).not.toBeInTheDocument();
    });
    expect(getByText("Abierta")).toBeVisible();
    expect(getByRole("button", { name: "Abrir votación" })).toBeEnabled();
  });
});
