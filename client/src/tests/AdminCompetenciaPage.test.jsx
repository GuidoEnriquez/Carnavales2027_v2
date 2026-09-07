import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { apiRequest } from "../api/http.js";
import { AdminCompetenciaPage } from "../pages/AdminCompetenciaPage.jsx";

vi.mock("../api/http.js", () => ({ apiRequest: vi.fn() }));

const item = {
  id: "item-1",
  name: "Interpretacion",
  specialtyId: "specialty-1",
  specialtyName: "Danza",
  displayOrder: 1,
  required: true,
  allowNotPresented: true,
  active: true,
};

const rubric = {
  id: "rubric-1",
  name: "Coreografia",
  rubricType: "NOMINATIVE",
  resolutionMethod: "JURY",
  evaluationTarget: "TROUPE",
  active: true,
  items: [item],
  criteria: [{ id: "criterion-1", rubricId: "rubric-1", scoringItemId: item.id, description: "Precision", displayOrder: 1, active: true }],
};

function mockCompetitionData({ orphaned = [], rubrics = [rubric], write = vi.fn().mockRejectedValue(new Error("Escritura inesperada")) } = {}) {
  apiRequest.mockImplementation(async (path, options) => {
    if (options?.method) return write(path, options);
    if (path.endsWith("/troupes")) return [{ id: "troupe-1", name: "Estrella", categoryId: "category-1", active: true }];
    if (path.endsWith("/categories")) return [{ id: "category-1", name: "Comparsa", code: "COMPARSA", displayOrder: 1, active: true }];
    if (path.endsWith("/specialties")) return [{ id: "specialty-1", name: "Danza", code: "DANZA", displayOrder: 1, active: true }];
    if (path.endsWith("/rubrics")) return rubrics;
    if (path.startsWith("/api/v1/rubrics/")) return rubrics.find((entry) => path.endsWith(`/${entry.id}`));
    if (path.endsWith("/orphaned-criteria")) return orphaned;
    throw new Error(`Solicitud inesperada: ${path}`);
  });
}

