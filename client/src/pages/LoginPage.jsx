import { useState } from "react";
import { apiRequest } from "../api/http.js";

function goToAdminPanel() {
  window.location.hash = "#/admin/events";
  window.location.reload();
}

export function LoginPage({ onAuthenticated = goToAdminPanel }) {
  const [step, setStep] = useState("credentials");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  const submitCredentials = async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    setLoading(true);
    setMessage("");
    try {
      const password = data.get("password");
      const signIn = await apiRequest("/api/auth/sign-in/email", {
        method: "POST",
        body: JSON.stringify({ email: data.get("email"), password }),
      });
      if (!signIn.twoFactorRedirect) {
        await apiRequest("/api/auth/two-factor/enable", {
          method: "POST",
          body: JSON.stringify({ password }),
        });
      }
      await apiRequest("/api/auth/two-factor/send-otp", { method: "POST", body: "{}" });
      form.reset();
      setStep("otp");
      setMessage("Código enviado. En desarrollo, revisá la consola de la API.");
    } catch {
      setMessage("No se pudo iniciar sesión. Revisá el correo y la contraseña.");
    } finally {
      setLoading(false);
    }
  };

  const submitOtp = async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const code = new FormData(form).get("code");
    setLoading(true);
    setMessage("");
    try {
      await apiRequest("/api/auth/two-factor/verify-otp", {
        method: "POST",
        body: JSON.stringify({ code }),
      });
      onAuthenticated();
    } catch {
      setMessage("El código es inválido o venció.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main>
      <h1>Carnavales 2027</h1>
      {step === "credentials" ? (
        <form onSubmit={submitCredentials}>
          <label>Correo<input name="email" type="email" autoComplete="username" required /></label>
          <label>Contraseña<input name="password" type="password" autoComplete="current-password" required /></label>
          <button disabled={loading}>Continuar</button>
        </form>
      ) : (
        <form onSubmit={submitOtp}>
          <label>Código de verificación<input name="code" inputMode="numeric" pattern="[0-9]{6}" maxLength="6" autoComplete="one-time-code" required /></label>
          <button disabled={loading}>Verificar código</button>
        </form>
      )}
      <p>{message}</p>
    </main>
  );
}
