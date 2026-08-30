import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { apiRequest } from "../api/http.js";
import { AdminAssignmentsPage } from "../pages/AdminAssignmentsPage.jsx";

vi.mock("../api/http.js", () => ({ apiRequest: vi.fn() }));

describe("AdminAssignmentsPage", () => {
  afterEach(() => { cleanup(); vi.clearAllMocks(); });

  it("configura un cupo y conserva la gestión separada de votos", async () => {
    apiRequest.mockImplementation((path) => {
      if (path === "/api/v1/events") return Promise.resolve([{ id: "event-1", name: "Carnaval", status: "CONFIGURING" }]);
      if (path === "/api/v1/judges") return Promise.resolve([{ id: "judge-1", name: "Jurado Uno", registrationStatus: "REGISTERED" }]);
      if (path.endsWith("/nights")) return Promise.resolve([{ id: "night-1", name: "Noche 1", kind: "COMPETITION", status: "DRAFT" }]);
      if (path.endsWith("/specialties")) return Promise.resolve([{ id: "specialty-1", name: "Baile", active: true }]);
      if (path.endsWith("/judge-assignments")) return Promise.resolve({ quotas: [], assignments: [] });
      return Promise.resolve({});
    });
    render(<AdminAssignmentsPage />);
    expect(await screen.findByText("Configurar cupo")).toBeInTheDocument();
    await screen.findAllByRole("option", { name: "Noche 1" });
    await screen.findAllByRole("option", { name: "Baile" });

    const nights = screen.getAllByLabelText("Noche");
    fireEvent.change(nights[0], { target: { value: "night-1" } });
    fireEvent.change(screen.getAllByLabelText("Especialidad")[0], { target: { value: "specialty-1" } });
    fireEvent.change(screen.getByLabelText("Cupo"), { target: { value: "3" } });
    fireEvent.submit(screen.getByRole("button", { name: "Guardar cupo" }).closest("form"));

    await waitFor(() => expect(apiRequest).toHaveBeenCalledWith(
      "/api/v1/events/event-1/nights/night-1/specialties/specialty-1/judge-quota",
      { method: "PUT", body: JSON.stringify({ maxAssignments: 3 }) },
    ));
    expect(screen.queryByText(/puntuar/i)).not.toBeInTheDocument();
  });
});
