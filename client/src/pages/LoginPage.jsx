import { useEffect, useState } from "react";
import { apiRequest } from "../api/http.js";
import { useSession } from "../auth/session-context.jsx";

function goToRoleHome(session) {
  if (session.status !== "authenticated") return false;
  if (session.roles?.length === 1 && session.roles[0] === "ADMIN") window.location.hash = "#/admin/events";
  else if (session.roles?.length === 1 && session.roles[0] === "JUDGE") window.location.hash = "#/judge";
  else window.location.hash = "#/home";
  return true;
}

function maskEmail(email) {
  if (!email) return "";
  const parts = email.split("@");
  if (parts.length < 2) return email;
  const local = parts[0];
  const domain = parts[1];
  const visible = local.slice(0, 2);
  return `${visible}••••@${domain}`;
}

function EyeIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function EyeOffIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M9.88 9.88a3 3 0 1 0 4.24 4.24" />
      <path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68" />
      <path d="M6.61 6.61A13.526 13.526 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61" />
      <line x1="2" x2="22" y1="2" y2="22" />
    </svg>
  );
}

export function LoginPage({ onAuthenticated }) {
  const session = useSession();
  const [step, setStep] = useState("credentials");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [userEmail, setUserEmail] = useState("");
  const [resendCooldown, setResendCooldown] = useState(28);

  useEffect(() => {
    if (step !== "otp" || resendCooldown <= 0) return undefined;
    const timer = setInterval(() => {
      setResendCooldown((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, [step, resendCooldown]);

  const submitCredentials = async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    setLoading(true);
    setMessage("");
    const email = data.get("email");
    setUserEmail(email);
    try {
      const password = data.get("password");
      let signIn;
      try {
        signIn = await apiRequest("/api/auth/sign-in/email", {
          method: "POST",
          body: JSON.stringify({ email, password }),
        });
      } catch {
        setMessage("Correo o contraseña incorrectos.");
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
      setResendCooldown(28);
      setMessage("✓ Código enviado correctamente");
    } catch {
      setMessage("No pudimos iniciar sesión. Intentá nuevamente.");
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
      setMessage("El código no es correcto.");
    } finally {
      setLoading(false);
    }
  };

  const resendOtp = async () => {
    if (resendCooldown > 0) return;
    setLoading(true);
    setMessage("");
    try {
      await apiRequest("/api/auth/two-factor/send-otp", { method: "POST", body: "{}" });
      setResendCooldown(28);
      setMessage("Te enviamos un nuevo código.");
    } catch {
      setMessage("No se pudo reenviar el código. Intentá nuevamente.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="login-page">
      <div className="login-orbit login-orbit-left" aria-hidden="true" />
      <div className="login-orbit login-orbit-right" aria-hidden="true" />
      <div className="card login-card">
        <div className="login-emblem" aria-hidden="true" />
        <p className="login-kicker">Acceso seguro</p>
        <h1>Carnavales Goya <span>2027</span></h1>
        <p className="login-subtitle">Sistema de jurados</p>
        {step === "credentials" ? (
          <form onSubmit={submitCredentials}>
            <label>
              Correo
              <input name="email" type="email" autoComplete="username" placeholder="nombre@ejemplo.com" required />
            </label>
            <label>
              Contraseña
              <div className="login-password-wrapper">
                <input
                  name="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  required
                />
                <button
                  type="button"
                  className="login-password-toggle"
                  aria-label={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
                  onClick={() => setShowPassword((prev) => !prev)}
                >
                  {showPassword ? <EyeOffIcon /> : <EyeIcon />}
                </button>
              </div>
            </label>
            <button className="primary-action" disabled={loading}>
              {loading ? "Verificando…" : "Ingresar"}
            </button>
          </form>
        ) : step === "otp" ? (
          <form onSubmit={submitOtp}>
            <div className="otp-header">
              <h2>Verificá tu identidad</h2>
              <p>Te enviamos un código de 6 números a <strong>{maskEmail(userEmail)}</strong></p>
              <p className="otp-subtext">Ingresalo para continuar.</p>
            </div>
            <label>
              Código de verificación
              <input
                name="code"
                inputMode="numeric"
                pattern="[0-9]{6}"
                maxLength="6"
                autoComplete="one-time-code"
                className="otp-code-input"
                placeholder="000000"
                required
              />
            </label>
            <button className="primary-action" disabled={loading}>Verificar código</button>
            <button
              className="secondary"
              type="button"
              disabled={loading || resendCooldown > 0}
              onClick={resendOtp}
            >
              {resendCooldown > 0 ? `Reenviar código en ${resendCooldown} s` : "Reenviar código"}
            </button>
            <button
              className="secondary"
              type="button"
              disabled={loading}
              onClick={() => { setStep("credentials"); setMessage(""); }}
            >
              Volver
            </button>
          </form>
        ) : (
          <div className="verified-session">
            <p>La verificación en dos pasos ya fue completada.</p>
            <button type="button" disabled={loading} onClick={finishAuthentication}>
              Cargar mi perfil
            </button>
          </div>
        )}
        {message && (
          <div className="login-footer-info">
            <p className="login-message-alert" role="status" aria-live="polite">{message}</p>
          </div>
        )}
      </div>
    </main>
  );
}
