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
  const liveRubrics = rubrics.map((entry) => ({ ...entry }));
  apiRequest.mockImplementation(async (path, options) => {
    if (options?.method) {
      const result = await write(path, options);
      if (options.method === "POST" && path.endsWith("/rubrics") && result?.id) liveRubrics.push({ ...result, items: [], criteria: [], specialties: [] });
      return result;
    }
    if (path.endsWith("/troupes")) return [{ id: "troupe-1", name: "Estrella", categoryId: "category-1", active: true }];
    if (path.endsWith("/categories")) return [{ id: "category-1", name: "Comparsa", code: "COMPARSA", displayOrder: 1, active: true }];
    if (path.endsWith("/specialties")) return [{ id: "specialty-1", name: "Danza", code: "DANZA", displayOrder: 1, active: true }];
    if (path.endsWith("/rubrics")) return liveRubrics.map((entry) => ({ ...entry }));
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

  it("renderiza bajo la capa de instrumento data-layer='instrument' (RF-177)", () => {
    mockCompetitionData();
    const { container } = render(<AdminCompetenciaPage event={{ id: "event-1", name: "Carnaval", status: "CONFIGURING" }} />);
    expect(container.querySelector("main.admin-shell")).toHaveAttribute("data-layer", "instrument");
  });

  it("usa categorias existentes como tipos de participacion", async () => {
    mockCompetitionData();
    render(<AdminCompetenciaPage event={{ id: "event-1", name: "Carnaval", status: "CONFIGURING" }} />);

    fireEvent.click(screen.getByRole("button", { name: /Participantes/ }));
    expect(await screen.findByText("COMPARSA")).toBeInTheDocument();
    expect(apiRequest).toHaveBeenCalledWith("/api/v1/events/event-1/categories");
    expect(apiRequest.mock.calls.some(([path]) => path.includes("participation-types"))).toBe(false);
  });

  it("muestra criterios dentro de su item y deriva la matriz", async () => {
    mockCompetitionData();
    render(<AdminCompetenciaPage event={{ id: "event-1", name: "Carnaval", status: "CONFIGURING" }} />);

    fireEvent.click(screen.getByRole("button", { name: /Rubros, ítems y criterios/ }));
    fireEvent.click(await screen.findByRole("button", { name: "Expandir Coreografia" }));
    expect(screen.getAllByText("Interpretacion").length).toBeGreaterThanOrEqual(2);
    expect(screen.getAllByText("Precision").length).toBeGreaterThanOrEqual(2);

    fireEvent.click(screen.getByRole("button", { name: /Revisión final/ }));
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

    fireEvent.click(screen.getByRole("button", { name: /Revisión final/ }));
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
    fireEvent.click(screen.getByRole("button", { name: /Rubros, ítems y criterios/ }));
    await screen.findByRole("button", { name: "Expandir Coreografia" });
    const form = screen.getByRole("button", { name: "Crear rubro" }).closest("form");
    const fields = within(form);
    expect(Array.from(fields.getByLabelText("Tipo de sujeto").options, (option) => option.value))
      .toEqual(["PERSON", "COUPLE", "GROUP", "FIGURE", "ELEMENT", "OTHER"]);
    fireEvent.change(fields.getByLabelText("Nombre"), { target: { value: "Figura destacada" } });
    fireEvent.change(fields.getByLabelText("A quién se evalúa"), { target: { value: "NOMINATION" } });
    fireEvent.change(fields.getByLabelText("Tipo de sujeto"), { target: { value: subjectType } });
    fireEvent.change(fields.getByLabelText("Metodo de resolucion"), { target: { value: "COMMITTEE" } });
    fireEvent.change(fields.getByLabelText("Detalle del objetivo (texto libre, opcional)"), { target: { value: "Participante" } });
    fireEvent.submit(form);
    await screen.findByText("Rubro guardado.");
    expect(write).toHaveBeenCalledExactlyOnceWith("/api/v1/events/event-1/rubrics", {
      method: "POST",
      body: JSON.stringify({ name: "Figura destacada", evaluationTarget: "NOMINATION", rubricType: "NOMINATIVE", resolutionMethod: "COMMITTEE", evaluationObjective: "Participante", expectedSubjectType: subjectType }),
    });
    expect(fields.getByLabelText("Nombre")).toHaveValue("");
    expect(fields.getByLabelText("A quién se evalúa")).toHaveValue("TROUPE");
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
    fireEvent.click(screen.getByRole("button", { name: /Rubros, ítems y criterios/ }));
    fireEvent.click(await screen.findByRole("button", { name: "Expandir Coreografia" }));
    const form = screen.getByRole("button", { name: "Guardar rubro" }).closest("form");
    const fields = within(form);
    expect(fields.getByLabelText("Tipo de sujeto")).toHaveValue(initialSubject ?? "PERSON");
    fireEvent.change(fields.getByLabelText("A quién se evalúa"), { target: { value: target } });
    if (subject) fireEvent.change(fields.getByLabelText("Tipo de sujeto"), { target: { value: subject } });
    fireEvent.submit(form);
    await screen.findByText("Rubro guardado.");
    expect(write).toHaveBeenCalledExactlyOnceWith("/api/v1/rubrics/rubric-1", {
      method: "PATCH",
      body: JSON.stringify({ name: "Coreografia", evaluationTarget: target, expectedSubjectType: subject, rubricType: "NOMINATIVE", resolutionMethod: "JURY", evaluationObjective: null, active: true }),
    });
    expect(fields.getByLabelText("A quién se evalúa")).toHaveValue(target);
  });

  it.each([
    [/Participantes/, "+ Nuevo tipo", "Editar tipo Comparsa", "Agregar tipo", "/api/v1/events/event-1/categories", "/api/v1/categories/category-1", "category"],
    [/Jurados y especialidades/, "+ Nueva especialidad", "Editar especialidad Danza", "Agregar especialidad", "/api/v1/events/event-1/specialties", "/api/v1/specialties/specialty-1", "specialty"],
  ])("%s usa drawer con Orden de visualización y guarda crear/editar", async (section, createLabel, editLabel, submitLabel, createPath, editPath, prefix) => {
    const write = vi.fn().mockImplementation(async (path, options) => ({ id: `${prefix}-9`, ...JSON.parse(options.body) }));
    mockCompetitionData({ write });
    render(<AdminCompetenciaPage event={{ id: "event-1", status: "CONFIGURING" }} />);
    fireEvent.click(screen.getByRole("button", { name: section }));
    // Paso 1 muestra tipos y comparsas (2 tablas); el resto una sola.
    expect((await screen.findAllByRole("table"))).toHaveLength(String(section) === String(/Participantes/) ? 2 : 1);

    fireEvent.click(screen.getByRole("button", { name: createLabel }));
    const createForm = screen.getByRole("button", { name: submitLabel }).closest("form");
    const createFields = within(createForm);
    // Al crear, el orden lo asigna el servidor: el campo no se muestra.
    expect(createFields.queryByLabelText("Orden de visualización")).toBeNull();
    fireEvent.change(createFields.getByLabelText("Nombre"), { target: { value: "Nuevo" } });
    fireEvent.submit(createForm);
    await waitFor(() => expect(write).toHaveBeenCalledWith(
      createPath,
      { method: "POST", body: JSON.stringify({ name: "Nuevo" }) },
    ));
    expect(await screen.findByText("Guardado.")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: editLabel }));
    const editForm = screen.getByRole("button", { name: "Guardar" }).closest("form");
    const editFields = within(editForm);
    expect(editFields.getByLabelText("Orden de visualización")).toBeInTheDocument();
    fireEvent.change(editFields.getByLabelText("Nombre"), { target: { value: "Editado" } });
    fireEvent.click(editFields.getByLabelText("Activa"));
    fireEvent.submit(editForm);
    await waitFor(() => expect(write).toHaveBeenCalledWith(
      editPath,
      expect.objectContaining({ method: "PATCH" }),
    ));
  });

  it("muestra mensaje humano ante nombre u orden duplicado", async () => {
    const write = vi.fn().mockRejectedValue({ code: "RESOURCE_CONFLICT" });
    mockCompetitionData({ write });
    render(<AdminCompetenciaPage event={{ id: "event-1", status: "CONFIGURING" }} />);
    fireEvent.click(screen.getByRole("button", { name: /Participantes/ }));
    expect((await screen.findAllByRole("table"))).toHaveLength(2);
    fireEvent.click(screen.getByRole("button", { name: "+ Nuevo tipo" }));
    const form = screen.getByRole("button", { name: "Agregar tipo" }).closest("form");
    fireEvent.change(within(form).getByLabelText("Nombre"), { target: { value: "Duplicado" } });
    fireEvent.submit(form);
    expect(await screen.findByText("Ese nombre u orden ya está en uso.")).toBeInTheDocument();
  });
  it.each([
    [/Rubros, ítems y criterios/, "Crear rubro", null, "/api/v1/events/event-1/rubrics"],
    [/Rubros, ítems y criterios/, "Guardar rubro", "Expandir Coreografia", "/api/v1/rubrics/rubric-1"],
    [/Rubros, ítems y criterios/, "Agregar item a Coreografia", "Expandir Coreografia", "/api/v1/rubrics/rubric-1/items"],
    [/Rubros, ítems y criterios/, "Guardar item", "Editar item Interpretacion", "/api/v1/evaluation-items/item-1"],
    [/Rubros, ítems y criterios/, "Agregar criterio a Interpretacion", "Expandir Coreografia", "/api/v1/rubrics/rubric-1/criteria"],
    [/Rubros, ítems y criterios/, "Guardar criterio Precision", "Editar criterio Precision", "/api/v1/rubric-criteria/criterion-1"],
  ])("%s: %s conserva entradas, bloquea duplicados y permite reintentar", async (section, action, edit, path) => {
    let rejectWrite;
    const write = vi.fn().mockImplementationOnce(() => new Promise((_resolve, reject) => { rejectWrite = reject; }))
      .mockImplementationOnce(async (_path, options) => ({
        id: path.split("/").at(-1), ...JSON.parse(options.body),
      }));
    mockCompetitionData({ write });
    render(<AdminCompetenciaPage event={{ id: "event-1", status: "CONFIGURING" }} onBack={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: section }));
    if (String(section) === String(/Rubros, ítems y criterios/)) {
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
    fireEvent.click(screen.getByRole("button", { name: /Revisión final/ }));
    const select = await screen.findByRole("combobox", { name: "Item para Coreografia: Expresion" });
    const button = screen.getByRole("button", { name: "Reasignar Expresion" });
    fireEvent.change(select, { target: { value: item.id } });
    act(() => { fireEvent.submit(button.closest("form")); fireEvent.submit(button.closest("form")); });
    expect(write).toHaveBeenCalledTimes(1);
    expect(select).toBeDisabled();
    expect(button).toBeDisabled();
    expect(screen.getByRole("button", { name: /Rubros, ítems y criterios/ })).toBeDisabled();
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
    fireEvent.click(screen.getByRole("button", { name: /Rubros, ítems y criterios/ }));
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
    fireEvent.click(screen.getByRole("button", { name: /Rubros, ítems y criterios/ }));
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
    expect(screen.getByRole("button", { name: /Revisión final/ })).toBeDisabled();
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
    fireEvent.click(screen.getByRole("button", { name: /Rubros, ítems y criterios/ }));
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
    fireEvent.click(screen.getByRole("button", { name: /Rubros, ítems y criterios/ }));
    fireEvent.click(await screen.findByRole("button", { name: "Expandir Coreografia" }));
    fireEvent.click(screen.getByRole("button", { name: "Bajar item Interpretacion" }));
    expect(await screen.findByText(/No se pudo cambiar el orden/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Bajar item Interpretacion" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Subir item Interpretacion" })).toBeDisabled();
  });

  it("no ofrece reordenamiento con evento OPEN", async () => {
    mockCompetitionData({ rubrics: [reorderedRubric] });
    render(<AdminCompetenciaPage event={{ id: "event-1", status: "OPEN" }} />);
    fireEvent.click(screen.getByRole("button", { name: /Rubros, ítems y criterios/ }));
    fireEvent.click(await screen.findByRole("button", { name: "Expandir Coreografia" }));
    expect(screen.queryByRole("button", { name: /Subir|Bajar/ })).not.toBeInTheDocument();
    expect(apiRequest.mock.calls.every(([, options]) => !options?.method)).toBe(true);
  });

  describe("Spec 017 T09a/T09b: ficha de comparsa y orden de pasada", () => {
    const troupes = [
      { id: "troupe-1", name: "Estrella", categoryId: "category-1", categoryName: "Comparsa", brandColor: "#3B82F6", active: true },
      { id: "troupe-2", name: "Apagada", categoryId: "category-1", categoryName: "Comparsa", brandColor: null, active: false },
    ];
    const scheduleRows = [
      { id: "s-1", nightId: "night-1", troupeId: "troupe-1", troupeName: "Estrella", troupeBrandColor: "#3B82F6", presentationOrder: 1, status: "SCHEDULED" },
      { id: "s-2", nightId: "night-1", troupeId: "troupe-2", troupeName: "Apagada", troupeBrandColor: null, presentationOrder: 2, status: "SCHEDULED" },
    ];
    function mockTroupes({ write = vi.fn(), schedule = scheduleRows } = {}) {
      const live = troupes.map((t) => ({ ...t }));
      apiRequest.mockImplementation(async (path, options) => {
        if (options?.method) {
          const result = await write(path, options);
          if (options.method === "POST" && path.endsWith("/troupes") && result?.id) live.push({ ...result });
          return result;
        }
        if (path === "/api/v1/events/event-1/nights") return [{ id: "night-1", name: "Noche 1", displayOrder: 1, kind: "COMPETITION" }];
        if (path.startsWith("/api/v1/events/event-1/schedule")) return schedule.map((row) => ({ ...row }));
        if (path.endsWith("/troupes")) return live.map((t) => ({ ...t }));
        if (path.endsWith("/categories")) return [{ id: "category-1", name: "Comparsa", code: "COMPARSA", displayOrder: 1, active: true }];
        if (path.endsWith("/specialties")) return [{ id: "specialty-1", name: "Danza", code: "DANZA", displayOrder: 1, active: true }];
        if (path.endsWith("/rubrics")) return [rubric];
        if (path.endsWith("/orphaned-criteria")) return [];
        throw new Error(`Solicitud inesperada: ${path}`);
      });
    }
    async function openTroupesTab() {
      render(<AdminCompetenciaPage event={{ id: "event-1", name: "Carnaval", status: "CONFIGURING" }} />);
      fireEvent.click(screen.getByRole("button", { name: /Participantes/ }));
      // Paso 1 asentado: tabla de tipos + tabla de comparsas (evita race con el schedule)
      expect((await screen.findAllByRole("table"))).toHaveLength(2);
    }

    it("muestra horario de API y distingue el cronograma ficticio", async () => {
      mockTroupes({ schedule: [{ ...scheduleRows[0], scheduledAt: "2027-02-07T04:00:00.000Z",
        scheduledTimezone: "America/Argentina/Cordoba", orderSource: "TEST_SIMULATED_DRAW" }] });
      await openTroupesTab();
      expect(await screen.findByText(/Programada:.*01:00/)).toHaveTextContent("07/02/2027");
      expect(screen.getByText(/no son un cronograma oficial de la COC/)).toBeInTheDocument();
    });

    it("crea comparsa con color y muestra preview Vista jurado", async () => {
      const write = vi.fn().mockResolvedValue({ id: "troupe-3", name: "Nueva", categoryId: "category-1", categoryName: "Comparsa", brandColor: "#22C55E", active: true });
      mockTroupes({ write });
      await openTroupesTab();
      fireEvent.click(screen.getByRole("button", { name: "+ Nueva comparsa" }));
      const form = screen.getByRole("button", { name: "Agregar comparsa" }).closest("form");
      const fields = within(form);
      fireEvent.change(fields.getByLabelText("Nombre"), { target: { value: "Nueva" } });
      fireEvent.change(fields.getByLabelText("Tipo de participación"), { target: { value: "category-1" } });
      fireEvent.change(fields.getByLabelText("Color (opcional)"), { target: { value: "#22C55E" } });
      fireEvent.submit(form);
      await screen.findByText("Guardado.");
      expect(write).toHaveBeenCalledExactlyOnceWith("/api/v1/events/event-1/troupes", {
        method: "POST",
        body: JSON.stringify({ name: "Nueva", categoryId: "category-1", brandColor: "#22C55E" }),
      });
      expect(await screen.findByText("Vista jurado: Nueva (#22C55E)")).toBeInTheDocument();
    });

    it("rechaza color invalido en cliente sin llamar a la API", async () => {
      const write = vi.fn();
      mockTroupes({ write });
      await openTroupesTab();
      fireEvent.click(screen.getByRole("button", { name: "+ Nueva comparsa" }));
      const form = screen.getByRole("button", { name: "Agregar comparsa" }).closest("form");
      fireEvent.change(within(form).getByLabelText("Nombre"), { target: { value: "Mala" } });
      fireEvent.change(within(form).getByLabelText("Tipo de participación"), { target: { value: "category-1" } });
      fireEvent.change(within(form).getByLabelText("Color (opcional)"), { target: { value: "azul" } });
      fireEvent.submit(form);
      expect(await screen.findByRole("alert")).toHaveTextContent(/formato #RRGGBB/);
      expect(write).not.toHaveBeenCalled();
      expect(within(form).getByLabelText("Nombre")).toHaveValue("Mala");
    });

    it("edita comparsa en drawer, bloquea doble envío y reintenta tras fallo", async () => {
      let rejectWrite;
      const write = vi.fn()
        .mockImplementationOnce(() => new Promise((_resolve, reject) => { rejectWrite = reject; }))
        .mockImplementationOnce(async (path, options) => ({ id: "troupe-1", ...JSON.parse(options.body) }));
      mockTroupes({ write });
      await openTroupesTab();
      fireEvent.click(screen.getByRole("button", { name: "Editar comparsa Estrella" }));
      const button = screen.getByRole("button", { name: "Guardar comparsa" });
      const form = button.closest("form");
      const fields = within(form);
      fireEvent.change(fields.getByLabelText("Nombre"), { target: { value: "Estrella Editada" } });
      act(() => { fireEvent.submit(form); fireEvent.submit(form); });
      expect(write).toHaveBeenCalledTimes(1);
      expect(write.mock.calls[0][0]).toBe("/api/v1/troupes/troupe-1");
      expect(write.mock.calls[0][1].method).toBe("PATCH");
      await act(async () => { rejectWrite(new Error("Fallo de red")); });
      expect(await screen.findByText("No se pudo guardar.")).toBeInTheDocument();
      expect(fields.getByLabelText("Nombre")).toHaveValue("Estrella Editada");
      fireEvent.click(button);
      await waitFor(() => expect(write).toHaveBeenCalledTimes(2));
      expect(await screen.findByText("Guardado.")).toBeInTheDocument();
    });

    it("filtra por busqueda y estado sin ocultar datos", async () => {
      mockTroupes();
      await openTroupesTab();
      const section = screen.getByRole("heading", { name: "Comparsas" }).closest("section");
      const cards = () => within(section);
      expect(screen.getByText("1 de 2 comparsas")).toBeInTheDocument();
      expect(cards().queryByText("Apagada")).not.toBeInTheDocument();
      fireEvent.change(screen.getByRole("combobox", { name: "Filtrar comparsas por estado" }), { target: { value: "all" } });
      expect(screen.getByText("2 de 2 comparsas")).toBeInTheDocument();
      fireEvent.change(screen.getByRole("searchbox", { name: "Buscar comparsa por nombre" }), { target: { value: "estre" } });
      expect(cards().getByText("Estrella")).toBeInTheDocument();
      expect(cards().queryByText("Apagada")).not.toBeInTheDocument();
      expect(screen.getByText("1 de 2 comparsas")).toBeInTheDocument();
      fireEvent.change(screen.getByRole("searchbox", { name: "Buscar comparsa por nombre" }), { target: { value: "" } });
      fireEvent.change(screen.getByRole("combobox", { name: "Filtrar comparsas por estado" }), { target: { value: "inactive" } });
      expect(cards().queryByText("Estrella")).not.toBeInTheDocument();
      expect(cards().getByText("Apagada")).toBeInTheDocument();
    });

    it("elimina (desactiva) comparsa con confirmacion y permite reactivar", async () => {
      const write = vi.fn(async (path, options) => {
        const body = JSON.parse(options.body);
        if (path === "/api/v1/troupes/troupe-1" && options.method === "PATCH") return { id: "troupe-1", ...body };
        throw new Error(`Solicitud inesperada: ${path}`);
      });
      mockTroupes({ write });
      await openTroupesTab();
      fireEvent.click(screen.getByRole("button", { name: "Eliminar comparsa Estrella" }));
      expect(await screen.findByRole("dialog", { name: "Eliminar Estrella" })).toBeInTheDocument();
      fireEvent.click(screen.getByRole("button", { name: "Eliminar (desactivar)" }));
      expect(write).toHaveBeenCalledWith("/api/v1/troupes/troupe-1", {
        method: "PATCH",
        body: JSON.stringify({ active: false }),
      });
      expect(await screen.findByText("Comparsa Estrella eliminada (desactivada en BD).")).toBeInTheDocument();
    });

    it("muestra orden por jornada y reordena con vecino esperado", async () => {
      const write = vi.fn().mockResolvedValue({ changes: [{ id: "s-1", presentationOrder: 2 }, { id: "s-2", presentationOrder: 1 }] });
      mockTroupes({ write });
      await openTroupesTab();
      expect(await screen.findByText("Orden de pasada")).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Subir Estrella en Noche 1" })).toBeDisabled();
      expect(screen.getByRole("button", { name: "Bajar Apagada en Noche 1" })).toBeDisabled();
      fireEvent.click(screen.getByRole("button", { name: "Bajar Estrella en Noche 1" }));
      expect(write).toHaveBeenCalledExactlyOnceWith("/api/v1/schedule/s-1/reorder", {
        method: "POST",
        body: JSON.stringify({ direction: "DOWN", neighborId: "s-2", expectedOrder: 1, expectedNeighborOrder: 2 }),
      });
      expect(await screen.findByText("Orden de pasada actualizado.")).toBeInTheDocument();
    });

    it("recarga la jornada ante conflicto sin repetir el intercambio", async () => {
      const write = vi.fn().mockRejectedValueOnce({ code: "ORDER_CONFLICT" });
      mockTroupes({ write });
      await openTroupesTab();
      await screen.findByText("Orden de pasada");
      fireEvent.click(screen.getByRole("button", { name: "Bajar Estrella en Noche 1" }));
      expect(await screen.findByText(/El orden cambio/)).toBeInTheDocument();
      expect(write).toHaveBeenCalledTimes(1);
      expect(apiRequest).toHaveBeenCalledWith("/api/v1/events/event-1/schedule?nightId=night-1");
    });

    it("oculta edicion y reorden de comparsas con evento OPEN", async () => {
      mockTroupes();
      render(<AdminCompetenciaPage event={{ id: "event-1", status: "OPEN" }} />);
      fireEvent.click(screen.getByRole("button", { name: /Participantes/ }));
      await screen.findByText("Estrella");
      expect(screen.queryByRole("button", { name: /Editar comparsa|Nueva comparsa|Subir|Bajar/ })).not.toBeInTheDocument();
      expect(apiRequest.mock.calls.every(([, options]) => !options?.method)).toBe(true);
    });

    it("programa y quita comparsas de la jornada", async () => {
      const write = vi.fn().mockImplementation(async (path, options) => {
        if (path.endsWith("/schedule") && options.method === "POST") {
          return { id: "s-9", presentationOrder: 1, status: "SCHEDULED" };
        }
        if (path.endsWith("/schedule/s-9") && options.method === "DELETE") return { id: "s-9" };
        throw new Error("Escritura inesperada");
      });
      mockTroupes({ write, schedule: [] });
      render(<AdminCompetenciaPage event={{ id: "event-1", name: "Carnaval", status: "CONFIGURING" }} />);
      expect(await screen.findByText(/Sin comparsas programadas/)).toBeInTheDocument();
      fireEvent.change(
        screen.getByRole("combobox", { name: "Comparsa para programar en la jornada" }),
        { target: { value: "troupe-1" } },
      );
      fireEvent.click(screen.getByRole("button", { name: "Programar comparsa" }));
      expect(write).toHaveBeenCalledWith("/api/v1/events/event-1/schedule", {
        method: "POST",
        body: JSON.stringify({ nightId: "night-1", troupeId: "troupe-1" }),
      });
      expect(await screen.findByText("Comparsa programada en la jornada.")).toBeInTheDocument();
      fireEvent.click(screen.getByRole("button", { name: "Quitar Estrella de Noche 1" }));
      fireEvent.click(await screen.findByRole("button", { name: "Quitar de la jornada" }));
      expect(write).toHaveBeenCalledWith("/api/v1/schedule/s-9", { method: "DELETE" });
      expect(await screen.findByText("Comparsa quitada de la jornada.")).toBeInTheDocument();
    });
  });

  describe("Spec 027/D: árbol de evaluación y planillas accionables", () => {
    function mockRubrics({ rubrics: customRubrics } = {}) {
      const rubrics = customRubrics ?? [rubric];
      apiRequest.mockImplementation(async (path, options) => {
        if (options?.method) throw new Error("Escritura inesperada");
        if (path.endsWith("/troupes")) return [];
        if (path.endsWith("/categories")) return [];
        if (path.endsWith("/specialties")) {
          return [{ id: "specialty-1", name: "Danza", code: "DANZA", displayOrder: 1, active: true }];
        }
        if (path.endsWith("/rubrics")) return rubrics.map((r) => ({ ...r }));
        if (path.endsWith("/orphaned-criteria")) return [];
        throw new Error(`Solicitud inesperada: ${path}`);
      });
    }

    it("muestra el árbol Especialidad → Rubro → Ítem → Criterio y colapsa metadata futura", async () => {
      mockRubrics();
      render(<AdminCompetenciaPage event={{ id: "event-1", status: "CONFIGURING" }} />);
      fireEvent.click(screen.getByRole("button", { name: /Rubros, ítems y criterios/ }));
      expect(await screen.findByText("Qué puntúa el jurado")).toBeInTheDocument();
      const tree = screen.getByLabelText("Árbol de evaluación por especialidad");
      expect(within(tree).getByText("Danza")).toBeInTheDocument();
      expect(within(tree).getByText("Coreografia")).toBeInTheDocument();
      expect(within(tree).getByText("Interpretacion")).toBeInTheDocument();
      expect(within(tree).getByText("Precision")).toBeInTheDocument();
      const advanced = screen.getAllByText("Opciones avanzadas (sin efecto operativo)");
      expect(advanced.length).toBeGreaterThan(0);
    });

    it("la matriz advierte faltantes y Resolver lleva al rubro expandido", async () => {
      mockRubrics({
        rubrics: [
          { ...rubric, id: "rubric-empty", name: "Vacio", items: [], criteria: [] },
          rubric,
        ],
      });
      render(<AdminCompetenciaPage event={{ id: "event-1", status: "CONFIGURING" }} />);
      fireEvent.click(screen.getByRole("button", { name: /Revisión final/ }));
      expect(await screen.findByText(/Te faltan .* asignaciones/)).toBeInTheDocument();
      fireEvent.click(screen.getByRole("button", { name: "Resolver rubro Vacio" }));
      expect(await screen.findByRole("button", { name: "Contraer Vacio" })).toBeInTheDocument();
    });
  });

  describe("asistente de configuración (wizard)", () => {
    it("muestra 4 pasos en orden de dependencia con progreso no bloqueante", async () => {
      mockCompetitionData();
      render(<AdminCompetenciaPage event={{ id: "event-1", status: "CONFIGURING" }} />);
      for (const step of [/Participantes/, /Jurados y especialidades/, /Rubros, ítems y criterios/, /Revisión final/]) {
        expect(screen.getByRole("button", { name: step })).toBeInTheDocument();
      }
      // Una sola línea de progreso: una progressbar, sin checklist ni región redundante.
      expect(screen.getAllByRole("progressbar")).toHaveLength(1);
      expect(screen.getByRole("progressbar", { name: "Progreso de configuración" })).toBeInTheDocument();
      expect(screen.queryByRole("region", { name: "Configuración de la competencia" })).not.toBeInTheDocument();
      // Paso 1 por defecto: tipos y comparsas juntos, sin resumen suelto
      expect(screen.getByRole("heading", { name: "Tipos de participacion" })).toBeInTheDocument();
      expect(screen.getByRole("heading", { name: "Comparsas" })).toBeInTheDocument();
      expect(screen.queryByRole("heading", { name: "Resumen de competencia" })).not.toBeInTheDocument();
      fireEvent.click(screen.getByRole("button", { name: /Revisión final/ }));
      expect(await screen.findByRole("heading", { name: "Resumen de competencia" })).toBeInTheDocument();
    });

    it("auto-expande el rubro recién creado para seguir cargando ítems", async () => {
      const write = vi.fn().mockImplementation(async (_path, options) => ({ id: "rubric-new", ...JSON.parse(options.body) }));
      mockCompetitionData({ write, rubrics: [] });
      render(<AdminCompetenciaPage event={{ id: "event-1", status: "CONFIGURING" }} />);
      fireEvent.click(screen.getByRole("button", { name: /Rubros, ítems y criterios/ }));
      fireEvent.change(screen.getByRole("textbox", { name: "Nombre" }), { target: { value: "Nuevo Rubro" } });
      fireEvent.click(screen.getByRole("button", { name: "Crear rubro" }));
      expect(await screen.findByRole("button", { name: "Contraer Nuevo Rubro" })).toBeInTheDocument();
      expect(screen.getByRole("textbox", { name: "Nuevo item puntuable para Nuevo Rubro" })).toBeInTheDocument();
    });
  });

  describe("refinamiento UX sin cambios de lógica", () => {
    it("muestra cabecera compacta con evento, paso actual, porcentaje y Volver", async () => {
      mockCompetitionData();
      const onBack = vi.fn();
      render(<AdminCompetenciaPage event={{ id: "event-1", name: "Carnaval", status: "CONFIGURING" }} onBack={onBack} />);
      expect(screen.getByText("Competencia")).toBeInTheDocument();
      expect(screen.getByRole("heading", { name: "Carnaval", level: 1 })).toBeInTheDocument();
      expect(screen.getByText(/Paso 1 de 4/)).toBeInTheDocument();
      expect(screen.getByText(/% completado/)).toBeInTheDocument();
      fireEvent.click(screen.getByRole("button", { name: "Volver" }));
      expect(onBack).toHaveBeenCalledTimes(1);
      fireEvent.click(screen.getByRole("button", { name: /Jurados y especialidades/ }));
      expect(await screen.findByText(/Paso 2 de 4/)).toBeInTheDocument();
    });

    it("el stepper expone 4 pasos accionables con estado y marca el actual", async () => {
      mockCompetitionData();
      render(<AdminCompetenciaPage event={{ id: "event-1", status: "CONFIGURING" }} />);
      const nav = screen.getByRole("navigation", { name: "Pasos de configuración de competencia" });
      expect(within(nav).getAllByRole("button")).toHaveLength(4);
      expect(screen.getByRole("button", { name: /Paso 1 de 4: Participantes/ })).toHaveAttribute("aria-current", "step");
      expect(screen.getByRole("button", { name: /Paso 4 de 4: Revisión final/ })).not.toHaveAttribute("aria-current");
      fireEvent.click(screen.getByRole("button", { name: /Revisión final/ }));
      expect(await screen.findByRole("heading", { name: "Revisión final" })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /Paso 4 de 4: Revisión final/ })).toHaveAttribute("aria-current", "step");
    });

    it("el paso Participantes se organiza en 3 subbloques con resumen contextual", async () => {
      mockCompetitionData();
      render(<AdminCompetenciaPage event={{ id: "event-1", status: "CONFIGURING" }} />);
      expect(screen.getByRole("heading", { name: "Participantes" })).toBeInTheDocument();
      for (const block of ["Bloque 1 de 3: Tipos de participación", "Bloque 2 de 3: Comparsas", "Bloque 3 de 3: Orden de pasada por jornada"]) {
        expect(screen.getByRole("region", { name: block })).toBeInTheDocument();
      }
      const summary = screen.getByRole("region", { name: "Resumen del paso Participantes" });
      expect(within(summary).getByRole("heading", { name: "Resumen del paso" })).toBeInTheDocument();
      // Datos reales del mock: 1 tipo y 1 comparsa activa.
      expect(await within(summary).findByText(/1 comparsa\(s\) activa\(s\) en 1 tipo\(s\)/)).toBeInTheDocument();
    });

    it("el resumen del paso Jurados recomienda crear especialidades y enlaza a Jurados", async () => {
      mockCompetitionData();
      render(<AdminCompetenciaPage event={{ id: "event-1", status: "CONFIGURING" }} />);
      fireEvent.click(screen.getByRole("button", { name: /Jurados y especialidades/ }));
      expect(await screen.findByRole("heading", { name: "Jurados y especialidades" })).toBeInTheDocument();
      const summary = screen.getByRole("region", { name: "Resumen del paso Jurados y especialidades" });
      expect(within(summary).getByText(/1 especialidad\(es\) activa\(s\)/)).toBeInTheDocument();
      expect(screen.getByRole("link", { name: "Jurados" })).toHaveAttribute("href", "#/admin/judges");
    });

    it("mueve el foco al título del paso al navegar y no usa el copy anterior", async () => {
      mockCompetitionData();
      render(<AdminCompetenciaPage event={{ id: "event-1", status: "CONFIGURING" }} />);
      fireEvent.click(screen.getByRole("button", { name: /Rubros, ítems y criterios/ }));
      const title = await screen.findByRole("heading", { name: "Rubros, ítems y criterios" });
      expect(title).toHaveFocus();
      expect(screen.queryByText(/Quiénes participan/)).not.toBeInTheDocument();
      expect(screen.queryByText(/Quién evalúa/)).not.toBeInTheDocument();
      expect(screen.queryByText(/Qué se puntúa/)).not.toBeInTheDocument();
      expect(screen.queryByText(/Revisar y cerrar/)).not.toBeInTheDocument();
    });
  });
});
