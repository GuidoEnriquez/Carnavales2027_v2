import { useEffect, useRef, useState } from "react";
import { PageShell } from "../components/PageShell.jsx";
import { apiRequest } from "../api/http.js";
import { useSession } from "../auth/session-context.jsx";

export function goToRoleHome(session) {
  if (session.status !== "authenticated") return false;
  const roles = session.roles ?? [];
  if (roles.includes("ADMIN")) window.location.hash = "#/admin/home";
  else if (roles.includes("JUDGE")) window.location.hash = "#/judge";
  else if (roles.includes("COMISARIO")) window.location.hash = "#/admin/penalties";
  else if (roles.some((r) => ["SCRUTINEER", "ESCRIBANO"].includes(r))) window.location.hash = "#/admin/results";
  else if (roles.includes("VEEDOR")) window.location.hash = "#/veedor";
  else window.location.hash = "#/login";
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

function UserIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </svg>
  );
}

function LockIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect width="18" height="11" x="3" y="11" rx="2" ry="2" />
      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </svg>
  );
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

const OTP_LENGTH = 6;
const RESEND_SECONDS = 28;

export function LoginPage({ onAuthenticated }) {
  const session = useSession();
  const [step, setStep] = useState("credentials");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [userEmail, setUserEmail] = useState("");
  const [resendCooldown, setResendCooldown] = useState(28);
  const [otpValues, setOtpValues] = useState(Array(OTP_LENGTH).fill(""));
  const otpRefs = useRef([]);

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
      setOtpValues(Array(OTP_LENGTH).fill(""));
      setResendCooldown(RESEND_SECONDS);
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
    const code = otpValues.join("");
    if (code.length < OTP_LENGTH) {
      setMessage("Ingresá los 6 números para continuar.");
      return;
    }
    setLoading(true);
    setMessage("");
    try {
      await apiRequest("/api/auth/two-factor/verify-otp", {
        method: "POST",
        body: JSON.stringify({ code }),
      });
    } catch (error) {
      if (error.code === "INVALID_CODE") {
        setMessage("El código no es correcto.");
      } else if (error.code === "OTP_HAS_EXPIRED") {
        setMessage("El código venció. Solicitá uno nuevo.");
      } else if (error.code === "TOO_MANY_ATTEMPTS_REQUEST_NEW_CODE") {
        setMessage("Se agotaron los intentos. Solicitá un código nuevo.");
      } else if (error.code === "INVALID_TWO_FACTOR_COOKIE") {
        setMessage("La verificación venció. Volvé a ingresar para recibir un código nuevo.");
      } else {
        setMessage("No pudimos verificar el código. Intentá nuevamente.");
      }
      return;
    } finally {
      setLoading(false);
    }

    try {
      if (onAuthenticated) onAuthenticated();
      else await finishAuthentication();
    } catch {
      setStep("verified");
      setMessage("El código fue aceptado, pero no se pudo cargar el perfil. Reintentá esta consulta.");
    }
  };

  const resendOtp = async () => {
    if (resendCooldown > 0) return;
    setLoading(true);
    setMessage("");
    try {
      await apiRequest("/api/auth/two-factor/send-otp", { method: "POST", body: "{}" });
      setMessage("Te enviamos un nuevo código.");
      setResendCooldown(RESEND_SECONDS);
    } catch {
      setMessage("No se pudo reenviar el código. Intentá nuevamente.");
    } finally {
      setLoading(false);
    }
  };

  const handleOtpChange = (index, value) => {
    const digits = value.replace(/\D/g, "").slice(0, OTP_LENGTH - index);
    const newValues = [...otpValues];
    if (digits.length > 1) {
      for (let offset = 0; offset < digits.length; offset++) {
        newValues[index + offset] = digits[offset];
      }
    } else {
      newValues[index] = digits;
    }
    setOtpValues(newValues);
    if (digits) {
      otpRefs.current[Math.min(index + digits.length, OTP_LENGTH - 1)]?.focus();
    }
  };

  const handleOtpKeyDown = (index, event) => {
    if (event.key === "Backspace" && !otpValues[index] && index > 0) {
      otpRefs.current[index - 1]?.focus();
    }
  };

  const handleOtpPaste = (event) => {
    event.preventDefault();
    const pasted = event.clipboardData.getData("text").replace(/\D/g, "").slice(0, OTP_LENGTH);
    if (!pasted) return;
    const newValues = Array(OTP_LENGTH).fill("");
    for (let i = 0; i < pasted.length; i++) newValues[i] = pasted[i];
    setOtpValues(newValues);
    otpRefs.current[Math.min(pasted.length, OTP_LENGTH - 1)]?.focus();
  };

  return (
    <PageShell layer="brand" className="login-page">
      <div className="login-orbit login-orbit-left" aria-hidden="true" />
      <div className="login-orbit login-orbit-right" aria-hidden="true" />
      <div className="card login-card">
        <div className="login-emblem" aria-hidden="true" />
        <p className="login-kicker">Acceso seguro</p>
        <h1>Carnavales Goya <span>2027</span></h1>
        <p className="login-subtitle">Sistema de jurados</p>
        {step === "credentials" ? (
          <form onSubmit={submitCredentials}>
            <label className="login-field-label">
              Usuario / DNI
              <div className="login-input-wrapper">
                <span className="login-input-icon" aria-hidden="true"><UserIcon /></span>
                <input name="email" type="text" autoComplete="username" placeholder="Ingrese su identificador" required />
              </div>
            </label>
            <label className="login-field-label">
              Contraseña
              <div className="login-password-wrapper">
                <span className="login-input-icon" aria-hidden="true"><LockIcon /></span>
                <input
                  name="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  placeholder="••••••••"
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
            <div className="otp-input-group" role="group" aria-label="Código de verificación" onPaste={handleOtpPaste}>
              {otpValues.map((val, i) => (
                <input
                  key={i}
                  ref={(el) => { otpRefs.current[i] = el; }}
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]"
                  maxLength="1"
                  autoComplete={i === 0 ? "one-time-code" : "off"}
                  value={val}
                  onChange={(e) => handleOtpChange(i, e.target.value)}
                  onKeyDown={(e) => handleOtpKeyDown(i, e)}
                  disabled={loading}
                  required
                  aria-label={`Dígito ${i + 1} de 6`}
                />
              ))}
            </div>
            <button disabled={loading}>Verificar código</button>
            <p className="resend-cooldown">
              {resendCooldown > 0 ? (
                <>¿No recibiste el código? Reenviar código en {resendCooldown} s</>
              ) : (
                <button type="button" className="resend-link" disabled={loading} onClick={resendOtp}>Reenviar código</button>
              )}
            </p>
            <button
              className="secondary"
              type="button"
              disabled={loading}
              onClick={() => { setStep("credentials"); setMessage(""); setOtpValues(Array(OTP_LENGTH).fill("")); }}
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
        <div className="login-public-link">
          <a href="#/resultados" className="public-results-link">
            🏆 Ver Resultados Oficiales Públicos
          </a>
        </div>
      </div>
      <div className="login-device-status" aria-label="Estado del dispositivo">
        <span aria-hidden="true">●</span> Dispositivo conectado
      </div>
    </PageShell>
  );
}
