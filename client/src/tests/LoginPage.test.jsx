import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { apiRequest } from "../api/http.js";
import { LoginPage } from "../pages/LoginPage.jsx";

vi.mock("../api/http.js", () => ({ apiRequest: vi.fn() }));

describe("LoginPage", () => {
  afterEach(() => { cleanup(); vi.clearAllMocks(); });

  it("inicia sesión, solicita OTP y verifica 2FA antes de entrar al panel", async () => {
    const onAuthenticated = vi.fn();
    apiRequest.mockResolvedValue({});
    render(<LoginPage onAuthenticated={onAuthenticated} />);

    fireEvent.change(screen.getByLabelText("Correo"), { target: { value: "admin@example.test" } });
    fireEvent.change(screen.getByLabelText("Contraseña"), { target: { value: "local-password" } });
    fireEvent.click(screen.getByRole("button", { name: "Continuar" }));

    await waitFor(() => expect(apiRequest).toHaveBeenNthCalledWith(1, "/api/auth/sign-in/email", {
      method: "POST",
      body: JSON.stringify({ email: "admin@example.test", password: "local-password" }),
    }));
    expect(apiRequest).toHaveBeenNthCalledWith(2, "/api/auth/two-factor/enable", {
      method: "POST",
      body: JSON.stringify({ password: "local-password" }),
    });
    expect(apiRequest).toHaveBeenNthCalledWith(3, "/api/auth/two-factor/send-otp", {
      method: "POST",
      body: "{}",
    });

    fireEvent.change(await screen.findByLabelText("Código de verificación"), { target: { value: "123456" } });
    fireEvent.click(screen.getByRole("button", { name: "Verificar código" }));

    await waitFor(() => expect(apiRequest).toHaveBeenNthCalledWith(4, "/api/auth/two-factor/verify-otp", {
      method: "POST",
      body: JSON.stringify({ code: "123456" }),
    }));
    expect(onAuthenticated).toHaveBeenCalledOnce();
  });

  it("no vuelve a habilitar 2FA cuando el inicio de sesión ya requiere segundo factor", async () => {
    apiRequest
      .mockResolvedValueOnce({ twoFactorRedirect: true })
      .mockResolvedValueOnce({ status: true });
    render(<LoginPage onAuthenticated={vi.fn()} />);

    fireEvent.change(screen.getByLabelText("Correo"), { target: { value: "admin@example.test" } });
    fireEvent.change(screen.getByLabelText("Contraseña"), { target: { value: "local-password" } });
    fireEvent.click(screen.getByRole("button", { name: "Continuar" }));

    expect(await screen.findByLabelText("Código de verificación")).toBeInTheDocument();
    expect(apiRequest).toHaveBeenCalledTimes(2);
    expect(apiRequest).toHaveBeenLastCalledWith("/api/auth/two-factor/send-otp", {
      method: "POST",
      body: "{}",
    });
  });
});
