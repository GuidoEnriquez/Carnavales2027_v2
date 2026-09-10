import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AdminHomePage } from "./AdminHomePage.jsx";
import { apiRequest } from "../api/http.js";
import { AdminEventProvider } from "../context/AdminEventContext.jsx";

vi.mock("../api/http.js", () => ({ apiRequest: vi.fn() }));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

const readinessIncomplete = {
  ready: false,
  missing: ["ACTIVE_TROUPE"],
  incompleteTroupes: [],
  incompleteRubrics: [{ id: "r1", name: "Coreografía" }],
};

function mockAll({ readiness = readinessIncomplete, status = "CONFIGURING" } = {}) {
  apiRequest.mockImplementation((path) => {
    if (path === "/api/v1/events") return Promise.resolve([{ id: "e1", name: "Goya 2027", status }]);
    if (path === "/api/v1/events/e1/readiness") return Promise.resolve(readiness);
    if (path === "/api/v1/events/e1/nights") return Promise.resolve([{ id: "n1", kind: "COMPETITION" }]);
    if (path === "/api/v1/events/e1/troupes") return Promise.resolve([]);
    if (path === "/api/v1/events/e1/specialties") return Promise.resolve([{ id: "s1", active: true }]);
    if (path === "/api/v1/events/e1/rubrics") return Promise.resolve([]);
    if (path === "/api/v1/events/e1/judge-assignments") return Promise.resolve({ assignments: [] });
    if (path === "/api/v1/judges") return Promise.resolve([]);
    return Promise.reject(new Error(`unexpected ${path}`));
  });
}

function mockComplete({ status = "OPEN" } = {}) {
  apiRequest.mockImplementation((path) => {
    if (path === "/api/v1/events") return Promise.resolve([{ id: "e1", name: "Goya 2027", status }]);
    if (path === "/api/v1/events/e1/readiness") return Promise.resolve({ ready: true, missing: [], incompleteTroupes: [], incompleteRubrics: [] });
    if (path === "/api/v1/events/e1/nights") return Promise.resolve([{ id: "n1", kind: "COMPETITION" }]);
    if (path === "/api/v1/events/e1/troupes") return Promise.resolve([{ id: "t1", name: "Ara Berá", active: true }]);
    if (path === "/api/v1/events/e1/specialties") return Promise.resolve([{ id: "s1", active: true }]);
    if (path === "/api/v1/events/e1/rubrics") return Promise.resolve([{ id: "r1", name: "Coreografía", active: true }]);
    if (path === "/api/v1/events/e1/judge-assignments") return Promise.resolve({ assignments: [{ id: "a1", status: "ACTIVE" }] });
    if (path === "/api/v1/judges") return Promise.resolve([{ id: "j1", registrationStatus: "REGISTERED" }]);
    return Promise.reject(new Error(`unexpected ${path}`));
  });
}

describe("AdminHomePage (Spec 027/B)", () => {
  it("responde estado, progreso, próximo paso y problemas con deep-link", async () => {
    mockAll();
    render(<AdminHomePage />);
    expect(await screen.findByRole("heading", { name: "Goya 2027" })).toBeInTheDocument();
    expect(screen.getAllByText("En configuración").length).toBeGreaterThan(0);
    expect(screen.getByRole("progressbar", { name: "Preparación del evento" })).toBeInTheDocument();
    expect(await screen.findByText(/Siguiente paso/)).toBeInTheDocument();
    expect(screen.getAllByRole("link", { name: "Configurar comparsas" })).toHaveLength(2);
    expect((await screen.findAllByText(/Todavía no hay comparsas activas/)).length).toBeGreaterThan(0);
    const problemLinks = [...document.querySelectorAll(".admin-problem-list a")];
    expect(problemLinks[0]).toHaveAttribute("href", "#/admin/competencia");
    expect(problemLinks.length).toBe(2);
    // Solo lectura: 1 lista de eventos + readiness + 6 lecturas, cero escrituras.
    expect(apiRequest).toHaveBeenCalledTimes(8);
    expect(vi.mocked(apiRequest).mock.calls.every(([path, options]) => !options?.method || options.method === "GET")).toBe(true);
  });

  it("muestra resumen con contadores y accesos directos", async () => {
    mockAll();
    render(<AdminHomePage />);
    expect(await screen.findByRole("heading", { name: "Resumen" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Comparsas: 0\. Ver comparsas/ })).toHaveAttribute("href", "#/admin/competencia");
    expect(screen.getByRole("link", { name: /Jornadas: \d+\. Ver jornadas/ })).toHaveAttribute("href", "#/admin/events");
    expect(screen.getByRole("link", { name: /Jurados: 0\. Ver jurados/ })).toHaveAttribute("href", "#/admin/judges");
    expect(screen.getByRole("link", { name: /Rubros: 0\. Ver rubros/ })).toHaveAttribute("href", "#/admin/competencia");
    expect(screen.getByRole("link", { name: "Agregar comparsa" })).toHaveAttribute("href", "#/admin/competencia");
    expect(screen.getByRole("link", { name: "Registrar jurado" })).toHaveAttribute("href", "#/admin/judges");
    expect(screen.getByRole("link", { name: "Crear asignación" })).toHaveAttribute("href", "#/admin/assignments");
    expect(screen.getByRole("link", { name: "Revisar configuración" })).toHaveAttribute("href", "#/admin/events");
  });

  it("muestra estado completo cuando readiness está listo", async () => {
    mockComplete();
    render(<AdminHomePage />);
    expect(await screen.findByText(/Configuración completa/)).toBeInTheDocument();
    expect(screen.getAllByText("Competencia abierta").length).toBeGreaterThan(0);
    expect(screen.queryByText(/Falta:/)).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Abrir votación" })).toHaveAttribute("href", "#/admin/voting");
  });

  it("consume el evento activo global del shell ADMIN", async () => {
    mockAll();
    render(<AdminEventProvider><AdminHomePage /></AdminEventProvider>);

    expect(await screen.findByRole("heading", { name: "Goya 2027" })).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: "Evento activo" })).toHaveValue("e1");
  });
});
