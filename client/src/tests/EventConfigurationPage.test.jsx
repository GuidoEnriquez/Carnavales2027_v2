import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { apiRequest } from "../api/http.js";
import { EventConfigurationPage } from "../pages/EventConfigurationPage.jsx";

vi.mock("../api/http.js", () => ({ apiRequest: vi.fn() }));

describe("EventConfigurationPage", () => {
  afterEach(() => { cleanup(); vi.clearAllMocks(); });

  it("renderiza bajo la capa de instrumento data-layer='instrument' (RF-177)", () => {
    const { container } = render(<EventConfigurationPage event={{ id: "event-1", status: "CONFIGURING" }} />);
    expect(container.querySelector("main.admin-shell")).toHaveAttribute("data-layer", "instrument");
  });

  it("muestra solo datos del evento y jornadas, sin rubros ni comparsas", () => {
    render(<EventConfigurationPage event={{ id: "event-1", status: "CONFIGURING" }} />);
    expect(screen.getByRole("heading", { name: "Datos del evento" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Jornadas" })).toBeInTheDocument();
    expect(screen.queryByText("Rubros")).not.toBeInTheDocument();
    expect(screen.queryByText("Comparsas")).not.toBeInTheDocument();
    expect(screen.queryByText("Especialidades")).not.toBeInTheDocument();
  });

  it("deja la configuracion en solo lectura cuando el evento esta OPEN", () => {
    render(<EventConfigurationPage event={{ id: "event-1", status: "OPEN" }} />);
    expect(screen.getByLabelText("Nombre del evento")).toBeDisabled();
  });

  it("muestra el boton de Competencia", () => {
    const onCompetencia = vi.fn();
    render(<EventConfigurationPage event={{ id: "event-1", status: "CONFIGURING" }} onCompetencia={onCompetencia} />);
    expect(screen.getByRole("button", { name: "Competencia" })).toBeInTheDocument();
  });

  it("permite crear una jornada", async () => {
    apiRequest.mockResolvedValueOnce({ ready: false, missing: [], incompleteTroupes: [], incompleteRubrics: [], orphanedCriteria: [] });
    apiRequest.mockResolvedValueOnce({ id: "n1", name: "Noche 1", displayOrder: 1, kind: "COMPETITION", eventDate: null });
    apiRequest.mockResolvedValueOnce({ ready: false, missing: [], incompleteTroupes: [], incompleteRubrics: [], orphanedCriteria: [] });
    render(<EventConfigurationPage event={{ id: "event-1", status: "CONFIGURING" }} />);

    fireEvent.change(screen.getByLabelText("Nombre de jornada"), { target: { value: "Noche 1" } });
    fireEvent.click(screen.getByRole("button", { name: "Agregar jornada" }));

    await waitFor(() => expect(apiRequest).toHaveBeenCalledWith(
      "/api/v1/events/event-1/nights",
      expect.objectContaining({ body: JSON.stringify({ name: "Noche 1", displayOrder: 1, kind: "COMPETITION", eventDate: null }) }),
    ));
  });

  it("permite editar el nombre del evento", async () => {
    apiRequest.mockResolvedValueOnce({ ready: false, missing: [], incompleteTroupes: [], incompleteRubrics: [], orphanedCriteria: [] });
    apiRequest.mockResolvedValueOnce({ id: "event-1", name: "Goya 2027 Editado", status: "CONFIGURING" });
    apiRequest.mockResolvedValueOnce({ ready: false, missing: [], incompleteTroupes: [], incompleteRubrics: [], orphanedCriteria: [] });
    render(<EventConfigurationPage event={{ id: "event-1", name: "Goya 2027", status: "CONFIGURING" }} />);

    fireEvent.change(screen.getByLabelText("Nombre del evento"), { target: { value: "Goya 2027 Editado" } });
    fireEvent.click(screen.getByRole("button", { name: "Guardar evento" }));

    await waitFor(() => expect(apiRequest).toHaveBeenCalledWith(
      "/api/v1/events/event-1",
      expect.objectContaining({ method: "PATCH", body: JSON.stringify({ name: "Goya 2027 Editado" }) }),
    ));
  });

  it("muestra el panel de preparacion del evento", async () => {
    apiRequest.mockResolvedValue({ ready: true, missing: [], incompleteTroupes: [], incompleteRubrics: [], orphanedCriteria: [] });
    render(<EventConfigurationPage event={{ id: "event-1", status: "CONFIGURING" }} />);
    await waitFor(() => expect(screen.getByText("Preparacion del evento")).toBeInTheDocument());
  });
});
