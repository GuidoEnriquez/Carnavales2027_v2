import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { apiRequest } from "../api/http.js";
import { EventConfigurationPage } from "../pages/EventConfigurationPage.jsx";

vi.mock("../api/http.js", () => ({ apiRequest: vi.fn() }));

describe("EventConfigurationPage", () => {
  afterEach(() => { cleanup(); vi.clearAllMocks(); });
  it("usa selector de categoría y deja el rubro sin selector directo de especialidad", () => {
    render(<EventConfigurationPage event={{ id: "event-1", status: "CONFIGURING" }} categories={[{ id: "cat-1", name: "Primera" }]} />);
    expect(screen.getByLabelText("Categoría de comparsa").tagName).toBe("SELECT");
    expect(screen.getByRole("heading", { name: "Rubros e ítems" })).toBeInTheDocument();
    expect(screen.queryByLabelText("Especialidad del rubro")).not.toBeInTheDocument();
  });

  it("permite crear ítems seleccionando rubro y especialidad responsable", () => {
    render(
      <EventConfigurationPage
        event={{ id: "event-1", status: "CONFIGURING" }}
        categories={[]}
        specialties={[{ id: "s1", name: "Baile" }]}
        rubrics={[{ id: "r1", name: "Coreografía" }]}
      />,
    );
    expect(screen.getByLabelText("Rubro del ítem").tagName).toBe("SELECT");
    expect(screen.getByLabelText("Especialidad responsable del ítem").tagName).toBe("SELECT");
  });

  it("no ofrece especialidades inactivas para crear ítems", () => {
    render(
      <EventConfigurationPage
        event={{ id: "event-1", status: "CONFIGURING" }}
        specialties={[
          { id: "s1", name: "Baile", active: true },
          { id: "s2", name: "Vestuario", active: false },
        ]}
        rubrics={[{ id: "r1", name: "Coreografía" }]}
      />,
    );
    const selector = screen.getByLabelText("Especialidad responsable del ítem");
    expect(selector).toHaveTextContent("Baile");
    expect(selector).not.toHaveTextContent("Vestuario");
  });

  it("deja la configuración en solo lectura cuando el evento está OPEN", () => {
    render(<EventConfigurationPage event={{ id: "event-1", status: "OPEN" }} categories={[]} />);
    expect(screen.getByLabelText("Nombre de categoría")).toBeDisabled();
  });

  it("envía el tipo de sujeto esperado al crear un rubro NOMINATION", async () => {
    apiRequest
      .mockResolvedValueOnce({ ready: false, missing: [], incompleteTroupes: [], incompleteRubrics: [] })
      .mockResolvedValueOnce({ id: "r2", name: "Reina", code: "REINA", evaluationTarget: "NOMINATION", expectedSubjectType: "PERSON" })
      .mockResolvedValueOnce({ ready: false, missing: [], incompleteTroupes: [], incompleteRubrics: [] });
    render(<EventConfigurationPage event={{ id: "event-1", status: "CONFIGURING" }} />);

    fireEvent.change(screen.getByLabelText("Objetivo"), { target: { value: "NOMINATION" } });
    fireEvent.change(screen.getByLabelText("Nombre de rubro"), { target: { value: "Reina" } });
    fireEvent.change(screen.getByLabelText("Código de rubro"), { target: { value: "REINA" } });
    fireEvent.change(screen.getByLabelText("Tipo de sujeto esperado"), { target: { value: "PERSON" } });
    fireEvent.click(screen.getByRole("button", { name: "Agregar rubro" }));

    await waitFor(() => expect(apiRequest).toHaveBeenCalledWith(
      "/api/v1/events/event-1/rubrics",
      expect.objectContaining({ body: JSON.stringify({ name: "Reina", code: "REINA", evaluationTarget: "NOMINATION", expectedSubjectType: "PERSON" }) }),
    ));
  });

  it("permite editar una especialidad sugerida", async () => {
    apiRequest
      .mockResolvedValueOnce({ ready: false, missing: [], incompleteTroupes: [], incompleteRubrics: [] })
      .mockResolvedValueOnce({ id: "s1", name: "Danza", code: "DANZA", displayOrder: 4, active: true })
      .mockResolvedValueOnce({ ready: false, missing: [], incompleteTroupes: [], incompleteRubrics: [] });
    render(<EventConfigurationPage event={{ id: "event-1", status: "CONFIGURING" }} specialties={[{ id: "s1", name: "Baile", code: "BAILE", displayOrder: 1, active: true }]} />);

    fireEvent.change(screen.getByLabelText("Editar nombre de Baile"), { target: { value: "Danza" } });
    fireEvent.change(screen.getByLabelText("Editar código de Baile"), { target: { value: "DANZA" } });
    fireEvent.change(screen.getByLabelText("Editar orden de Baile"), { target: { value: "4" } });
    fireEvent.click(screen.getByLabelText("Especialidad activa"));
    fireEvent.click(screen.getByRole("button", { name: "Guardar Baile" }));

    await waitFor(() => expect(apiRequest).toHaveBeenCalledWith(
      "/api/v1/specialties/s1",
      expect.objectContaining({ method: "PATCH", body: JSON.stringify({ name: "Danza", code: "DANZA", displayOrder: 4, active: false }) }),
    ));
  });

  it("permite corregir comparsas, rubros, ítems y criterios existentes", async () => {
    apiRequest
      .mockResolvedValueOnce({ ready: false, missing: [], incompleteTroupes: [], incompleteRubrics: [] })
      .mockResolvedValueOnce({ id: "t1", name: "Comparsa editada", categoryId: "cat-1", active: false })
      .mockResolvedValueOnce({ ready: false, missing: [], incompleteTroupes: [], incompleteRubrics: [] });
    render(
      <EventConfigurationPage
        event={{ id: "event-1", name: "Goya", status: "CONFIGURING" }}
        categories={[{ id: "cat-1", name: "Primera", code: "PRIMERA", displayOrder: 1, active: true }]}
        troupes={[{ id: "t1", name: "Comparsa", categoryId: "cat-1", active: true }]}
        specialties={[{ id: "s1", name: "Baile", code: "BAILE", displayOrder: 1, active: true }]}
        rubrics={[{
          id: "r1",
          name: "Coreografía",
          code: "COREO",
          evaluationTarget: "TROUPE",
          active: true,
          specialties: [{ id: "s1", name: "Baile", code: "BAILE" }],
          items: [{ id: "i1", name: "Desarrollo", code: "DES", specialtyId: "s1", active: true }],
          criteria: [{ id: "c1", description: "Descripción", displayOrder: 1, active: true }],
        }]}
      />,
    );

    expect(screen.getByText("Especialidades derivadas: Baile")).toBeInTheDocument();
    expect(screen.getByDisplayValue("Descripción")).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Editar nombre de Comparsa"), { target: { value: "Comparsa editada" } });
    fireEvent.click(screen.getByLabelText("Comparsa activa"));
    fireEvent.click(screen.getByRole("button", { name: "Guardar Comparsa" }));

    await waitFor(() => expect(apiRequest).toHaveBeenCalledWith(
      "/api/v1/troupes/t1",
      expect.objectContaining({ method: "PATCH", body: JSON.stringify({ name: "Comparsa editada", categoryId: "cat-1", active: false }) }),
    ));
  });
});
