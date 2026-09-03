import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { apiRequest } from "../api/http.js";
import { LoginPage } from "../pages/LoginPage.jsx";
import { SessionProvider } from "../auth/session-context.jsx";

vi.mock("../api/http.js", () => ({ apiRequest: vi.fn() }));

function fillOtp(code) {
  const group = screen.getByLabelText("Código de verificación");
  const inputs = group.querySelectorAll("input");
  code.split("").forEach((digit, i) => {
    fireEvent.change(inputs[i], { target: { value: digit } });
  });
}

describe("LoginPage", () => {
  afterEach(() => { cleanup(); vi.clearAllMocks(); window.location.hash = ""; });

  it("inicia sesión, solicita OTP y verifica 2FA antes de entrar al panel", async () => {
    const onAuthenticated = vi.fn();
    apiRequest.mockResolvedValue({});
    render(<LoginPage onAuthenticated={onAuthenticated} />);

    fireEvent.change(screen.getByLabelText("Correo"), { target: { value: "admin@example.test" } });
    fireEvent.change(screen.getByLabelText("Contraseña"), { target: { value: "local-password" } });
    fireEvent.click(screen.getByRole("button", { name: "Ingresar" }));

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

    await screen.findByLabelText("Código de verificación");
    fillOtp("123456");
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
    fireEvent.click(screen.getByRole("button", { name: "Ingresar" }));

    expect(await screen.findByLabelText("Código de verificación")).toBeInTheDocument();
    expect(apiRequest).toHaveBeenCalledTimes(2);
    expect(apiRequest).toHaveBeenLastCalledWith("/api/auth/two-factor/send-otp", {
      method: "POST",
      body: "{}",
    });
  });

  it("refresca la sesión y dirige al área JUDGE después del OTP", async () => {
    let meCalls = 0;
    apiRequest.mockImplementation((path) => {
      if (path === "/api/v1/me") {
        meCalls += 1;
        return meCalls === 1
          ? Promise.reject({ code: "UNAUTHENTICATED" })
          : Promise.resolve({ user: { id: "u1", name: "Jurado" }, roles: ["JUDGE"], judgeProfile: { registrationStatus: "REGISTERED" } });
      }
      if (path === "/api/auth/sign-in/email") return Promise.resolve({});
      return Promise.resolve({});
    });
    render(<SessionProvider><LoginPage /></SessionProvider>);

    fireEvent.change(screen.getByLabelText("Correo"), { target: { value: "judge@example.test" } });
    fireEvent.change(screen.getByLabelText("Contraseña"), { target: { value: "JudgePassword-2026!" } });
    fireEvent.click(screen.getByRole("button", { name: "Ingresar" }));
    await screen.findByLabelText("Código de verificación");
    fillOtp("123456");
    fireEvent.click(screen.getByRole("button", { name: "Verificar código" }));

    await waitFor(() => expect(window.location.hash).toBe("#/judge"));
    expect(meCalls).toBe(2);
  });

  it("reintenta solo la carga del perfil cuando el OTP ya fue aceptado", async () => {
    let meCalls = 0;
    apiRequest.mockImplementation((path) => {
      if (path === "/api/v1/me") {
        meCalls += 1;
        if (meCalls === 1) return Promise.reject({ code: "UNAUTHENTICATED" });
        if (meCalls === 2) return Promise.reject({ code: "INTERNAL_ERROR" });
        return Promise.resolve({ user: { id: "u2", name: "Jurado" }, roles: ["JUDGE"], judgeProfile: { registrationStatus: "REGISTERED" } });
      }
      return Promise.resolve({});
    });
    render(<SessionProvider><LoginPage /></SessionProvider>);
    fireEvent.change(screen.getByLabelText("Correo"), { target: { value: "judge@example.test" } });
    fireEvent.change(screen.getByLabelText("Contraseña"), { target: { value: "JudgePassword-2026!" } });
    fireEvent.click(screen.getByRole("button", { name: "Ingresar" }));
    await screen.findByLabelText("Código de verificación");
    fillOtp("123456");
    fireEvent.click(screen.getByRole("button", { name: "Verificar código" }));

    fireEvent.click(await screen.findByRole("button", { name: "Cargar mi perfil" }));
    await waitFor(() => expect(window.location.hash).toBe("#/judge"));
    expect(meCalls).toBe(3);
  });

  it("alterna la visibilidad de la contraseña al pulsar el botón con icono", () => {
    render(<LoginPage />);
    const passwordInput = screen.getByLabelText("Contraseña");
    const toggleButton = screen.getByRole("button", { name: "Mostrar contraseña" });

    expect(passwordInput).toHaveAttribute("type", "password");
    expect(toggleButton).toBeInTheDocument();
    expect(toggleButton.querySelector("svg")).toBeInTheDocument();

    fireEvent.click(toggleButton);
    expect(passwordInput).toHaveAttribute("type", "text");
    expect(screen.getByRole("button", { name: "Ocultar contraseña" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Ocultar contraseña" }));
    expect(passwordInput).toHaveAttribute("type", "password");
  });
});
