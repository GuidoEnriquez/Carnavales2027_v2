import { useState } from "react";
import { apiRequest } from "../api/http.js";
import { PageShell } from "../components/PageShell.jsx";

export function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);

  const submit = async (event) => {
    event.preventDefault();
    if (!email.trim()) {
      setMessage("Ingresá tu correo.");
      return;
    }
    setLoading(true);
    setMessage("");
    try {
      await apiRequest("/api/auth/forget-password", {
        method: "POST",
        body: JSON.stringify({ email: email.trim(), redirectTo: "/#/reset-password" }),
      });
      setSent(true);
    } catch {
      setMessage("No se pudo procesar. Intentá nuevamente.");
    } finally {
      setLoading(false);
    }
  };

  if (sent) {
    return (
      <PageShell>
        <h1>Revisá tu correo</h1>
        <p>Si existe una cuenta con ese correo, te enviamos un enlace para definir una nueva contraseña.</p>
        <a href="#/login">Volver al ingreso</a>
      </PageShell>
    );
  }

  return (
    <PageShell>
      <h1>Olvidé mi contraseña</h1>
      <form onSubmit={submit}>
        <label>Correo
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" />
        </label>
        <button type="submit" disabled={loading}>Enviar enlace</button>
      </form>
      {message && <p role="status">{message}</p>}
      <p><a href="#/login">Volver al ingreso</a></p>
    </PageShell>
  );
}
