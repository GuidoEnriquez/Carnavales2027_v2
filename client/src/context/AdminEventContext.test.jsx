import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AdminEventProvider, useAdminEvent } from "./AdminEventContext.jsx";
import { apiRequest } from "../api/http.js";

vi.mock("../api/http.js", () => ({ apiRequest: vi.fn() }));

function Probe() {
  const context = useAdminEvent();
  return (
    <div>
      <select aria-label="Evento activo" value={context.activeEventId} onChange={(event) => context.setActiveEventId(event.target.value)}>
        {context.events.map((event) => <option key={event.id} value={event.id}>{event.name}</option>)}
      </select>
      <span>{context.activeEvent?.name ?? "Sin evento"}</span>
    </div>
  );
}

describe("AdminEventContext", () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
    window.localStorage.clear();
  });

  it("carga un evento activo y permite cambiarlo sin otra fuente de selección", async () => {
    apiRequest.mockResolvedValue([
      { id: "e1", name: "Carnaval 2027", status: "CONFIGURING" },
      { id: "e2", name: "Prueba 2027", status: "OPEN" },
    ]);

    render(<AdminEventProvider><Probe /></AdminEventProvider>);

    const selector = await screen.findByRole("combobox", { name: "Evento activo" });
    expect(selector).toHaveValue("e1");
    expect(screen.getAllByText("Carnaval 2027").length).toBeGreaterThan(0);

    fireEvent.change(selector, { target: { value: "e2" } });

    expect(selector).toHaveValue("e2");
    expect(screen.getAllByText("Prueba 2027").length).toBeGreaterThan(0);
    expect(window.localStorage.getItem("carnavales.admin.activeEventId")).toBe("e2");
  });
});
