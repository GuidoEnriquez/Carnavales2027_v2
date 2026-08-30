import { useState } from "react";
import { apiRequest } from "../api/http.js";
import { useSession } from "../auth/session-context.jsx";

function goToRoleHome(session) {
  if (session.status !== "authenticated") return false;
  if (session.roles?.length === 1 && session.roles[0] === "ADMIN") window.location.hash = "#/admin/events";
  else if (session.roles?.length === 1 && session.roles[0] === "JUDGE") window.location.hash = "#/judge";
  else window.location.hash = "#/home";
  return true;
}

export function LoginPage({ onAuthenticated }) {
  const session = useSession();
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
      let signIn;
      try {
        signIn = await apiRequest("/api/auth/sign-in/email", {
          method: "POST",
          body: JSON.stringify({ email: data.get("email"), password }),
        });
      } catch {
        setMessage("No se pudo iniciar sesión. Revisá el correo y la contraseña.");
        return;
      }
      if (!signIn.twoFactorRedirect) {
        await apiRequest("/api/auth/two-factor/enable", {
          method: "POST",
          body: JSON.stringify({ password }),
        });
      }
      await apiRequest("/api/auth/two-factor/send-otp", { method: "POST", body: "{}" });
      form.reset();
      setStep("otp");
      setMessage(import.meta.env.DEV
        ? "Código enviado. En desarrollo, revisá la consola de la API."
        : "Código enviado al correo configurado.");
    } catch {
      setMessage("La sesión se inició, pero no se pudo preparar el segundo factor. Intentá nuevamente.");
    } finally {
      setLoading(false);
    }
  };

  const finishAuthentication = async () => {
    const next = await session.refresh();
    if (!goToRoleHome(next)) {
      setStep("verified");
      setMessage("Tu código fue aceptado, pero no se pudo cargar el perfil. Reintentá esta consulta.");
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
      if (onAuthenticated) onAuthenticated();
      else await finishAuthentication();
    } catch {
      setMessage("El código es inválido o venció.");
    } finally {
      setLoading(false);
    }
  };

  const resendOtp = async () => {
    setLoading(true);
    setMessage("");
    try {
      await apiRequest("/api/auth/two-factor/send-otp", { method: "POST", body: "{}" });
      setMessage("Enviamos un nuevo código.");
    } catch {
      setMessage("No se pudo reenviar el código.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="container">
      <div className="card">
        <h1>Carnavales 2027</h1>
        {step === "credentials" ? (
          <form onSubmit={submitCredentials}>
            <label>Correo<input name="email" type="email" autoComplete="username" required /></label>
            <label>Contraseña<input name="password" type="password" autoComplete="current-password" required /></label>
            <button disabled={loading}>Continuar</button>
          </form>
        ) : step === "otp" ? (
          <form onSubmit={submitOtp}>
            <label>Código de verificación<input name="code" inputMode="numeric" pattern="[0-9]{6}" maxLength="6" autoComplete="one-time-code" required /></label>
            <button disabled={loading}>Verificar código</button>
            <button className="secondary" type="button" disabled={loading} onClick={resendOtp}>Reenviar código</button>
            <button className="secondary" type="button" disabled={loading} onClick={() => { setStep("credentials"); setMessage(""); }}>Volver</button>
          </form>
        ) : <div className="verified-session"><p>La verificación en dos pasos ya fue completada.</p><button type="button" disabled={loading} onClick={finishAuthentication}>Cargar mi perfil</button></div>}
        <p role="status" aria-live="polite">{message}</p>
      </div>
    </main>
  );
}
