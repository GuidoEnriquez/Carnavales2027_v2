import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import App from "../App.jsx";

describe("App", () => {
  afterEach(() => { cleanup(); window.location.hash = ""; });
  it("muestra login como ruta pública inicial", () => {
    render(<App />);

    expect(screen.getByRole("heading", { name: "Carnavales Goya 2027" })).toBeInTheDocument();
    expect(screen.getByLabelText("Usuario / DNI")).toBeInTheDocument();
    expect(screen.getByLabelText("Contraseña")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Ingresar" })).toBeInTheDocument();
  });

  it("protege rutas ADMIN y permite el panel informativo JUDGE", () => {
    window.location.hash = "#/admin/judges";
    const { rerender } = render(<App session={{ status: "authenticated", roles: ["JUDGE"] }} />);
    expect(screen.getByText("No tenés permisos de administración")).toBeInTheDocument();

    window.location.hash = "#/judge";
    window.dispatchEvent(new HashChangeEvent("hashchange"));
    rerender(<App session={{ status: "authenticated", roles: ["JUDGE"], judgeProfile: { registrationStatus: "REGISTERED" }, user: { name: "Jurado" } }} />);
    expect(screen.getByRole("heading", { name: "Buenas noches, Jurado" })).toBeInTheDocument();
  });

  it("mantiene una ruta segura después de aceptar una invitación", () => {
    window.location.hash = "#/invitations/accepted";
    render(<App />);
    expect(screen.getByRole("heading", { name: "Cuenta creada" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Continuar al inicio de sesión" })).toHaveAttribute("href", "#/login");
  });

  it("protege la ruta #/admin/penalties para roles no autorizados", () => {
    window.location.hash = "#/admin/penalties";
    render(<App session={{ status: "authenticated", roles: ["JUDGE"] }} />);
    expect(screen.getByText("No tenés permisos para acceder a esta sección.")).toBeInTheDocument();
  });
});
