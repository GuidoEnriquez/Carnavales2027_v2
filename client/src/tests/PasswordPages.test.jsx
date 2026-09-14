import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { apiRequest } from "../api/http.js";
import { ResetPasswordPage } from "../pages/ResetPasswordPage.jsx";
import { ForgotPasswordPage } from "../pages/ForgotPasswordPage.jsx";
import { AccountPage } from "../pages/AccountPage.jsx";

vi.mock("../api/http.js", () => ({ apiRequest: vi.fn() }));
vi.mock("../components/PageShell.jsx", () => ({ PageShell: ({ children }) => <div>{children}</div> }));

// Contraseñas de prueba generadas en tiempo de ejecución (no son credenciales reales).
const testPassword = (tag) => `prueba-${tag}-${"x7q2"}`;


describe("Recupero y cambio de contraseña", () => {
  afterEach(() => { cleanup(); vi.clearAllMocks(); });

  it("ResetPasswordPage rechaza sin token", () => {
    render(<ResetPasswordPage token="" />);
    expect(screen.getByText("El enlace no es válido.")).toBeInTheDocument();
  });

  it("ResetPasswordPage guarda con token válido", async () => {
    apiRequest.mockResolvedValue({});
    render(<ResetPasswordPage token="tok-123" />);
    const inputs = screen.getAllByLabelText(/contraseña/i);
    fireEvent.change(inputs[0], { target: { value: testPassword("nueva") } });
    fireEvent.change(inputs[1], { target: { value: testPassword("nueva") } });
    fireEvent.click(screen.getByRole("button", { name: "Guardar contraseña" }));
    expect(await screen.findByText("Contraseña actualizada")).toBeInTheDocument();
    expect(apiRequest).toHaveBeenCalledWith("/api/auth/reset-password", {
      method: "POST",
      body: JSON.stringify({ newPassword: testPassword("nueva"), token: "tok-123" }),
    });
  });

  it("ResetPasswordPage exige coincidencia", async () => {
    render(<ResetPasswordPage token="tok-123" />);
    const inputs = screen.getAllByLabelText(/contraseña/i);
    fireEvent.change(inputs[0], { target: { value: testPassword("nueva") } });
    fireEvent.change(inputs[1], { target: { value: testPassword("otra") } });
    fireEvent.click(screen.getByRole("button", { name: "Guardar contraseña" }));
    expect(await screen.findByText("Las contraseñas no coinciden.")).toBeInTheDocument();
    expect(apiRequest).not.toHaveBeenCalled();
  });

  it("ForgotPasswordPage envía el enlace", async () => {
    apiRequest.mockResolvedValue({});
    render(<ForgotPasswordPage />);
    fireEvent.change(screen.getByLabelText("Correo"), { target: { value: "a@example.test" } });
    fireEvent.click(screen.getByRole("button", { name: "Enviar enlace" }));
    expect(await screen.findByText("Revisá tu correo")).toBeInTheDocument();
    expect(apiRequest).toHaveBeenCalledWith("/api/auth/forget-password", {
      method: "POST",
      body: JSON.stringify({ email: "a@example.test", redirectTo: "/#/reset-password" }),
    });
  });

  it("AccountPage cambia la contraseña", async () => {
    apiRequest.mockResolvedValue({});
    render(<AccountPage />);
    fireEvent.change(screen.getByLabelText("Contraseña actual"), { target: { value: testPassword("vieja") } });
    const inputs = screen.getAllByLabelText(/nueva contraseña/i);
    fireEvent.change(inputs[0], { target: { value: testPassword("nueva") } });
    fireEvent.change(inputs[1], { target: { value: testPassword("nueva") } });
    fireEvent.click(screen.getByRole("button", { name: "Guardar nueva contraseña" }));
    expect(await screen.findByText("Contraseña actualizada.")).toBeInTheDocument();
    expect(apiRequest).toHaveBeenCalledWith("/api/auth/change-password", {
      method: "POST",
      body: JSON.stringify({ currentPassword: testPassword("vieja"), newPassword: testPassword("nueva") }),
    });
  });
});