describe("AdminCompetenciaPage", () => {
  afterEach(() => {
    cleanup();
    vi.resetAllMocks();
  });

  it("usa categorias existentes como tipos de participacion", async () => {
    mockCompetitionData();
    render(<AdminCompetenciaPage event={{ id: "event-1", name: "Carnaval", status: "CONFIGURING" }} />);

    fireEvent.click(screen.getByRole("button", { name: "Tipos de participacion" }));
    expect(await screen.findByText("COMPARSA")).toBeInTheDocument();
    expect(apiRequest).toHaveBeenCalledWith("/api/v1/events/event-1/categories");
    expect(apiRequest.mock.calls.some(([path]) => path.includes("participation-types"))).toBe(false);
  });

  it("muestra criterios dentro de su item y deriva la matriz", async () => {
    mockCompetitionData();
    render(<AdminCompetenciaPage event={{ id: "event-1", name: "Carnaval", status: "CONFIGURING" }} />);

    fireEvent.click(screen.getByRole("button", { name: "Rubros" }));
    fireEvent.click(await screen.findByRole("button", { name: "Expandir Coreografia" }));
    expect(screen.getByText("Interpretacion")).toBeInTheDocument();
    expect(screen.getByText("Precision")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Matriz de planillas" }));
    const rubricButton = await screen.findByRole("button", { name: "Coreografia" });
    fireEvent.click(rubricButton);
    expect(screen.getByText("Precision")).toBeInTheDocument();
  });

  it("reasigna un criterio historico al item seleccionado", async () => {
    mockCompetitionData({
      orphaned: [{ id: "orphan-1", rubricId: "rubric-1", rubricName: "Coreografia", description: "Expresion" }],
      write: vi.fn().mockResolvedValue({ id: "orphan-1", rubricId: "rubric-1", scoringItemId: item.id, description: "Expresion", displayOrder: 2, active: true }),
    });
    render(<AdminCompetenciaPage event={{ id: "event-1", name: "Carnaval", status: "CONFIGURING" }} />);

    expect(await screen.findByText(/Expresion/)).toBeInTheDocument();
    fireEvent.change(screen.getByRole("combobox"), { target: { value: item.id } });
    fireEvent.click(screen.getByRole("button", { name: "Reasignar Expresion" }));

    await waitFor(() => expect(apiRequest).toHaveBeenCalledWith(
      "/api/v1/rubric-criteria/orphan-1",
      { method: "PATCH", body: JSON.stringify({ scoringItemId: item.id }) },
    ));
    expect(await screen.findByText("Criterio reasignado.")).toBeInTheDocument();
  });

  it.each(["PERSON", "COUPLE", "GROUP", "FIGURE", "ELEMENT", "OTHER"])("crea NOMINATION con sujeto %s", async (subjectType) => {
    const write = vi.fn().mockImplementation(async (_path, options) => ({ id: "new-rubric", ...JSON.parse(options.body) }));
    mockCompetitionData({ write });
    render(<AdminCompetenciaPage event={{ id: "event-1", status: "CONFIGURING" }} />);
    fireEvent.click(screen.getByRole("button", { name: "Rubros" }));
    await screen.findByRole("button", { name: "Expandir Coreografia" });
    const form = screen.getByRole("button", { name: "Crear rubro" }).closest("form");
    const fields = within(form);
    expect(Array.from(fields.getByLabelText("Tipo de sujeto").options, (option) => option.value))
      .toEqual(["PERSON", "COUPLE", "GROUP", "FIGURE", "ELEMENT", "OTHER"]);
    fireEvent.change(fields.getByLabelText("Nombre"), { target: { value: "Figura destacada" } });
    fireEvent.change(fields.getByLabelText("Objetivo evaluado"), { target: { value: "NOMINATION" } });
    fireEvent.change(fields.getByLabelText("Tipo de sujeto"), { target: { value: subjectType } });
    fireEvent.change(fields.getByLabelText("Metodo de resolucion"), { target: { value: "COMMITTEE" } });
    fireEvent.change(fields.getByLabelText("Objetivo evaluado (texto)"), { target: { value: "Participante" } });
    fireEvent.submit(form);
    await screen.findByText("Rubro guardado.");
    expect(write).toHaveBeenCalledExactlyOnceWith("/api/v1/events/event-1/rubrics", {
      method: "POST",
      body: JSON.stringify({ name: "Figura destacada", evaluationTarget: "NOMINATION", rubricType: "NOMINATIVE", resolutionMethod: "COMMITTEE", evaluationObjective: "Participante", expectedSubjectType: subjectType }),
    });
    expect(fields.getByLabelText("Nombre")).toHaveValue("");
    expect(fields.getByLabelText("Objetivo evaluado")).toHaveValue("TROUPE");
  });

  it.each([
    ["TROUPE", null, "NOMINATION", "COUPLE"],
    ["NOMINATION", "FIGURE", "NOMINATION", "FIGURE"],
    ["NOMINATION", "PERSON", "NOMINATION", "GROUP"],
    ["NOMINATION", "ELEMENT", "TROUPE", null],
  ])("edita %s/%s a %s/%s", async (initialTarget, initialSubject, target, subject) => {
    const write = vi.fn().mockImplementation(async (_path, options) => ({ id: rubric.id, ...JSON.parse(options.body) }));
    mockCompetitionData({ write, rubrics: [{ ...rubric, evaluationTarget: initialTarget, expectedSubjectType: initialSubject }] });
    render(<AdminCompetenciaPage event={{ id: "event-1", status: "CONFIGURING" }} />);
    fireEvent.click(screen.getByRole("button", { name: "Rubros" }));
    fireEvent.click(await screen.findByRole("button", { name: "Expandir Coreografia" }));
    const form = screen.getByRole("button", { name: "Guardar rubro" }).closest("form");
    const fields = within(form);
    expect(fields.getByLabelText("Tipo de sujeto")).toHaveValue(initialSubject ?? "PERSON");
    fireEvent.change(fields.getByLabelText("Objetivo"), { target: { value: target } });
    if (subject) fireEvent.change(fields.getByLabelText("Tipo de sujeto"), { target: { value: subject } });
    fireEvent.submit(form);
    await screen.findByText("Rubro guardado.");
    expect(write).toHaveBeenCalledExactlyOnceWith("/api/v1/rubrics/rubric-1", {
      method: "PATCH",
      body: JSON.stringify({ name: "Coreografia", evaluationTarget: target, expectedSubjectType: subject, rubricType: "NOMINATIVE", resolutionMethod: "JURY", evaluationObjective: null, active: true }),
    });
    expect(fields.getByLabelText("Objetivo")).toHaveValue(target);
  });

  it.each([
    ["Comparsas", "Agregar comparsa", null, "/api/v1/events/event-1/troupes"],
    ["Comparsas", "Guardar", "Editar comparsa Estrella", "/api/v1/troupes/troupe-1"],
    ["Tipos de participacion", "Agregar tipo", null, "/api/v1/events/event-1/categories"],
    ["Tipos de participacion", "Guardar", "Editar tipo Comparsa", "/api/v1/categories/category-1"],
    ["Especialidades", "Agregar especialidad", null, "/api/v1/events/event-1/specialties"],
    ["Especialidades", "Guardar", "Editar especialidad Danza", "/api/v1/specialties/specialty-1"],
    ["Rubros", "Crear rubro", null, "/api/v1/events/event-1/rubrics"],
    ["Rubros", "Guardar rubro", "Expandir Coreografia", "/api/v1/rubrics/rubric-1"],
    ["Rubros", "Agregar item a Coreografia", "Expandir Coreografia", "/api/v1/rubrics/rubric-1/items"],
    ["Rubros", "Guardar item", "Editar item Interpretacion", "/api/v1/evaluation-items/item-1"],
    ["Rubros", "Agregar criterio a Interpretacion", "Expandir Coreografia", "/api/v1/rubrics/rubric-1/criteria"],
    ["Rubros", "Guardar criterio Precision", "Editar criterio Precision", "/api/v1/rubric-criteria/criterion-1"],
  ])("%s: %s conserva entradas, bloquea duplicados y permite reintentar", async (section, action, edit, path) => {
    let rejectWrite;
    const write = vi.fn().mockImplementationOnce(() => new Promise((_resolve, reject) => { rejectWrite = reject; }))
      .mockImplementationOnce(async (_path, options) => ({
        id: path.split("/").at(-1), ...JSON.parse(options.body),
      }));
    mockCompetitionData({ write });
    render(<AdminCompetenciaPage event={{ id: "event-1", status: "CONFIGURING" }} onBack={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: section }));
    if (section === "Rubros") {
      const expand = await screen.findByRole("button", { name: "Expandir Coreografia" });
      if (edit) fireEvent.click(expand);
    } else {
      await screen.findByRole("button", { name: /^Editar / });
    }
    if (edit && edit !== "Expandir Coreografia") fireEvent.click(screen.getByRole("button", { name: edit }));
    const button = screen.getByRole("button", { name: action });
    const form = button.closest("form");
    const fields = within(form);
    const text = fields.getByRole("textbox", { name: /Nombre|Nuevo item|Nuevo criterio|Descripcion/ });
    fireEvent.change(text, { target: { value: "Entrada conservada" } });
    for (const select of fields.queryAllByRole("combobox")) {
      const value = select.name === "evaluationTarget" ? "NOMINATION" :
        select.name === "expectedSubjectType" ? "OTHER" : Array.from(select.options).find((option) => option.value).value;
      fireEvent.change(select, { target: { value } });
    }
    for (const checkbox of fields.queryAllByRole("checkbox")) fireEvent.click(checkbox);
    for (const order of fields.queryAllByRole("spinbutton")) fireEvent.change(order, { target: { value: "3" } });
    const expectedBody = Object.fromEntries(new FormData(form));
    // Both events in one batch exercise the synchronous guard, not only disabled buttons.
    act(() => { fireEvent.submit(form); fireEvent.submit(form); });
    expect(write).toHaveBeenCalledTimes(1);
    expect(write.mock.calls[0][0]).toBe(path);
    expect(write.mock.calls[0][1].method).toBe(action.startsWith("Guardar") ? "PATCH" : "POST");
    expect(screen.getByRole("main")).toHaveAttribute("aria-busy", "true");
    for (const control of screen.getAllByRole("button")) expect(control).toBeDisabled();
    for (const control of form.elements) expect(control).toBeDisabled();
    expect(text).toHaveValue("Entrada conservada");
    fireEvent.submit(form);
    const otherForm = Array.from(screen.getByRole("main").querySelectorAll("form")).find((candidate) => candidate !== form);
    if (otherForm) fireEvent.submit(otherForm);
    expect(write).toHaveBeenCalledTimes(1);
    await act(async () => { rejectWrite(new Error("Fallo de red")); });
    expect(await screen.findByText("No se pudo guardar.")).toBeInTheDocument();
    expect(button).toBeEnabled();
    expect(Object.fromEntries(new FormData(form))).toEqual(expectedBody);
    fireEvent.click(button);
    await waitFor(() => expect(screen.getByRole("main")).toHaveAttribute("aria-busy", "false"));
    expect(write).toHaveBeenCalledTimes(2);
    expect(write.mock.calls[1]).toEqual(write.mock.calls[0]);
    expect(screen.queryByText("No se pudo guardar.")).not.toBeInTheDocument();
    if (!action.startsWith("Guardar")) expect(text).toHaveValue("");
    else if (action === "Guardar rubro") expect(text).toHaveValue("Entrada conservada");
    else expect(button).not.toBeInTheDocument();
  });

  it("conserva la seleccion de huerfano al fallar y bloquea reasignaciones repetidas", async () => {
    let rejectWrite;
    const write = vi.fn().mockImplementationOnce(() => new Promise((_resolve, reject) => { rejectWrite = reject; }))
      .mockResolvedValueOnce({ id: "orphan-1", rubricId: rubric.id, scoringItemId: item.id });
    mockCompetitionData({ write, orphaned: [{ id: "orphan-1", rubricId: rubric.id, rubricName: rubric.name, description: "Expresion" }] });
    render(<AdminCompetenciaPage event={{ id: "event-1", status: "CONFIGURING" }} />);
    const select = await screen.findByRole("combobox", { name: "Item para Coreografia: Expresion" });
    const button = screen.getByRole("button", { name: "Reasignar Expresion" });
    fireEvent.change(select, { target: { value: item.id } });
    act(() => { fireEvent.submit(button.closest("form")); fireEvent.submit(button.closest("form")); });
    expect(write).toHaveBeenCalledTimes(1);
    expect(select).toBeDisabled();
    expect(button).toBeDisabled();
    expect(screen.getByRole("button", { name: "Rubros" })).toBeDisabled();
    await act(async () => { rejectWrite(new Error("Fallo de red")); });
    expect(await screen.findByText("No se pudo reasignar el criterio.")).toBeInTheDocument();
    expect(select).toHaveValue(item.id);
    expect(select).toBeEnabled();
    fireEvent.click(button);
    await screen.findByText("Criterio reasignado.");
    expect(write).toHaveBeenCalledTimes(2);
    expect(write.mock.calls[1]).toEqual(["/api/v1/rubric-criteria/orphan-1", { method: "PATCH", body: JSON.stringify({ scoringItemId: item.id }) }]);
    expect(button).not.toBeInTheDocument();
  });

  it("explica metadata sin cambiar reglas y da nombre a controles inline", async () => {
    mockCompetitionData();
    render(<AdminCompetenciaPage event={{ id: "event-1", status: "CONFIGURING" }} />);
    fireEvent.click(screen.getByRole("button", { name: "Rubros" }));
    fireEvent.click(await screen.findByRole("button", { name: "Expandir Coreografia" }));
    expect(screen.getByRole("textbox", { name: "Nuevo item puntuable para Coreografia" })).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: "Especialidad del nuevo item para Coreografia" })).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: "Nuevo criterio para Interpretacion" })).toBeInTheDocument();
    expect(screen.getByRole("spinbutton", { name: "Orden del nuevo criterio para Interpretacion" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Agregar criterio a Interpretacion" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Editar item Interpretacion" }));
    fireEvent.click(screen.getByRole("button", { name: "Editar criterio Precision" }));
    for (const control of screen.getAllByRole("checkbox", { name: /Obligatorio|Permite No presentado/ })) {
      expect(control).toHaveAccessibleDescription(/metadata futura: todos los items generados deben resolverse y admiten No se presento \(NOT_PRESENTED\).*pendientes bloquean confirmacion y cierre/);
    }
    for (const control of screen.getAllByRole("combobox", { name: /resolucion/i })) {
      expect(control).toHaveAccessibleDescription(/metadata futura: no ejecuta formulas ni decisiones automaticas o de Comision Organizadora/);
    }
    for (const role of ["textbox", "combobox", "spinbutton", "checkbox", "button"]) {
      for (const control of screen.getAllByRole(role)) expect(control).toHaveAccessibleName();
    }
    expect(apiRequest.mock.calls.every(([, options]) => !options?.method)).toBe(true);
  });

  const reorderedRubric = {
    ...rubric,
    items: [item, { ...item, id: "item-2", name: "Composicion", displayOrder: 7, active: false }],
    criteria: [
      ...rubric.criteria,
      { id: "criterion-other", scoringItemId: "item-2", description: "Criterio ajeno", displayOrder: 2, active: true },
      { id: "criterion-2", scoringItemId: item.id, description: "Expresion", displayOrder: 8, active: false },
    ],
  };

  it.each([
    ["item", "Interpretacion", "Composicion", "evaluation-items", "item-1", "item-2", 7],
    ["criterio", "Precision", "Expresion", "rubric-criteria", "criterion-1", "criterion-2", 8],
  ])("reordena %s con vecino esperado, preserva huecos y bloquea doble envio", async (kind, first, second, resource, firstId, secondId, lastOrder) => {
    let resolveWrite;
    const write = vi.fn(() => new Promise((resolve) => { resolveWrite = resolve; }));
    mockCompetitionData({ rubrics: [reorderedRubric], write });
    render(<AdminCompetenciaPage event={{ id: "event-1", status: "CONFIGURING" }} />);
    fireEvent.click(screen.getByRole("button", { name: "Rubros" }));
    fireEvent.click(await screen.findByRole("button", { name: "Expandir Coreografia" }));
    expect(screen.getByRole("button", { name: `Subir ${kind} ${first}` })).toBeDisabled();
    expect(screen.getByRole("button", { name: `Bajar ${kind} ${second}` })).toBeDisabled();
    const move = screen.getByRole("button", { name: `Bajar ${kind} ${first}` });
    act(() => { fireEvent.click(move); fireEvent.click(move); });
    expect(write).toHaveBeenCalledExactlyOnceWith(`/api/v1/${resource}/${firstId}/reorder`, {
      method: "POST",
      body: JSON.stringify({ direction: "DOWN", neighborId: secondId, expectedOrder: 1, expectedNeighborOrder: lastOrder }),
    });
    expect(move).toBeDisabled();
    expect(screen.getByRole("button", { name: "Resumen" })).toBeDisabled();
    expect(screen.getByRole("button", { name: `Subir ${kind} ${first}` }).compareDocumentPosition(screen.getByRole("button", { name: `Subir ${kind} ${second}` })) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    await act(async () => { resolveWrite({ changes: [{ id: firstId, displayOrder: lastOrder }, { id: secondId, displayOrder: 1 }] }); });
    expect(await screen.findByText("Orden actualizado.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: `Subir ${kind} ${second}` })).toBeDisabled();
    expect(screen.getByRole("button", { name: `Bajar ${kind} ${first}` })).toBeDisabled();
    expect(screen.getByRole("button", { name: `Subir ${kind} ${second}` }).compareDocumentPosition(screen.getByRole("button", { name: `Subir ${kind} ${first}` })) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(screen.getByText("Criterio ajeno")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: `Subir ${kind} ${first}` }));
    expect(write.mock.calls[1]).toEqual([`/api/v1/${resource}/${firstId}/reorder`, {
      method: "POST", body: JSON.stringify({ direction: "UP", neighborId: secondId, expectedOrder: lastOrder, expectedNeighborOrder: 1 }),
    }]);
    await act(async () => { resolveWrite({ changes: [{ id: firstId, displayOrder: 1 }, { id: secondId, displayOrder: lastOrder }] }); });
  });

  it("recarga un conflicto sin repetir el intercambio automaticamente", async () => {
    const rubrics = [reorderedRubric];
    const write = vi.fn(async () => {
      rubrics[0] = { ...reorderedRubric, rubricType: "SPECIAL", items: [{ ...item, displayOrder: 7 }, { ...reorderedRubric.items[1], displayOrder: 1 }] };
      throw { code: "ORDER_CONFLICT" };
    });
    mockCompetitionData({ rubrics, write });
    render(<AdminCompetenciaPage event={{ id: "event-1", status: "CONFIGURING" }} />);
    fireEvent.click(screen.getByRole("button", { name: "Rubros" }));
    fireEvent.click(await screen.findByRole("button", { name: "Expandir Coreografia" }));
    fireEvent.click(screen.getByRole("button", { name: "Bajar item Interpretacion" }));
    expect(await screen.findByText(/La configuracion cambio/)).toBeInTheDocument();
    expect(apiRequest).toHaveBeenCalledWith("/api/v1/rubrics/rubric-1");
    expect(write).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("button", { name: "Guardar rubro" })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Expandir Coreografia" }));
    const editor = screen.getByRole("button", { name: "Guardar rubro" }).closest("form");
    expect(within(editor).getByLabelText("Tipo")).toHaveValue("SPECIAL");
    expect(screen.getByRole("button", { name: "Bajar item Interpretacion" })).toBeDisabled();
  });

  it("no modifica orden local ante fallo de red", async () => {
    mockCompetitionData({ rubrics: [reorderedRubric] });
    render(<AdminCompetenciaPage event={{ id: "event-1", status: "CONFIGURING" }} />);
    fireEvent.click(screen.getByRole("button", { name: "Rubros" }));
    fireEvent.click(await screen.findByRole("button", { name: "Expandir Coreografia" }));
    fireEvent.click(screen.getByRole("button", { name: "Bajar item Interpretacion" }));
    expect(await screen.findByText(/No se pudo cambiar el orden/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Bajar item Interpretacion" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Subir item Interpretacion" })).toBeDisabled();
  });

  it("no ofrece reordenamiento con evento OPEN", async () => {
    mockCompetitionData({ rubrics: [reorderedRubric] });
    render(<AdminCompetenciaPage event={{ id: "event-1", status: "OPEN" }} />);
    fireEvent.click(screen.getByRole("button", { name: "Rubros" }));
    fireEvent.click(await screen.findByRole("button", { name: "Expandir Coreografia" }));
    expect(screen.queryByRole("button", { name: /Subir|Bajar/ })).not.toBeInTheDocument();
    expect(apiRequest.mock.calls.every(([, options]) => !options?.method)).toBe(true);
  });
});
